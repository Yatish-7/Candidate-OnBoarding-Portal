package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse;
import java.net.http.HttpResponse.BodyHandlers;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Base for the API tests. Starts the real app on a random port against the
 * separate {@code intellectt_test} database (see application-test.properties)
 * and calls it over real HTTP, so the security filter, sessions and JSON are
 * exercised exactly as the browser would.
 * <p>
 * Every test creates its own users/teams with unique emails, so tests don't
 * depend on each other or on what is already in the database. Remember that a
 * login ends that user's previous session (one session per user): get each
 * person's token once per test and reuse it.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
public abstract class ApiTestSupport {

    protected static final String SA_EMAIL = "admin@intellectt.com";
    protected static final String SA_PASSWORD = "Admin@123";
    protected static final String PASSWORD = "Test@1234";
    protected static final ObjectMapper JSON = new ObjectMapper();
    private static final HttpClient HTTP = HttpClient.newHttpClient();

    @Value("${local.server.port}")
    protected int port;

    @Autowired
    protected JdbcTemplate jdbc;

    /** An HTTP response: status code and parsed JSON body (MissingNode when empty). */
    protected record Res(int status, JsonNode body) {
        String text(String field) {
            return body.path(field).asText(null);
        }

        long id() {
            return body.path("id").asLong();
        }
    }

    /** A user created for a test, with the password it was created with. */
    protected record Account(long id, String email, String password) {
    }

    /** A team with its Sales Lead and one recruiter. */
    protected record TeamSetup(long teamId, Account lead, Account recruiter) {
    }

    // ---------------------------------------------------------------- HTTP

    protected Res call(String method, String path, String token, Object body) {
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                    .timeout(Duration.ofSeconds(30));
            if (token != null) {
                b.header("Authorization", "Bearer " + token);
            }
            if (body != null) {
                b.header("Content-Type", "application/json");
                b.method(method, BodyPublishers.ofString(JSON.writeValueAsString(body)));
            } else {
                b.method(method, BodyPublishers.noBody());
            }
            HttpResponse<String> r = HTTP.send(b.build(), BodyHandlers.ofString());
            JsonNode node = (r.body() == null || r.body().isBlank()) ? JSON.missingNode() : JSON.readTree(r.body());
            return new Res(r.statusCode(), node);
        } catch (Exception e) {
            throw new IllegalStateException(method + " " + path + " failed", e);
        }
    }

    protected Res get(String path, String token) {
        return call("GET", path, token, null);
    }

    protected Res post(String path, String token, Object body) {
        return call("POST", path, token, body);
    }

    protected Res put(String path, String token, Object body) {
        return call("PUT", path, token, body);
    }

    protected Res delete(String path, String token) {
        return call("DELETE", path, token, null);
    }

    // ------------------------------------------------------------- helpers

    protected String login(String email, String password) {
        Res r = post("/api/auth/login", null, Map.of("email", email, "password", password));
        assertEquals(200, r.status(), () -> "login failed for " + email + ": " + r.body());
        return r.body().get("token").asText();
    }

    protected String login(Account a) {
        return login(a.email(), a.password());
    }

    /** A fresh Super Admin token (ends any earlier Super Admin token). */
    protected String admin() {
        return login(SA_EMAIL, SA_PASSWORD);
    }

    protected static String uniq(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    protected Account createUser(String adminToken, String role, Long teamId) {
        String email = uniq(role.toLowerCase().replace('_', '-')) + "@test.local";
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("fullName", "Test " + role);
        body.put("email", email);
        body.put("password", PASSWORD);
        body.put("role", role);
        if (teamId != null) {
            body.put("team", Map.of("id", teamId));
        }
        Res r = post("/api/users", adminToken, body);
        assertEquals(200, r.status(), () -> "create " + role + " failed: " + r.body());
        // New accounts must replace their admin-set password at first sign-in. Most tests are
        // about other things, so mark it done here (ForcedPasswordChangeApiTest covers the rule).
        jdbc.update("UPDATE users SET must_change_password = false WHERE id = ?", r.id());
        return new Account(r.id(), email, PASSWORD);
    }

    protected long createTeam(String adminToken) {
        Res r = post("/api/teams", adminToken, Map.of("name", uniq("Team")));
        assertEquals(200, r.status(), () -> "create team failed: " + r.body());
        return r.id();
    }

    /** A new team whose Sales Lead and recruiter are both set up. */
    protected TeamSetup newTeam(String adminToken) {
        long teamId = createTeam(adminToken);
        Account lead = createUser(adminToken, "SALES_LEAD", teamId); // becomes the team's lead
        Account recruiter = createUser(adminToken, "RECRUITER", teamId);
        return new TeamSetup(teamId, lead, recruiter);
    }

    /** Submits a candidate as the recruiter; extra fields override the defaults. */
    protected long submitCandidate(String recruiterToken, Map<String, Object> extra) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("candidateName", uniq("Candidate"));
        body.put("internalEntity", "novozen");
        body.put("dojDate", "2026-12-01");
        body.putAll(extra);
        Res r = post("/api/candidates", recruiterToken, body);
        assertEquals(200, r.status(), () -> "submit failed: " + r.body());
        return r.id();
    }

    protected long submitCandidate(String recruiterToken) {
        return submitCandidate(recruiterToken, Map.of());
    }

    /** Runs a workflow action (e.g. "hr/approve") with an optional comment. */
    protected Res act(long candidateId, String action, String token, String comment) {
        String q = comment == null ? "" : "?comment=" + java.net.URLEncoder.encode(comment, java.nio.charset.StandardCharsets.UTF_8);
        return post("/api/candidates/" + candidateId + "/" + action + q, token, null);
    }

    protected JsonNode candidate(long id, String token) {
        Res r = get("/api/candidates/" + id, token);
        assertEquals(200, r.status(), () -> "get candidate failed: " + r.body());
        return r.body();
    }
}
