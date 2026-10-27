package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse;
import java.net.http.HttpResponse.BodyHandlers;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Attack-style checks: SQL injection, stored XSS, password guessing, access to other
 * people's data, tampered tokens, bad input, and the security headers.
 */
class SecurityApiTest extends ApiTestSupport {

    private static final HttpClient RAW = HttpClient.newHttpClient();

    /** A request that looks like it came from {@code ip} (via the trusted local proxy header). */
    private HttpResponse<String> raw(String method, String path, String token, String json, String ip) {
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
            if (token != null) {
                b.header("Authorization", "Bearer " + token);
            }
            if (ip != null) {
                b.header("X-Forwarded-For", ip);
            }
            if (json != null) {
                b.header("Content-Type", "application/json").method(method, BodyPublishers.ofString(json));
            } else {
                b.method(method, BodyPublishers.noBody());
            }
            return RAW.send(b.build(), BodyHandlers.ofString());
        } catch (Exception e) {
            throw new IllegalStateException(method + " " + path + " failed", e);
        }
    }

    private HttpResponse<String> loginFrom(String ip, String email, String password) {
        try {
            return raw("POST", "/api/auth/login", null,
                    JSON.writeValueAsString(Map.of("email", email, "password", password)), ip);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** A made-up client IP, different for every test run. */
    private static String randomIp() {
        ThreadLocalRandom r = ThreadLocalRandom.current();
        return "203." + r.nextInt(256) + "." + r.nextInt(256) + "." + r.nextInt(1, 255);
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    // ------------------------------------------------------------ SQL injection

    @Test
    @DisplayName("SQL injection in search, filters and the audit log is treated as plain text")
    void sqlInjectionIsInert() {
        String a = admin();
        long usersBefore = jdbc.queryForObject("SELECT count(*) FROM users", Long.class);
        String[] payloads = { "' OR '1'='1", "'; DROP TABLE users; --", "\" OR 1=1 --",
                "1' UNION SELECT password FROM users --", "%", "_" };
        for (String p : payloads) {
            Res list = get("/api/candidates?search=" + enc(p), a);
            assertEquals(200, list.status(), p);
            assertEquals(0, list.body().path("totalElements").asLong(), "search matched rows for: " + p);
            assertEquals(200, get("/api/audit?q=" + enc(p) + "&user=" + enc(p), a).status(), p);
        }
        // A status filter only accepts the known values
        assertEquals(400, get("/api/candidates?status=" + enc("' OR 1=1 --"), a).status());
        // Nothing was dropped or changed
        assertEquals(usersBefore, jdbc.queryForObject("SELECT count(*) FROM users", Long.class));
    }

    // ------------------------------------------------------------ XSS

    @Test
    @DisplayName("Script in a candidate field is stored and returned as plain JSON text, never as HTML")
    void storedXssComesBackAsText() throws Exception {
        TeamSetup t = newTeam(admin());
        String rec = login(t.recruiter());
        String evil = "<script>alert('x')</script><img src=x onerror=alert(1)>";
        long id = submitCandidate(rec, Map.of("candidateName", evil, "clientName", evil));

        HttpResponse<String> r = raw("GET", "/api/candidates/" + id, rec, null, null);
        assertEquals(200, r.statusCode());
        assertTrue(r.headers().firstValue("Content-Type").orElse("").startsWith("application/json"));
        assertEquals("nosniff", r.headers().firstValue("X-Content-Type-Options").orElse(null));
        assertEquals(evil, JSON.readTree(r.body()).path("candidateName").asText());
    }

    // ------------------------------------------------------------ headers

    @Test
    @DisplayName("Every API response carries the security headers")
    void securityHeaders() {
        for (HttpResponse<String> r : new HttpResponse[] {
                raw("GET", "/api/auth/me", admin(), null, null),
                raw("GET", "/api/auth/me", null, null, null) }) {
            assertEquals("default-src 'none'; frame-ancestors 'none'",
                    r.headers().firstValue("Content-Security-Policy").orElse(null));
            assertEquals("DENY", r.headers().firstValue("X-Frame-Options").orElse(null));
            assertEquals("nosniff", r.headers().firstValue("X-Content-Type-Options").orElse(null));
            assertEquals("no-referrer", r.headers().firstValue("Referrer-Policy").orElse(null));
            assertNotNull(r.headers().firstValue("Permissions-Policy").orElse(null));
            assertTrue(r.headers().firstValue("Cache-Control").orElse("").contains("no-store"));
        }
    }

    // ------------------------------------------------------------ password guessing

    @Test
    @DisplayName("5 wrong passwords lock the account from that IP only; the real user can still sign in elsewhere")
    void bruteForceLockout() {
        Account u = createUser(admin(), "HR", null);
        String attacker = randomIp();
        for (int i = 0; i < 5; i++) {
            assertEquals(403, loginFrom(attacker, u.email(), "Wrong" + i + "pass").statusCode());
        }
        // Locked: even the right password is refused from the attacker's IP
        HttpResponse<String> locked = loginFrom(attacker, u.email(), u.password());
        assertEquals(429, locked.statusCode());
        assertTrue(locked.headers().firstValue("Retry-After").isPresent());
        // ...but the real user, elsewhere, gets in
        assertEquals(200, loginFrom(randomIp(), u.email(), u.password()).statusCode());
    }

    @Test
    @DisplayName("One IP trying many accounts is blocked after 50 failures")
    void perIpLimit() {
        String ip = randomIp();
        for (int i = 0; i < 50; i++) {
            assertEquals(403, loginFrom(ip, uniq("nobody") + "@test.local", "Guess" + i + "x").statusCode());
        }
        assertEquals(429, loginFrom(ip, SA_EMAIL, SA_PASSWORD).statusCode());
    }

    @Test
    @DisplayName("Password reset requests are rate limited per IP")
    void resetRateLimit() throws Exception {
        String ip = randomIp();
        String body = JSON.writeValueAsString(Map.of("email", uniq("nobody") + "@test.local"));
        for (int i = 0; i < 20; i++) {
            assertEquals(200, raw("POST", "/api/auth/forgot-password", null, body, ip).statusCode());
        }
        assertEquals(429, raw("POST", "/api/auth/forgot-password", null, body, ip).statusCode());
    }

    @Test
    @DisplayName("A deactivated account is only revealed to someone who knows its password")
    void deactivatedNotEnumerable() {
        String a = admin();
        Account u = createUser(a, "PAYROLL", null);
        assertEquals(204, delete("/api/users/" + u.id(), a).status());
        Res wrong = post("/api/auth/login", null, Map.of("email", u.email(), "password", "Wrong123x"));
        assertEquals(403, wrong.status());
        assertEquals("Invalid email or password", wrong.text("message"));
        Res right = post("/api/auth/login", null, Map.of("email", u.email(), "password", u.password()));
        assertTrue(right.text("message").contains("deactivated"));
    }

    // ------------------------------------------------------------ access control

    @Test
    @DisplayName("Only admins and Sales Leads can list users by role or see teams, and a lead sees only their team")
    void teamAndRoleListAccess() {
        String a = admin();
        TeamSetup mine = newTeam(a);
        TeamSetup other = newTeam(a);
        String lead = login(mine.lead());
        String rec = login(mine.recruiter());
        String hr = login(createUser(a, "HR", null));

        assertEquals(403, get("/api/users/by-role/HR", rec).status());
        assertEquals(403, get("/api/users/by-role/RECRUITER", hr).status());
        assertEquals(403, get("/api/users/by-role/SUPER_ADMIN", lead).status());
        assertEquals(200, get("/api/users/by-role/RECRUITER", lead).status());

        assertEquals(403, get("/api/teams", rec).status());
        assertEquals(403, get("/api/teams", hr).status());
        Res leadTeams = get("/api/teams", lead);
        assertEquals(200, leadTeams.status());
        assertEquals(1, leadTeams.body().size());
        assertEquals(mine.teamId(), leadTeams.body().get(0).path("id").asLong());
        assertEquals(200, get("/api/teams/" + mine.teamId(), lead).status());
        assertEquals(403, get("/api/teams/" + other.teamId(), lead).status());
        assertTrue(get("/api/teams", a).body().size() >= 2);
    }

    @Test
    @DisplayName("A recruiter can't open another team's candidate by guessing its id")
    void noIdGuessing() {
        String a = admin();
        TeamSetup t1 = newTeam(a);
        TeamSetup t2 = newTeam(a);
        long id = submitCandidate(login(t1.recruiter()));
        int status = get("/api/candidates/" + id, login(t2.recruiter())).status();
        assertTrue(status == 403 || status == 404, "got " + status);
    }

    // ------------------------------------------------------------ tokens

    @Test
    @DisplayName("Tampered, unsigned and garbage tokens are rejected")
    void forgedTokens() throws Exception {
        TeamSetup t = newTeam(admin());
        String token = login(t.recruiter());
        String[] parts = token.split("\\.");
        Base64.Decoder dec = Base64.getUrlDecoder();
        Base64.Encoder enc = Base64.getUrlEncoder().withoutPadding();

        // Promote ourselves to Super Admin in the payload, keep the old signature
        String payload = new String(dec.decode(parts[1]), StandardCharsets.UTF_8)
                .replace("\"RECRUITER\"", "\"SUPER_ADMIN\"");
        String promoted = parts[0] + "." + enc.encodeToString(payload.getBytes(StandardCharsets.UTF_8)) + "." + parts[2];
        assertEquals(401, get("/api/auth/me", promoted).status());

        // "alg": "none" with no signature
        String none = enc.encodeToString("{\"alg\":\"none\"}".getBytes(StandardCharsets.UTF_8)) + "."
                + enc.encodeToString(payload.getBytes(StandardCharsets.UTF_8)) + ".";
        assertEquals(401, get("/api/auth/me", none).status());

        assertEquals(401, get("/api/auth/me", "not-a-token").status());
        assertEquals(200, get("/api/auth/me", token).status());
    }

    // ------------------------------------------------------------ input validation

    @Test
    @DisplayName("Weak passwords and invalid emails are refused by the server")
    void credentialRules() {
        String a = admin();
        for (String weak : new String[] { "short1", "lettersonly", "12345678" }) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("fullName", "Weak");
            body.put("email", uniq("weak") + "@test.local");
            body.put("password", weak);
            body.put("role", "HR");
            assertEquals(400, post("/api/users", a, body).status(), weak);
        }
        for (String email : new String[] { "not-an-email", "<script>@x.com", "a b@x.com" }) {
            Map<String, Object> body = Map.of("fullName", "Bad", "email", email, "password", PASSWORD, "role", "HR");
            assertEquals(400, post("/api/users", a, body).status(), email);
        }
        assertEquals(400, post("/api/auth/reset-password", null,
                Map.of("token", "whatever", "newPassword", "weak")).status());
    }

    @Test
    @DisplayName("Oversized, malformed and wrongly typed input gets 400 (not a server error); unknown URLs 404")
    void badInput() {
        TeamSetup t = newTeam(admin());
        String rec = login(t.recruiter());
        Res big = post("/api/candidates", rec, Map.of("candidateName", "x".repeat(5000)));
        assertEquals(400, big.status(), big.body().toString());

        HttpResponse<String> malformed = raw("POST", "/api/candidates", rec, "{not json", null);
        assertEquals(400, malformed.statusCode());
        assertEquals(400, get("/api/users/by-role/NOT_A_ROLE", admin()).status());
        assertEquals(404, get("/api/does-not-exist", rec).status());

        // Error responses never leak internals
        JsonNode body = big.body();
        String text = body.toString().toLowerCase();
        assertTrue(!text.contains("sql") && !text.contains("exception") && !text.contains("org."), text);
    }
}
