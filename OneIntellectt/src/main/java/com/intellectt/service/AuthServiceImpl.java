package com.intellectt.service;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.intellectt.exception.BadRequestException;
import com.intellectt.exception.ForbiddenException;
import com.intellectt.exception.TooManyRequestsException;
import com.intellectt.model.PasswordResetToken;
import com.intellectt.model.User;
import com.intellectt.model.UserSession;
import com.intellectt.model.enums.SessionEndReason;
import com.intellectt.repository.PasswordResetTokenRepository;
import com.intellectt.repository.TeamRepository;
import com.intellectt.repository.UserRepository;
import com.intellectt.security.AttemptLimiter;
import com.intellectt.security.JwtService;
import com.intellectt.security.SecurityEvents;

@Service
public class AuthServiceImpl implements AuthService {

    /*
     * Rate limits (in memory; see AttemptLimiter). Failed sign-ins lock out:
     *  - one account from one IP after 5 failures (stops guessing without letting a
     *    stranger lock a real user out from elsewhere),
     *  - one account from anywhere after 20 (guessing spread over many IPs),
     *  - one IP after 50 (one machine trying many accounts).
     * Each lock lifts 15 minutes after the first failure; a correct sign-in clears the account's count.
     */
    static final Duration LOGIN_WINDOW = Duration.ofMinutes(15);
    static final int MAX_FAILURES_PER_ACCOUNT_AND_IP = 5;
    static final int MAX_FAILURES_PER_ACCOUNT = 20;
    static final int MAX_FAILURES_PER_IP = 50;
    /* Password-reset emails: 3 per account and 20 per IP, per hour. */
    static final Duration RESET_WINDOW = Duration.ofHours(1);
    static final int MAX_RESETS_PER_ACCOUNT = 3;
    static final int MAX_RESETS_PER_IP = 20;

    private final AuthenticationManager authenticationManager;
    private final AttemptLimiter limiter;
    private final UserRepository userRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final SessionService sessionService;
    private final TeamRepository teamRepository;
    private final AllowedEmailDomains emailDomains;
    private final String frontendBaseUrl;
    private final long resetTtlMinutes;

    public AuthServiceImpl(AuthenticationManager authenticationManager, UserRepository userRepository,
            PasswordResetTokenRepository resetTokenRepository, JwtService jwtService,
            PasswordEncoder passwordEncoder, EmailService emailService, SessionService sessionService,
            AttemptLimiter limiter, TeamRepository teamRepository, AllowedEmailDomains emailDomains,
            @Value("${app.frontend.base-url:http://localhost:5173}") String frontendBaseUrl,
            @Value("${app.reset.token-ttl-minutes:60}") long resetTtlMinutes) {
        this.authenticationManager = authenticationManager;
        this.limiter = limiter;
        this.userRepository = userRepository;
        this.resetTokenRepository = resetTokenRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.sessionService = sessionService;
        this.teamRepository = teamRepository;
        this.emailDomains = emailDomains;
        this.frontendBaseUrl = frontendBaseUrl;
        this.resetTtlMinutes = resetTtlMinutes;
    }

    @Override
    public Map<String, Object> login(User credentials, String clientIp) {
        String email = credentials.getEmail() == null ? "" : credentials.getEmail().trim();
        String password = credentials.getPassword() == null ? "" : credentials.getPassword();

        // Only company email ids can have an account; say so instead of "wrong email or password"
        if (!email.isEmpty()) {
            emailDomains.requireAllowedForLogin(email);
        }

        // Password guessing: checked BEFORE the password, so a locked-out guesser learns nothing.
        String accountKey = "login:acct:" + email.toLowerCase(Locale.ROOT);
        String pairKey = accountKey + "|" + clientIp;
        String ipKey = "login:ip:" + clientIp;
        if (limiter.isBlocked(pairKey, MAX_FAILURES_PER_ACCOUNT_AND_IP, LOGIN_WINDOW)
                || limiter.isBlocked(accountKey, MAX_FAILURES_PER_ACCOUNT, LOGIN_WINDOW)
                || limiter.isBlocked(ipKey, MAX_FAILURES_PER_IP, LOGIN_WINDOW)) {
            long seconds = Math.max(limiter.secondsLeft(pairKey, LOGIN_WINDOW),
                    Math.max(limiter.secondsLeft(accountKey, LOGIN_WINDOW), limiter.secondsLeft(ipKey, LOGIN_WINDOW)));
            SecurityEvents.warn("LOGIN_BLOCKED", email, "too many failed attempts");
            throw new TooManyRequestsException("Too many failed sign-in attempts. Please try again in "
                    + ((seconds + 59) / 60) + " minute(s), or reset your password.", seconds);
        }

        try {
            if (email.isEmpty() || password.isEmpty() || !CredentialRules.fitsBcrypt(password)) {
                throw new BadCredentialsException("bad input");
            }
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(email, password));
        } catch (BadCredentialsException ex) {
            recordFailure(pairKey, accountKey, ipKey);
            SecurityEvents.event("LOGIN_FAILED", email, "wrong email or password");
            throw new ForbiddenException("Invalid email or password");
        } catch (DisabledException ex) {
            // Spring reports "disabled" before checking the password. Only say so to someone
            // who knows the password, or anyone could find out which accounts are deactivated.
            User found = userRepository.findByEmail(email).orElse(null);
            if (found != null && passwordEncoder.matches(password, found.getPassword())) {
                SecurityEvents.event("LOGIN_FAILED", email, "account deactivated");
                throw new ForbiddenException("This account has been deactivated");
            }
            recordFailure(pairKey, accountKey, ipKey);
            SecurityEvents.event("LOGIN_FAILED", email, "wrong email or password");
            throw new ForbiddenException("Invalid email or password");
        }
        limiter.reset(pairKey);
        limiter.reset(accountKey);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ForbiddenException("Invalid email or password"));

        // A new server-side session; any other session of this user ends (one session per user).
        UserSession session = sessionService.start(user);
        userRepository.touchLastLogin(user.getId(), Instant.now());
        SecurityEvents.event("LOGIN_OK", user.getEmail(), "role=" + user.getRole());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("token", jwtService.generateToken(user, session.getId()));
        result.put("idleTimeoutMinutes", sessionService.getIdleTimeoutMinutes());
        result.put("userId", user.getId());
        result.put("fullName", user.getFullName());
        result.put("email", user.getEmail());
        result.put("role", user.getRole());
        result.put("teamId", user.getTeam() != null ? user.getTeam().getId() : null);
        result.put("teamName", user.getTeam() != null ? user.getTeam().getName() : null);
        result.put("location", user.getLocation());
        result.putAll(approverNames(user));
        // The browser sends them to "choose your password" first; the server enforces it (JwtAuthFilter)
        result.put("mustChangePassword", user.isMustChangePassword());
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> profile(User user) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("id", user.getId());
        p.put("fullName", user.getFullName());
        p.put("email", user.getEmail());
        p.put("role", user.getRole());
        p.put("active", user.isActive());
        p.put("teamId", user.getTeam() != null ? user.getTeam().getId() : null);
        p.put("teamName", user.getTeam() != null ? user.getTeam().getName() : null);
        p.put("mustChangePassword", user.isMustChangePassword());
        p.put("lastLoginAt", user.getLastLoginAt());
        p.put("location", user.getLocation());
        p.putAll(approverNames(user));
        return p;
    }

    /** The names of the Sales Lead and Sales Manager over the user's team (null when there is none). */
    private Map<String, Object> approverNames(User user) {
        Map<String, Object> names = new LinkedHashMap<>();
        names.put("salesLeadName", null);
        names.put("salesManagerName", null);
        if (user.getTeam() != null) {
            teamRepository.findById(user.getTeam().getId()).ifPresent(t -> {
                names.put("salesLeadName", t.getSalesLead() != null ? t.getSalesLead().getFullName() : null);
                names.put("salesManagerName", t.getSalesManager() != null ? t.getSalesManager().getFullName() : null);
            });
        }
        return names;
    }

    @Override
    @Transactional
    public void requestPasswordReset(String email, String clientIp) {
        if (email == null || email.isBlank()) {
            return;
        }
        // Stop one caller flooding the mail server or someone's inbox.
        String ipKey = "reset:ip:" + clientIp;
        if (limiter.record(ipKey, RESET_WINDOW) > MAX_RESETS_PER_IP) {
            throw new TooManyRequestsException("Too many password reset requests. Please try again later.",
                    limiter.secondsLeft(ipKey, RESET_WINDOW));
        }
        // Per account: quietly send nothing more (an error here would reveal the email exists).
        if (limiter.record("reset:acct:" + email.trim().toLowerCase(Locale.ROOT), RESET_WINDOW) > MAX_RESETS_PER_ACCOUNT) {
            return;
        }
        // Only active accounts can reset. We return normally regardless so a caller
        // can't tell whether a given email is registered.
        userRepository.findByEmail(email.trim()).ifPresent(user -> {
            if (!user.isActive()) {
                return;
            }
            String token = UUID.randomUUID().toString() + UUID.randomUUID().toString().substring(0, 8);
            PasswordResetToken prt = new PasswordResetToken();
            prt.setToken(token);
            prt.setUser(user);
            prt.setExpiresAt(Instant.now().plus(resetTtlMinutes, ChronoUnit.MINUTES));
            resetTokenRepository.save(prt);

            String link = frontendBaseUrl + "/reset-password?token=" + token;
            SecurityEvents.event("PASSWORD_RESET_REQUESTED", user.getEmail(), "reset link emailed");
            // Send ONLY to the user — a reset link must never be copied to admins.
            emailService.notifyUserOnly(user, "Reset your One Intellectt password",
                    resetEmailHtml(user, link));
        });
    }

    @Override
    @Transactional
    public void resetPassword(String token, String newPassword) {
        if (token == null || token.isBlank()) {
            throw new BadRequestException("Invalid or missing reset token");
        }
        CredentialRules.checkPassword(newPassword);
        PasswordResetToken prt = resetTokenRepository.findByToken(token.trim())
                .orElseThrow(() -> new BadRequestException(
                        "This reset link is invalid or has already been used"));
        if (prt.isUsed()) {
            throw new BadRequestException("This reset link has already been used");
        }
        if (prt.isExpired()) {
            throw new BadRequestException("This reset link has expired. Please request a new one");
        }

        User user = prt.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false); // they chose this one themselves
        userRepository.save(user);
        SecurityEvents.event("PASSWORD_RESET", user.getEmail(), "via emailed link");

        prt.setUsed(true);
        resetTokenRepository.save(prt);

        // A password reset signs the user out everywhere (e.g. if someone else had their password).
        sessionService.endAll(user, SessionEndReason.PASSWORD_RESET);
    }

    @Override
    @Transactional
    public void changePassword(User actor, String currentPassword, String newPassword, String sessionId) {
        User user = userRepository.findById(actor.getId())
                .orElseThrow(() -> new ForbiddenException("Account not found"));
        if (currentPassword == null || !CredentialRules.fitsBcrypt(currentPassword)
                || !passwordEncoder.matches(currentPassword, user.getPassword())) {
            SecurityEvents.event("PASSWORD_CHANGE_FAILED", user.getEmail(), "wrong current password");
            throw new BadRequestException("Your current password is not correct");
        }
        CredentialRules.checkPassword(newPassword);
        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new BadRequestException("Choose a password different from your current one");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false);
        userRepository.save(user);
        // Any other place this account is signed in ends; this browser stays signed in.
        sessionService.endAllExcept(user, sessionId, SessionEndReason.PASSWORD_RESET);
        SecurityEvents.event("PASSWORD_CHANGED", user.getEmail(), "by the user");
    }

    private void recordFailure(String... keys) {
        for (String key : keys) {
            limiter.record(key, LOGIN_WINDOW);
        }
    }

    @Override
    public void logout(String sessionId, boolean idle) {
        sessionService.end(sessionId, idle ? SessionEndReason.IDLE_TIMEOUT : SessionEndReason.SIGNED_OUT);
    }

    /** A simple, branded HTML email with the reset link and expiry note. */
    private String resetEmailHtml(User user, String link) {
        String mins = String.valueOf(resetTtlMinutes);
        return "<div style=\"font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:14px;"
                + "max-width:520px;margin:0 auto;padding:8px\">"
                + "<p style=\"margin:0 0 12px\">Hi " + esc(user.getFullName()) + ",</p>"
                + "<p style=\"margin:0 0 16px;line-height:1.5\">We received a request to reset your "
                + "One Intellectt password. Click the button below to choose a new one. "
                + "This link expires in " + mins + " minutes and can be used once.</p>"
                + "<p style=\"margin:0 0 20px\"><a href=\"" + esc(link) + "\" "
                + "style=\"display:inline-block;background:#334155;color:#ffffff;text-decoration:none;"
                + "padding:11px 22px;border-radius:8px;font-weight:600\">Reset password</a></p>"
                + "<p style=\"margin:0 0 6px;color:#64748b;font-size:12px\">Or paste this link into your browser:</p>"
                + "<p style=\"margin:0 0 20px;word-break:break-all;font-size:12px\"><a href=\"" + esc(link)
                + "\" style=\"color:#334155\">" + esc(link) + "</a></p>"
                + "<p style=\"margin:0;color:#94a3b8;font-size:12px\">If you didn't request this, you can safely "
                + "ignore this email — your password won't change.</p></div>";
    }

    private String esc(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
