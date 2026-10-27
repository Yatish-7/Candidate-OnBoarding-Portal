package com.intellectt.service;

import java.util.Map;

import com.intellectt.model.User;

/** Authenticates a user and issues a JWT. */
public interface AuthService {

    /**
     * Validates the supplied credentials (email + password on the {@link User})
     * and returns the signed token plus basic profile fields.
     */
    Map<String, Object> login(User credentials, String clientIp);

    /** The signed-in user's own profile (for /auth/me), with their Sales Lead / Manager names. */
    Map<String, Object> profile(User user);

    /**
     * Starts a password reset: if an active user with this email exists, a
     * single-use reset link is emailed to them. Returns normally either way so
     * callers can't probe which emails are registered.
     */
    void requestPasswordReset(String email, String clientIp);

    /**
     * A signed-in user changes their own password (required on first sign-in, when an
     * admin set it). Ends their other sessions but keeps {@code sessionId}.
     */
    void changePassword(User actor, String currentPassword, String newPassword, String sessionId);

    /** Completes a password reset using a valid, unexpired, unused token. */
    void resetPassword(String token, String newPassword);

    /**
     * Ends the given sign-in session (no-op if it's unknown or already ended).
     * {@code idle} = the browser signed the user out for inactivity (recorded as such).
     */
    void logout(String sessionId, boolean idle);
}
