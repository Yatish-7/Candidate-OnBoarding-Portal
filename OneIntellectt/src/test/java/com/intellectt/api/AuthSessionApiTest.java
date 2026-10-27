package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Login, logout, password reset and the server-side session rules. */
class AuthSessionApiTest extends ApiTestSupport {

    private String reasonOf(Res r) {
        return r.text("reason");
    }

    @Test
    @DisplayName("Login returns a token and the idle timeout")
    void loginReturnsTokenAndIdleTimeout() {
        Res r = post("/api/auth/login", null, Map.of("email", SA_EMAIL, "password", SA_PASSWORD));
        assertEquals(200, r.status());
        assertFalse(r.text("token").isBlank());
        assertEquals(30, r.body().path("idleTimeoutMinutes").asInt());
        assertEquals("SUPER_ADMIN", r.text("role"));
    }

    @Test
    @DisplayName("Wrong password and unknown email are both refused")
    void badCredentialsAreRefused() {
        assertEquals(403, post("/api/auth/login", null, Map.of("email", SA_EMAIL, "password", "nope")).status());
        assertEquals(403, post("/api/auth/login", null,
                Map.of("email", "nobody-" + uniq("x") + "@test.local", "password", "x")).status());
    }

    @Test
    @DisplayName("No token or a garbage token gets 401 (not 403)")
    void missingOrBadTokenGets401() {
        Res none = get("/api/auth/me", null);
        assertEquals(401, none.status());
        assertEquals("INVALID", reasonOf(none));
        Res garbage = get("/api/auth/me", "not.a.jwt");
        assertEquals(401, garbage.status());
        assertEquals("INVALID", reasonOf(garbage));
    }

    @Test
    @DisplayName("Signing in again ends the previous session")
    void oneSessionPerUser() {
        Account u = createUser(admin(), "RECRUITER", null);
        String first = login(u);
        String second = login(u);
        Res old = get("/api/auth/me", first);
        assertEquals(401, old.status());
        assertEquals("SIGNED_IN_ELSEWHERE", reasonOf(old));
        assertEquals(200, get("/api/auth/me", second).status());
    }

    @Test
    @DisplayName("Logout ends the session on the server, and repeating it is harmless")
    void logoutRevokesToken() {
        Account u = createUser(admin(), "HR", null);
        String t = login(u);
        assertEquals(204, post("/api/auth/logout", t, null).status());
        Res after = get("/api/auth/me", t);
        assertEquals(401, after.status());
        assertEquals("SIGNED_OUT", reasonOf(after));
        assertEquals(204, post("/api/auth/logout", t, null).status());
    }

    @Test
    @DisplayName("An automatic idle sign-out is recorded as IDLE_TIMEOUT")
    void idleLogoutReasonIsRecorded() {
        Account u = createUser(admin(), "PAYROLL", null);
        String t = login(u);
        assertEquals(204, post("/api/auth/logout?reason=IDLE_TIMEOUT", t, null).status());
        String reason = jdbc.queryForObject(
                "SELECT end_reason FROM user_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
                String.class, u.id());
        assertEquals("IDLE_TIMEOUT", reason);
    }

    @Test
    @DisplayName("A session idle longer than the timeout is rejected")
    void idleSessionIsRejected() {
        Account u = createUser(admin(), "ACCOUNTS", null);
        String t = login(u);
        assertEquals(200, get("/api/auth/me", t).status());
        // Pretend the last request was two hours ago (timeout is 30 minutes)
        jdbc.update("UPDATE user_sessions SET last_activity_at = now() - interval '2 hours' WHERE user_id = ?", u.id());
        Res r = get("/api/auth/me", t);
        assertEquals(401, r.status());
        assertEquals("IDLE_TIMEOUT", reasonOf(r));
    }

    @Test
    @DisplayName("Deactivating a user ends their session at once and blocks login with a clear message")
    void deactivationRevokesAndBlocks() {
        String a = admin();
        Account u = createUser(a, "CONTRACTS", null);
        String t = login(u);
        assertEquals(204, delete("/api/users/" + u.id(), a).status());
        Res r = get("/api/auth/me", t);
        assertEquals(401, r.status());
        assertEquals("ACCOUNT_DEACTIVATED", reasonOf(r));
        Res relog = post("/api/auth/login", null, Map.of("email", u.email(), "password", u.password()));
        assertEquals(403, relog.status());
        assertTrue(relog.text("message").contains("deactivated"), relog.body().toString());
    }

    @Test
    @DisplayName("Password reset: link works once, signs the user out everywhere, new password works")
    void passwordResetFlow() {
        Account u = createUser(admin(), "RECRUITER", null);
        String t = login(u);
        assertEquals(200, post("/api/auth/forgot-password", null, Map.of("email", u.email())).status());
        String token = jdbc.queryForObject(
                "SELECT token FROM password_reset_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1", String.class, u.id());

        assertEquals(200, post("/api/auth/reset-password", null, Map.of("token", token, "newPassword", "NewPass@99")).status());
        Res old = get("/api/auth/me", t);
        assertEquals(401, old.status());
        assertEquals("PASSWORD_RESET", reasonOf(old));

        assertEquals(403, post("/api/auth/login", null, Map.of("email", u.email(), "password", u.password())).status());
        login(u.email(), "NewPass@99");
        // The link can't be used twice
        assertEquals(400, post("/api/auth/reset-password", null, Map.of("token", token, "newPassword", "Other@123")).status());
    }

    @Test
    @DisplayName("Forgot-password gives the same answer for unknown emails (no account probing)")
    void forgotPasswordDoesNotRevealAccounts() {
        Account u = createUser(admin(), "HR", null);
        Res known = post("/api/auth/forgot-password", null, Map.of("email", u.email()));
        Res unknown = post("/api/auth/forgot-password", null, Map.of("email", uniq("ghost") + "@test.local"));
        assertEquals(200, known.status());
        assertEquals(200, unknown.status());
        assertEquals(known.text("message"), unknown.text("message"));
    }

    @Test
    @DisplayName("Reset rejects a bad token and a too-short password")
    void resetValidation() {
        assertEquals(400, post("/api/auth/reset-password", null, Map.of("token", "bogus", "newPassword", "Valid@123")).status());
        assertEquals(400, post("/api/auth/reset-password", null, Map.of("token", "bogus", "newPassword", "123")).status());
    }
}
