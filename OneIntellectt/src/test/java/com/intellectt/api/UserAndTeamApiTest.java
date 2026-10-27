package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

/** User management, the ADMIN role's limits, and team membership rules. */
class UserAndTeamApiTest extends ApiTestSupport {

    @Test
    @DisplayName("Super Admin can create a user of every role")
    void superAdminCreatesEveryRole() {
        String a = admin();
        for (String role : new String[] { "RECRUITER", "SALES_LEAD", "HR", "CONTRACTS", "PAYROLL", "ACCOUNTS", "ADMIN" }) {
            createUser(a, role, null); // asserts 200 inside
        }
    }

    @Test
    @DisplayName("A duplicate email is refused")
    void duplicateEmailRefused() {
        String a = admin();
        Account u = createUser(a, "HR", null);
        Res r = post("/api/users", a, Map.of("fullName", "Dup", "email", u.email(), "password", PASSWORD, "role", "HR"));
        assertEquals(400, r.status());
    }

    @Test
    @DisplayName("Admin manages users but can't create or delete a Super Admin")
    void adminLimits() {
        Account adm = createUser(admin(), "ADMIN", null);
        String t = login(adm);
        createUser(t, "RECRUITER", null);
        Res makeSa = post("/api/users", t, Map.of("fullName", "X", "email", uniq("sa") + "@test.local",
                "password", PASSWORD, "role", "SUPER_ADMIN"));
        assertEquals(403, makeSa.status());

        Res users = get("/api/users", t);
        assertEquals(200, users.status());
        long saId = -1;
        for (JsonNode n : users.body()) {
            if (SA_EMAIL.equals(n.path("email").asText())) {
                saId = n.path("id").asLong();
            }
        }
        assertEquals(403, delete("/api/users/" + saId + "/permanent", t).status());
    }

    @Test
    @DisplayName("Admin sees no candidates and can't open one")
    void adminHasNoCandidateAccess() {
        String a = admin();
        TeamSetup ts = newTeam(a);
        Account adm = createUser(a, "ADMIN", null);
        long cid = submitCandidate(login(ts.recruiter()));
        String t = login(adm);
        Res list = get("/api/candidates", t);
        assertEquals(200, list.status());
        assertEquals(0, list.body().path("totalElements").asInt());
        assertEquals(0, list.body().path("content").size());
        assertEquals(403, get("/api/candidates/" + cid, t).status());
    }

    @Test
    @DisplayName("A recruiter can't list users")
    void recruiterCannotListUsers() {
        Account r = createUser(admin(), "RECRUITER", null);
        assertEquals(403, get("/api/users", login(r)).status());
    }

    @Test
    @DisplayName("Editing a user changes their name and role")
    void editUser() {
        String a = admin();
        Account u = createUser(a, "HR", null);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("fullName", "Renamed Person");
        body.put("email", u.email());
        body.put("role", "CONTRACTS");
        body.put("team", null);
        body.put("active", true);
        Res r = put("/api/users/" + u.id(), a, body);
        assertEquals(200, r.status(), r.body().toString());
        assertEquals("Renamed Person", r.text("fullName"));
        assertEquals("CONTRACTS", r.text("role"));
    }

    @Test
    @DisplayName("Nobody can change their own role")
    void cannotChangeOwnRole() {
        Account adm = createUser(admin(), "ADMIN", null);
        String t = login(adm);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("fullName", "Me");
        body.put("email", adm.email());
        body.put("role", "HR");
        body.put("team", null);
        body.put("active", true);
        assertEquals(400, put("/api/users/" + adm.id(), t, body).status());
    }

    @Test
    @DisplayName("A user who submitted candidates can't be permanently deleted")
    void deleteBlockedWithCandidates() {
        String a = admin();
        TeamSetup ts = newTeam(a);
        submitCandidate(login(ts.recruiter()));
        assertEquals(400, delete("/api/users/" + ts.recruiter().id() + "/permanent", admin()).status());
    }

    @Test
    @DisplayName("A user with sessions and a password-reset request can be permanently deleted")
    void deleteCleansUpSessionsAndResetTokens() {
        String a = admin();
        Account u = createUser(a, "PAYROLL", null);
        login(u);
        post("/api/auth/forgot-password", null, Map.of("email", u.email()));
        assertEquals(204, delete("/api/users/" + u.id() + "/permanent", a).status());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM users WHERE id = ?", Integer.class, u.id()));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE user_id = ?", Integer.class, u.id()));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM password_reset_tokens WHERE user_id = ?", Integer.class, u.id()));
    }

    @Test
    @DisplayName("A recruiter in a team can't be added to another until removed")
    void oneTeamPerRecruiter() {
        String a = admin();
        TeamSetup first = newTeam(a);
        long second = createTeam(a);
        long rec = first.recruiter().id();
        assertEquals(400, post("/api/teams/" + second + "/members/" + rec, a, null).status());
        assertEquals(200, delete("/api/teams/" + first.teamId() + "/members/" + rec, a).status());
        assertEquals(200, post("/api/teams/" + second + "/members/" + rec, a, null).status());
    }

    @Test
    @DisplayName("Only recruiters can be team members")
    void onlyRecruitersAreMembers() {
        String a = admin();
        long team = createTeam(a);
        Account hr = createUser(a, "HR", null);
        assertEquals(400, post("/api/teams/" + team + "/members/" + hr.id(), a, null).status());
    }
}
