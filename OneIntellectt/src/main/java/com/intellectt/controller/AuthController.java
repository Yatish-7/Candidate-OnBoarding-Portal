package com.intellectt.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

import com.intellectt.model.User;
import com.intellectt.security.AppUserPrincipal;
import com.intellectt.security.JwtAuthFilter;
import com.intellectt.service.AuthService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** Body: a User carrying email + password. */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody User credentials, HttpServletRequest request) {
        return ResponseEntity.ok(authService.login(credentials, request.getRemoteAddr()));
    }

    /** Body: { email }. Always returns a generic message (doesn't reveal if the email exists). */
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, Object>> forgotPassword(@RequestBody Map<String, String> body,
            HttpServletRequest request) {
        authService.requestPasswordReset(body.get("email"), request.getRemoteAddr());
        return ResponseEntity.ok(Map.of("message",
                "If an account exists for that email, a password reset link has been sent."));
    }

    /** Body: { token, newPassword }. */
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@RequestBody Map<String, String> body) {
        authService.resetPassword(body.get("token"), body.get("newPassword"));
        return ResponseEntity.ok(Map.of("message",
                "Your password has been reset. You can now sign in with your new password."));
    }

    /**
     * Ends the caller's session. Public, so it succeeds even if the session already ended.
     * {@code ?reason=IDLE_TIMEOUT} marks an automatic sign-out for inactivity; anything
     * else counts as a normal sign-out.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, @RequestParam(required = false) String reason) {
        Object sessionId = request.getAttribute(JwtAuthFilter.SESSION_ID_ATTR);
        if (sessionId != null) {
            authService.logout(sessionId.toString(), "IDLE_TIMEOUT".equals(reason));
        }
        return ResponseEntity.noContent().build();
    }

    /** Body: { currentPassword, newPassword }. The signed-in user changes their own password. */
    @PostMapping("/change-password")
    public ResponseEntity<Map<String, Object>> changePassword(@RequestBody Map<String, String> body,
            @AuthenticationPrincipal AppUserPrincipal principal, HttpServletRequest request) {
        Object sessionId = request.getAttribute(JwtAuthFilter.SESSION_ID_ATTR);
        authService.changePassword(principal.getUser(), body.get("currentPassword"), body.get("newPassword"),
                sessionId == null ? null : sessionId.toString());
        return ResponseEntity.ok(Map.of("message", "Your password has been changed."));
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(@AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(authService.profile(principal.getUser()));
    }
}
