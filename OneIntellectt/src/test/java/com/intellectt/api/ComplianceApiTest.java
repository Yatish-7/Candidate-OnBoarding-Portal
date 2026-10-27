package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * ISO 27001-style controls: personal data protected at rest and in responses,
 * temporary passwords replaced at first use, and security events logged.
 */
class ComplianceApiTest extends ApiTestSupport {

    @Test
    @DisplayName("The SSN is stored encrypted (also in the history) and the API only ever returns the last 4 digits")
    void ssnEncryptedAndMasked() {
        TeamSetup t = newTeam(admin());
        String rec = login(t.recruiter());
        long id = submitCandidate(rec, Map.of("ssnNo", "123-45-6789"));

        JsonNode c = candidate(id, rec);
        assertTrue(c.path("ssnNo").isMissingNode(), "full SSN must not be returned: " + c);
        assertEquals("***-**-6789", c.path("ssnMasked").asText());

        String stored = jdbc.queryForObject("SELECT ssn_no FROM candidates WHERE id = ?", String.class, id);
        assertTrue(stored.startsWith("enc:v1:"), stored);
        assertFalse(stored.contains("6789"));
        String history = jdbc.queryForObject(
                "SELECT ssn_no FROM candidates_aud WHERE id = ? ORDER BY rev DESC LIMIT 1", String.class, id);
        assertTrue(history.startsWith("enc:v1:"), history);

        // Even the Super Admin's list and audit views show it masked
        String sa = admin();
        assertEquals("***-**-6789", candidate(id, sa).path("ssnMasked").asText());
        Res audit = get("/api/audit?entity=CANDIDATE&q=" + c.path("candidateName").asText(), sa);
        long rev = audit.body().path("content").get(0).path("rev").asLong();
        String detail = get("/api/audit/CANDIDATE/" + id + "/" + rev, sa).body().toString();
        assertTrue(detail.contains("***-**-6789") && !detail.contains("enc:v1:") && !detail.contains("123-45"), detail);
    }

    @Test
    @DisplayName("A new account must replace its admin-set password before it can do anything else")
    void temporaryPasswordMustBeChanged() {
        String sa = admin();
        Map<String, Object> body = Map.of("fullName", "New Starter", "email", uniq("starter") + "@test.local",
                "password", PASSWORD, "role", "HR");
        Res created = post("/api/users", sa, body);
        assertEquals(200, created.status());
        String email = (String) body.get("email");

        Res login = post("/api/auth/login", null, Map.of("email", email, "password", PASSWORD));
        assertEquals(200, login.status());
        assertTrue(login.body().path("mustChangePassword").asBoolean());
        String token = login.text("token");

        // Locked to the password change until it's done
        Res blocked = get("/api/candidates", token);
        assertEquals(403, blocked.status());
        assertEquals("PASSWORD_CHANGE_REQUIRED", blocked.text("reason"));
        assertEquals(200, get("/api/auth/me", token).status());

        assertEquals(400, post("/api/auth/change-password", token,
                Map.of("currentPassword", "Wrong1234", "newPassword", "Mine12345")).status());
        assertEquals(400, post("/api/auth/change-password", token,
                Map.of("currentPassword", PASSWORD, "newPassword", PASSWORD)).status());
        assertEquals(400, post("/api/auth/change-password", token,
                Map.of("currentPassword", PASSWORD, "newPassword", "weak")).status());
        assertEquals(200, post("/api/auth/change-password", token,
                Map.of("currentPassword", PASSWORD, "newPassword", "Mine12345")).status());

        // Same session keeps working, and the new password is the one that signs in
        assertEquals(200, get("/api/candidates", token).status());
        assertFalse(get("/api/auth/me", token).body().path("mustChangePassword").asBoolean());
        assertEquals(403, post("/api/auth/login", null, Map.of("email", email, "password", PASSWORD)).status());
        login(email, "Mine12345");

        // An admin setting a new password makes it temporary again
        Map<String, Object> reset = new java.util.LinkedHashMap<>();
        reset.put("fullName", "New Starter");
        reset.put("email", email);
        reset.put("role", "HR");
        reset.put("active", true);
        reset.put("password", "AdminSet123");
        assertEquals(200, put("/api/users/" + created.id(), admin(), reset).status());
        assertTrue(post("/api/auth/login", null, Map.of("email", email, "password", "AdminSet123"))
                .body().path("mustChangePassword").asBoolean());
    }

    @Test
    @DisplayName("Each sign-in time is recorded, for access reviews")
    void lastSignInRecorded() {
        Account u = createUser(admin(), "ACCOUNTS", null);
        assertTrue(jdbc.queryForList("SELECT 1 FROM users WHERE id = ? AND last_login_at IS NOT NULL", u.id()).isEmpty());
        login(u);
        assertNotNull(jdbc.queryForObject("SELECT last_login_at FROM users WHERE id = ?", Object.class, u.id()));
        assertTrue(get("/api/users", admin()).body().toString().contains("lastLoginAt"));
    }

    @Test
    @DisplayName("Sign-in failures, lock-outs and refused access go to the security log, without IPs or passwords")
    void securityEventsAreLogged() throws Exception {
        String probe = uniq("probe") + "@test.local";
        post("/api/auth/login", null, Map.of("email", probe, "password", "NotThePass1"));
        TeamSetup t = newTeam(admin());
        get("/api/audit", login(t.recruiter())); // refused

        Path log = Path.of("logs", "security.log");
        String text = "";
        for (int i = 0; i < 20 && !text.contains(probe); i++) { // the file appender may lag a moment
            Thread.sleep(100);
            text = Files.exists(log) ? Files.readString(log, StandardCharsets.UTF_8) : "";
        }
        assertTrue(text.contains("LOGIN_FAILED user=" + probe), "missing failed sign-in");
        assertTrue(text.contains("ACCESS_DENIED user=" + t.recruiter().email()), "missing refused access");
        assertFalse(text.contains("NotThePass1"), "a password was logged");
        assertFalse(text.matches("(?s).*\\b127\\.0\\.0\\.1\\b.*"), "an IP address was logged");
    }
}
