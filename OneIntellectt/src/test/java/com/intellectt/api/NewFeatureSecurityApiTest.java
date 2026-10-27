package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.verify;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.fasterxml.jackson.databind.JsonNode;
import com.intellectt.model.User;
import com.intellectt.model.enums.Role;
import com.intellectt.service.EmailService;

/**
 * Security checks for the newer endpoints: HR editing, rate changes, the project end date approval,
 * the team list for the intake form, plus injection / XSS / mass-assignment attempts. The email service
 * is a mock, so nothing is sent.
 */
class NewFeatureSecurityApiTest extends ApiTestSupport {

    @MockitoBean
    EmailService emailService;

    private final Map<String, String> tokens = new LinkedHashMap<>();
    private TeamSetup team1;
    private TeamSetup team2;
    private Account manager;
    private long candidateId;

    @BeforeEach
    void setUp() {
        String sa = admin();
        team1 = newTeam(sa);
        team2 = newTeam(sa);
        manager = createUser(sa, "SALES_MANAGER", null);
        assertEquals(200, put("/api/teams/" + team1.teamId() + "/sales-manager/" + manager.id(), sa, null).status());
        tokens.put("RECRUITER", login(team1.recruiter()));
        tokens.put("SALES_LEAD", login(team1.lead()));
        tokens.put("SALES_MANAGER", login(manager));
        tokens.put("R2", login(team2.recruiter()));
        tokens.put("SL2", login(team2.lead()));
        tokens.put("HR", login(createUser(sa, "HR", null)));
        tokens.put("CONTRACTS", login(createUser(sa, "CONTRACTS", null)));
        tokens.put("PAYROLL", login(createUser(sa, "PAYROLL", null)));
        tokens.put("ACCOUNTS", login(createUser(sa, "ACCOUNTS", null)));
        tokens.put("ADMIN", login(createUser(sa, "ADMIN", null)));
        tokens.put("SUPER_ADMIN", admin());

        candidateId = submitCandidate(tokens.get("RECRUITER"), Map.of("billRate", "100", "payRate", "70"));
        act(candidateId, "sales-lead/approve", tokens.get("SALES_LEAD"), null);
        act(candidateId, "doj/approve", tokens.get("SALES_LEAD"), null);
        clearInvocations(emailService);
    }

    private void refuseEveryoneExcept(String what, List<String> allowed, Function<String, Res> call) {
        for (Map.Entry<String, String> e : tokens.entrySet()) {
            if (!allowed.contains(e.getKey())) {
                assertEquals(403, call.apply(e.getValue()).status(), what + ": " + e.getKey() + " must be refused");
            }
        }
    }

    // ------------------------------------------------------------------ authentication / authorization

    @Test
    @DisplayName("The newer endpoints need a sign-in")
    void needSignIn() {
        String c = "/api/candidates/" + candidateId;
        assertEquals(401, put(c, null, Map.of("candidateName", "x")).status());
        assertEquals(401, post(c + "/rates?billRate=1&comment=x", null, null).status());
        assertEquals(401, post(c + "/project-end?date=2027-06-30", null, null).status());
        assertEquals(401, post(c + "/project-end/approve", null, null).status());
        assertEquals(401, post(c + "/project-end/decline?comment=x", null, null).status());
        assertEquals(401, get("/api/teams/options", null).status());
    }

    @Test
    @DisplayName("Only HR can edit a candidate's details")
    void onlyHrEdits() {
        refuseEveryoneExcept("edit details", List.of("HR"),
                t -> put("/api/candidates/" + candidateId, t, Map.of("candidateName", "Hijacked")));
        assertEquals("Edited by HR", put("/api/candidates/" + candidateId, tokens.get("HR"),
                Map.of("candidateName", "Edited by HR")).text("candidateName"));
    }

    @Test
    @DisplayName("Only the team's Lead / Manager and the Super Admin change rates")
    void onlyApproversChangeRates() {
        refuseEveryoneExcept("change rates", List.of("SALES_LEAD", "SALES_MANAGER", "SUPER_ADMIN"),
                t -> post("/api/candidates/" + candidateId + "/rates?billRate=1&comment=x", t, null));
        assertEquals(200, post("/api/candidates/" + candidateId + "/rates?billRate=51&comment=ok",
                tokens.get("SALES_LEAD"), null).status());
        assertEquals(200, post("/api/candidates/" + candidateId + "/rates?billRate=52&comment=ok",
                tokens.get("SALES_MANAGER"), null).status());
        assertEquals(200, post("/api/candidates/" + candidateId + "/rates?billRate=53&comment=ok",
                tokens.get("SUPER_ADMIN"), null).status());
    }

    @Test
    @DisplayName("Project end date: only the owner recruiter raises it; only Lead / Manager / Super Admin decide")
    void projectEndRoles() {
        // raising: the candidate's recruiter, or an approver (which approves it directly)
        refuseEveryoneExcept("raise project end", List.of("RECRUITER", "SALES_LEAD", "SALES_MANAGER", "SUPER_ADMIN"),
                t -> post("/api/candidates/" + candidateId + "/project-end?date=2027-06-30", t, null));
        assertEquals(200, post("/api/candidates/" + candidateId + "/project-end?date=2027-06-30",
                tokens.get("RECRUITER"), null).status());

        // deciding
        List<String> deciders = List.of("SALES_LEAD", "SALES_MANAGER", "SUPER_ADMIN");
        refuseEveryoneExcept("approve project end", deciders,
                t -> post("/api/candidates/" + candidateId + "/project-end/approve", t, null));
        refuseEveryoneExcept("decline project end", deciders,
                t -> post("/api/candidates/" + candidateId + "/project-end/decline?comment=no", t, null));
        assertEquals(200, post("/api/candidates/" + candidateId + "/project-end/approve",
                tokens.get("SALES_MANAGER"), null).status());
        // already decided: nobody can approve it a second time
        assertEquals(400, post("/api/candidates/" + candidateId + "/project-end/approve",
                tokens.get("SUPER_ADMIN"), null).status());
    }

    @Test
    @DisplayName("Only the Super Admin and Admin put a Sales Manager over a team")
    void onlyAdminsAssignManagers() {
        refuseEveryoneExcept("assign a manager", List.of("SUPER_ADMIN", "ADMIN"),
                t -> put("/api/teams/" + team2.teamId() + "/sales-manager/" + manager.id(), t, null));
        assertEquals(200, put("/api/teams/" + team2.teamId() + "/sales-manager/" + manager.id(),
                tokens.get("ADMIN"), null).status());
    }

    @Test
    @DisplayName("Another team's Lead and recruiter can't see or act on this candidate")
    void otherTeamLockedOut() {
        assertEquals(403, get("/api/candidates/" + candidateId, tokens.get("SL2")).status());
        assertEquals(403, get("/api/candidates/" + candidateId, tokens.get("R2")).status());
        assertEquals(403, post("/api/candidates/" + candidateId + "/rates?billRate=9&comment=x", tokens.get("SL2"), null).status());
        assertEquals(403, post("/api/candidates/" + candidateId + "/project-end?date=2027-06-30", tokens.get("R2"), null).status());
    }

    // ------------------------------------------------------------------ injection / input

    @Test
    @DisplayName("SQL injection attempts in the new parameters are rejected or treated as plain text")
    void sqlInjection() {
        String lead = tokens.get("SALES_LEAD");
        // an unknown status filter is refused, never run as SQL
        assertEquals(400, get("/api/candidates?status=" + enc("PENDING_HR'; DROP TABLE candidates;--"), lead).status());
        assertEquals(400, get("/api/candidates?status=EXITED%27%20OR%20%271%27=%271", lead).status());
        // a search with SQL in it is just text: no rows match, nothing else leaks
        Res search = get("/api/candidates?search=" + enc("' OR '1'='1"), lead);
        assertEquals(200, search.status());
        assertEquals(0, search.body().path("totalElements").asInt());
        // numbers, dates and ids are parsed, not pasted into SQL
        assertEquals(400, post("/api/candidates/" + candidateId + "/rates?billRate=" + enc("1; DROP TABLE users") + "&comment=x", lead, null).status());
        assertEquals(400, post("/api/candidates/" + candidateId + "/project-end?date=" + enc("2027-01-01' OR 1=1"), tokens.get("RECRUITER"), null).status());
        assertEquals(400, post("/api/candidates", tokens.get("RECRUITER"),
                Map.of("candidateName", "x", "discountPrice", "1 OR 1=1")).status());
        assertEquals(400, post("/api/candidates", tokens.get("RECRUITER"),
                Map.of("candidateName", "x", "referralAmount", "5'; --")).status());
        // the tables are still there
        assertEquals(200, get("/api/candidates/" + candidateId, lead).status());
    }

    private static String enc(String s) {
        return java.net.URLEncoder.encode(s, java.nio.charset.StandardCharsets.UTF_8);
    }

    @Test
    @DisplayName("Script tags in candidate fields are escaped in the emails")
    @SuppressWarnings("unchecked")
    void xssInEmails() {
        String payload = "<script>alert(1)</script><img src=x onerror=alert(2)>";
        long id = submitCandidate(tokens.get("RECRUITER"), Map.of("candidateName", payload, "vendor", payload,
                "jobDescription", payload, "sourcingRecruiter", payload));
        clearInvocations(emailService);

        // approving emails the candidate's details; the HR edit also lists the changes
        assertEquals(200, act(id, "sales-lead/approve", tokens.get("SALES_LEAD"), null).status());
        assertEquals(200, put("/api/candidates/" + id, tokens.get("HR"),
                Map.of("candidateName", payload, "vendor", payload + "2", "jobDescription", payload)).status());

        ArgumentCaptor<String> bodies = ArgumentCaptor.forClass(String.class);
        verify(emailService, atLeastOnce()).notifyStage(ArgumentMatchers.<Collection<String>>any(),
                ArgumentMatchers.<Collection<Role>>any(), ArgumentMatchers.<Collection<User>>any(), anyString(), bodies.capture());
        assertFalse(bodies.getAllValues().isEmpty());
        for (String body : bodies.getAllValues()) {
            assertFalse(body.contains("<script>"), "raw <script> in an email");
            assertFalse(body.contains("<img src=x"), "raw <img> in an email");
            assertFalse(body.contains("onerror=alert(2)>"), "raw event handler in an email");
        }
        assertTrue(bodies.getAllValues().stream().anyMatch(b -> b.contains("&lt;script&gt;")));
    }

    @Test
    @DisplayName("HR's edit can't smuggle in workflow fields (status, decisions, owner, SSN)")
    void editCannotMassAssign() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("candidateName", "Still Mine");
        body.put("status", "OVERRIDE_APPROVED");
        body.put("hrDecision", "DECLINED");
        body.put("contractsDecision", "DECLINED");
        body.put("dojStatus", "NOT_RAISED");
        body.put("projectEndStatus", "APPROVED");
        body.put("projectEndDate", "2030-01-01");
        body.put("submittedBy", Map.of("id", team2.recruiter().id()));
        body.put("team", Map.of("id", team2.teamId()));
        body.put("recruiterLocation", "USA");
        Res r = put("/api/candidates/" + candidateId, tokens.get("HR"), body);
        assertEquals(200, r.status());
        JsonNode c = r.body();
        assertEquals("Still Mine", c.path("candidateName").asText());
        assertEquals("IN_HR_CONTRACTS_REVIEW", c.path("status").asText());
        assertEquals("PENDING", c.path("hrDecision").asText());
        assertEquals("APPROVED", c.path("dojStatus").asText());
        assertEquals("NOT_RAISED", c.path("projectEndStatus").asText());
        assertTrue(c.path("projectEndDate").isNull());
        assertEquals(team1.recruiter().id(), c.path("submittedBy").path("id").asLong());
        assertEquals(team1.teamId(), c.path("team").path("id").asLong());
        assertTrue(c.path("recruiterLocation").isNull() || !"USA".equals(c.path("recruiterLocation").asText()));
        // the SSN is never in a response
        assertTrue(c.path("ssnNo").isMissingNode());
    }
}
