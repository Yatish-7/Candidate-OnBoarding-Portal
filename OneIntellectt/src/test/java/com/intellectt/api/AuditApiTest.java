package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

/** The audit log: access control, before/after history, and that secrets stay out. */
class AuditApiTest extends ApiTestSupport {

    @Test
    @DisplayName("Only the Super Admin can read the audit log")
    void superAdminOnly() {
        Account adm = createUser(admin(), "ADMIN", null);
        assertEquals(403, get("/api/audit", login(adm)).status());
        assertEquals(401, get("/api/audit", null).status());
        assertEquals(200, get("/api/audit", admin()).status());
    }

    @Test
    @DisplayName("A change is logged with who made it and the before/after values")
    void changesAreLogged() {
        String a = admin();
        String name = uniq("AuditTeam");
        long team = post("/api/teams", a, Map.of("name", name)).id();
        assertEquals(200, put("/api/teams/" + team, a, Map.of("name", name + "-renamed")).status());

        Res list = get("/api/audit?entity=TEAM&q=" + name, a);
        assertEquals(200, list.status());
        JsonNode update = null;
        int forThisTeam = 0;
        for (JsonNode n : list.body().path("content")) {
            if (n.path("entity_id").asText().equals(String.valueOf(team))) {
                forThisTeam++;
                if (n.path("revtype").asInt() == 1) {
                    update = n;
                }
            }
        }
        assertEquals(2, forThisTeam); // created + renamed
        assertTrue(update != null, "update entry missing");
        assertEquals(SA_EMAIL, update.path("username").asText());

        Res detail = get("/api/audit/TEAM/" + team + "/" + update.path("rev").asLong(), a);
        assertEquals(200, detail.status());
        assertEquals(name, detail.body().path("previous").path("name").asText());
        assertEquals(name + "-renamed", detail.body().path("current").path("name").asText());
    }

    @Test
    @DisplayName("SSNs are masked in the audit detail")
    void ssnMasked() {
        String a = admin();
        TeamSetup ts = newTeam(a);
        String candidateName = uniq("SsnCand");
        long id = submitCandidate(login(ts.recruiter()), Map.of("candidateName", candidateName, "ssnNo", "123-45-6789"));
        String sa = admin();
        Res list = get("/api/audit?entity=CANDIDATE&q=" + candidateName, sa);
        long rev = list.body().path("content").get(0).path("rev").asLong();
        Res detail = get("/api/audit/CANDIDATE/" + id + "/" + rev, sa);
        assertEquals("***-**-6789", detail.body().path("current").path("ssn_no").asText());
    }

    @Test
    @DisplayName("Sign-in sessions appear in the log; unknown tables are rejected")
    void sessionsListedAndBadEntityRejected() {
        String a = admin();
        Res sessions = get("/api/audit?entity=SESSION&size=5", a);
        assertEquals(200, sessions.status());
        assertTrue(sessions.body().path("totalElements").asLong() > 0);
        assertEquals(400, get("/api/audit?entity=users_aud", a).status());
        assertEquals(400, get("/api/audit/DROP_TABLE/1/1", a).status());
    }

    @Test
    @DisplayName("Passwords, reset tokens and IPs are never stored in the log")
    void secretsNotLogged() {
        Integer leaks = jdbc.queryForObject(
                "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND ("
                        + "(table_name = 'users_aud' AND column_name = 'password') OR "
                        + "(table_name = 'password_reset_tokens_aud' AND column_name = 'token') OR "
                        + "column_name ILIKE '%ip_address%')",
                Integer.class);
        assertEquals(0, leaks);
    }
}
