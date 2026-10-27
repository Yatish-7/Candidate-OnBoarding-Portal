package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Unauthorized role access and privilege escalation: every role is tried against every
 * kind of endpoint, and each one must get exactly the access its job needs.
 */
class RoleAccessApiTest extends ApiTestSupport {

    /** Role name -> token. R2/SL2 are a recruiter and Sales Lead of a second team. */
    private final Map<String, String> tokens = new LinkedHashMap<>();
    private TeamSetup team1;
    private TeamSetup team2;
    private Account hrAccount;

    @BeforeEach
    void signInEveryRole() {
        String sa = admin();
        team1 = newTeam(sa);
        team2 = newTeam(sa);
        hrAccount = createUser(sa, "HR", null);
        tokens.put("RECRUITER", login(team1.recruiter()));
        tokens.put("SALES_LEAD", login(team1.lead()));
        tokens.put("R2", login(team2.recruiter()));
        tokens.put("SL2", login(team2.lead()));
        tokens.put("HR", login(hrAccount));
        tokens.put("CONTRACTS", login(createUser(sa, "CONTRACTS", null)));
        tokens.put("PAYROLL", login(createUser(sa, "PAYROLL", null)));
        tokens.put("ACCOUNTS", login(createUser(sa, "ACCOUNTS", null)));
        tokens.put("ADMIN", login(createUser(sa, "ADMIN", null)));
        tokens.put("SUPER_ADMIN", admin());
    }

    /** Calls the endpoint as every role; those in {@code allowed} must get 2xx, the rest 403. */
    private void onlyAllowed(String what, Set<String> allowed, java.util.function.Function<String, Res> call) {
        for (Map.Entry<String, String> e : tokens.entrySet()) {
            int status = call.apply(e.getValue()).status();
            if (allowed.contains(e.getKey())) {
                assertTrue(status >= 200 && status < 300, what + ": " + e.getKey() + " should be allowed, got " + status);
            } else {
                assertEquals(403, status, what + ": " + e.getKey() + " should be refused");
            }
        }
    }

    @Test
    @DisplayName("Admin pages: users, teams and the audit log are only for the roles that manage them")
    void adminEndpoints() {
        onlyAllowed("list users", Set.of("SUPER_ADMIN", "ADMIN", "SALES_LEAD", "SL2"), t -> get("/api/users", t));
        onlyAllowed("list teams", Set.of("SUPER_ADMIN", "ADMIN", "SALES_LEAD", "SL2"), t -> get("/api/teams", t));
        onlyAllowed("audit log", Set.of("SUPER_ADMIN"), t -> get("/api/audit", t));
        onlyAllowed("create user", Set.of("SUPER_ADMIN", "ADMIN"), t -> post("/api/users", t, Map.of(
                "fullName", "Matrix", "email", uniq("matrix") + "@test.local", "password", PASSWORD, "role", "RECRUITER")));
        onlyAllowed("create team", Set.of("SUPER_ADMIN", "ADMIN"), t -> post("/api/teams", t, Map.of("name", uniq("Team"))));
        onlyAllowed("deactivate user", Set.of("SUPER_ADMIN", "ADMIN"), t -> {
            Account victim = createUser(tokens.get("SUPER_ADMIN"), "PAYROLL", null);
            return delete("/api/users/" + victim.id(), t);
        });
    }

    @Test
    @DisplayName("Candidates: only the submitter, their Sales Lead and the Super Admin see a new one; only a Recruiter submits")
    void candidateVisibility() {
        long id = submitCandidate(tokens.get("RECRUITER"));
        onlyAllowed("open new candidate", Set.of("RECRUITER", "SALES_LEAD", "SUPER_ADMIN"),
                t -> get("/api/candidates/" + id, t));
        onlyAllowed("its trail", Set.of("RECRUITER", "SALES_LEAD", "SUPER_ADMIN"),
                t -> get("/api/candidates/" + id + "/trail", t));
        onlyAllowed("submit", Set.of("RECRUITER", "R2"), t -> post("/api/candidates", t, Map.of("candidateName", uniq("C"))));
        // The Admin role sees no candidates at all
        assertEquals(0, get("/api/candidates", tokens.get("ADMIN")).body().path("totalElements").asLong());
    }

    @Test
    @DisplayName("Workflow steps: each can only be taken by its own role (and team)")
    void workflowActions() {
        long id = submitCandidate(tokens.get("RECRUITER"));
        tokens.forEach((role, t) -> {
            if (!role.equals("SUPER_ADMIN")) {
                assertEquals(403, act(id, "override/approve", t, "matrix").status(), "override by " + role);
            }
        });
        onlyAllowed("Sales Lead approve", Set.of("SALES_LEAD"), t -> act(id, "sales-lead/approve", t, null));
        onlyAllowed("HR approve", Set.of("HR"), t -> act(id, "hr/approve", t, null));
        onlyAllowed("Contracts approve", Set.of("CONTRACTS"), t -> act(id, "contracts/approve", t, null));
        long other = submitCandidate(tokens.get("R2"));
        assertEquals(200, act(other, "override/approve", tokens.get("SUPER_ADMIN"), "matrix").status());
    }

    // ------------------------------------------------------------ privilege escalation

    @Test
    @DisplayName("HR and Sales Leads can't create or edit accounts (e.g. to take over one by setting its password)")
    void noAccountTakeoverByNonAdmins() {
        String hr = tokens.get("HR");
        String lead = tokens.get("SALES_LEAD");
        Map<String, Object> newRecruiter = Map.of("fullName", "X", "email", uniq("x") + "@test.local",
                "password", PASSWORD, "role", "RECRUITER");
        assertEquals(403, post("/api/users", hr, newRecruiter).status());
        assertEquals(403, post("/api/users", lead, newRecruiter).status());

        Map<String, Object> takeover = new LinkedHashMap<>();
        takeover.put("fullName", "Hijacked");
        takeover.put("email", team1.lead().email());
        takeover.put("role", "SALES_LEAD");
        takeover.put("active", true);
        takeover.put("password", "Hijack123");
        assertEquals(403, put("/api/users/" + team1.lead().id(), hr, takeover).status());
        takeover.put("email", team2.recruiter().email());
        takeover.put("role", "RECRUITER");
        assertEquals(403, put("/api/users/" + team2.recruiter().id(), lead, takeover).status());
        assertEquals(403, delete("/api/users/" + team2.recruiter().id(), lead).status());
        // The victims' passwords still work
        login(team2.recruiter());
    }

    @Test
    @DisplayName("Nobody can promote themselves or anyone else above their own level")
    void noPromotion() {
        String adminToken = tokens.get("ADMIN");
        JsonNode me = get("/api/auth/me", adminToken).body();
        Map<String, Object> self = new LinkedHashMap<>();
        self.put("fullName", me.path("fullName").asText());
        self.put("email", me.path("email").asText());
        self.put("role", "SUPER_ADMIN");
        self.put("active", true);
        int status = put("/api/users/" + me.path("id").asLong(), adminToken, self).status();
        assertTrue(status == 400 || status == 403, "self-promotion got " + status);

        Map<String, Object> other = new LinkedHashMap<>();
        other.put("fullName", "Promoted");
        other.put("email", hrAccount.email());
        other.put("role", "SUPER_ADMIN");
        other.put("active", true);
        assertEquals(403, put("/api/users/" + hrAccount.id(), adminToken, other).status());
        assertEquals("HR", jdbc.queryForObject("SELECT role FROM users WHERE id = ?", String.class, hrAccount.id()));
    }

    @Test
    @DisplayName("Fields only the server sets can't be smuggled in a request")
    void noMassAssignment() {
        // A new user can't skip the first-sign-in password change or fake a sign-in time
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("fullName", "Sneaky");
        body.put("email", uniq("sneaky") + "@test.local");
        body.put("password", PASSWORD);
        body.put("role", "HR");
        body.put("mustChangePassword", false);
        body.put("lastLoginAt", "2020-01-01T00:00:00Z");
        Res created = post("/api/users", tokens.get("SUPER_ADMIN"), body);
        assertEquals(200, created.status());
        assertEquals(Boolean.TRUE, jdbc.queryForObject(
                "SELECT must_change_password FROM users WHERE id = ?", Boolean.class, created.id()));
        assertTrue(jdbc.queryForList("SELECT 1 FROM users WHERE id = ? AND last_login_at IS NOT NULL",
                created.id()).isEmpty());

        // A recruiter can't submit a candidate as already approved, or as someone else's
        Map<String, Object> cand = new LinkedHashMap<>();
        cand.put("candidateName", uniq("Forged"));
        cand.put("status", "COMPLETED");
        cand.put("hrDecision", "APPROVED");
        cand.put("contractsDecision", "APPROVED");
        cand.put("submittedBy", Map.of("id", team2.recruiter().id()));
        cand.put("team", Map.of("id", team2.teamId()));
        Res r = post("/api/candidates", tokens.get("RECRUITER"), cand);
        assertEquals(200, r.status());
        assertEquals("PENDING_SALES_LEAD_APPROVAL", r.text("status"));
        assertEquals(team1.recruiter().id(), r.body().path("submittedBy").path("id").asLong());
        assertEquals(team1.teamId(), r.body().path("team").path("id").asLong());
    }

    @Test
    @DisplayName("Sales Leads only manage their own team's members")
    void leadsStayInTheirTeam() {
        String lead = tokens.get("SALES_LEAD");
        Account free = createUser(tokens.get("SUPER_ADMIN"), "RECRUITER", null);
        assertEquals(403, post("/api/teams/" + team2.teamId() + "/members/" + free.id(), lead, null).status());
        assertEquals(403, delete("/api/teams/" + team2.teamId() + "/members/" + team2.recruiter().id(), lead).status());
        assertEquals(403, put("/api/teams/" + team1.teamId() + "/sales-lead/" + team2.lead().id(), lead, null).status());
        assertEquals(200, post("/api/teams/" + team1.teamId() + "/members/" + free.id(), lead, null).status());
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT team_id FROM users WHERE id = ?", team2.recruiter().id());
        assertEquals(team2.teamId(), ((Number) rows.get(0).get("team_id")).longValue());
    }
}
