
package com.intellectt.security;

import java.io.IOException;
import java.util.Set;

import org.springframework.dao.DataAccessException;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.TransactionException;
import org.springframework.web.filter.OncePerRequestFilter;

import com.intellectt.model.enums.SessionEndReason;
import com.intellectt.service.SessionService;

import io.jsonwebtoken.ExpiredJwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Reads the Bearer token on each request and, if it's valid AND its server-side
 * session is still live, populates the security context. Otherwise it records
 * why (see {@link #AUTH_FAILURE_ATTR}) so the 401 response can tell the browser.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    /** Request attribute: the current session id, for logout. */
    public static final String SESSION_ID_ATTR = "oi.sessionId";
    /** Request attribute: the {@link SessionEndReason} when a token was rejected. */
    public static final String AUTH_FAILURE_ATTR = "oi.authFailure";

    /** All a user who must change their password may call. */
    private static final Set<String> PASSWORD_CHANGE_ALLOWED =
            Set.of("/api/auth/me", "/api/auth/change-password", "/api/auth/logout");

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;
    private final SessionService sessionService;

    public JwtAuthFilter(JwtService jwtService, CustomUserDetailsService userDetailsService,
            SessionService sessionService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.sessionService = sessionService;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String token = authHeader.substring(7);
        SessionEndReason failure;
        try {
            failure = authenticate(token, request);
        } catch (ExpiredJwtException ex) {
            failure = SessionEndReason.EXPIRED;
        } catch (DataAccessException | TransactionException ex) {
            // The database is overloaded or down. That says nothing about the user's
            // session, so answer "busy, try again" (503) — a 401 here would sign them out.
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write("{\"status\":503,\"error\":\"Service Unavailable\","
                    + "\"message\":\"The server is busy right now. Please try again in a moment.\"}");
            return;
        } catch (Exception ex) {
            failure = SessionEndReason.INVALID; // bad signature, unknown user, ...
        }

        if (failure != null) {
            // Leave the request unauthenticated; protected endpoints answer 401 with this reason.
            SecurityContextHolder.clearContext();
            request.setAttribute(AUTH_FAILURE_ATTR, failure);
        } else if (mustChangePassword() && !PASSWORD_CHANGE_ALLOWED.contains(request.getRequestURI())) {
            // Still on a password someone else set: nothing else until they choose their own
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write("{\"status\":403,\"reason\":\"PASSWORD_CHANGE_REQUIRED\","
                    + "\"message\":\"Please choose a new password before continuing.\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private static boolean mustChangePassword() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof AppUserPrincipal p && p.getUser().isMustChangePassword();
    }

    /** @return null when the request is now authenticated, else the reason it isn't */
    private SessionEndReason authenticate(String token, HttpServletRequest request) {
        final String email = jwtService.extractUsername(token);
        UserDetails userDetails = userDetailsService.loadUserByUsername(email);
        if (!jwtService.isTokenValid(token, userDetails.getUsername())) {
            return SessionEndReason.EXPIRED;
        }
        if (!userDetails.isEnabled()) {
            return SessionEndReason.ACCOUNT_DEACTIVATED;
        }
        String sessionId = jwtService.extractSessionId(token);
        Long userId = ((AppUserPrincipal) userDetails).getUser().getId();
        SessionEndReason sessionProblem = sessionService.check(sessionId, userId);
        if (sessionProblem != null) {
            return sessionProblem;
        }

        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                userDetails, null, userDetails.getAuthorities());
        auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(auth);
        request.setAttribute(SESSION_ID_ATTR, sessionId);
        return null;
    }
}
