package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

/** The approval workflow end to end, plus who may see and act on what. */
class CandidateWorkflowApiTest extends ApiTestSupport {

    private static boolean listContains(Res list, long id) {
        for (JsonNode n : list.body().path("content")) {
            if (n.path("id").asLong() == id) {
                return true;
            }
        }
        return false;
    }

    @Test
    @DisplayName("Submitting needs a candidate name; only recruiters may submit")
    void submitRules() {
        String a = admin();
        TeamSetup ts = newTeam(a);
        assertEquals(400, post("/api/candidates", login(ts.recruiter()), Map.of("location", "Austin")).status());
        assertEquals(403, post("/api/candidates", login(ts.lead()), Map.of("candidateName", "X")).status());
    }

    @Test
    @DisplayName("Happy path: Sales Lead, HR and Contracts, then Payroll and Accounts approve -> COMPLETED")
    void happyPath() {
        String a = admin();
        TeamSetup ts = newTeam(a);
        Account hr = createUser(a, "HR", null);
        Account contracts = createUser(a, "CONTRACTS", null);
        Account payroll = createUser(a, "PAYROLL", null);
        Account accounts = createUser(a, "ACCOUNTS", null);
        long id = submitCandidate(login(ts.recruiter()));
        String lead = login(ts.lead());

        assertEquals("PENDING_SALES_LEAD_APPROVAL", candidate(id, lead).path("status").asText());
        assertEquals(200, act(id, "sales-lead/approve", lead, "looks good").status());
        assertEquals("IN_HR_CONTRACTS_REVIEW", candidate(id, lead).path("status").asText());

        assertEquals(200, act(id, "hr/approve", login(hr), null).status());
        assertEquals(200, act(id, "contracts/approve", login(contracts), null).status());

        // HR and Contracts done: now it is the turn of Payroll and Accounts
        JsonNode c = candidate(id, lead);
        assertEquals("IN_PAYROLL_ACCOUNTS_REVIEW", c.path("status").asText());
        assertEquals("APPROVED", c.path("hrDecision").asText());
        assertEquals("APPROVED", c.path("contractsDecision").asText());
        String pay = login(payroll);
        String acc = login(accounts);
        assertEquals(200, act(id, "payroll/approve", pay, null).status());
        assertEquals("IN_PAYROLL_ACCOUNTS_REVIEW", candidate(id, lead).path("status").asText());
        assertEquals(400, act(id, "payroll/approve", pay, null).status()); // already decided
        assertEquals(200, act(id, "accounts/approve", acc, null).status());
        assertEquals("COMPLETED", candidate(id, lead).path("status").asText());

        Res trail = get("/api/candidates/" + id + "/trail", lead);
        assertEquals(200, trail.status());
        assertEquals(6, trail.body().size()); // submit, SL, HR, Contracts, Payroll, Accounts
    }

    @Test
    @DisplayName("A Sales Lead can't approve another team's candidate")
    void otherTeamLeadCannotApprove() {
        String a = admin();
        TeamSetup mine = newTeam(a);
        TeamSetup other = newTeam(a);
        long id = submitCandidate(login(mine.recruiter()));
        assertEquals(403, act(id, "sales-lead/approve", login(other.lead()), null).status());
    }

    @Test
    @DisplayName("A decline needs a comment, returns to the Sales Lead, who can re-route it")
    void declineAndReroute() {
        String a = admin();
        TeamSetup ts = newTeam(a);
        Account hr = createUser(a, "HR", null);
        long id = submitCandidate(login(ts.recruiter()));
        String lead = login(ts.lead());
        String hrT = login(hr);
        act(id, "sales-lead/approve", lead, null);

        assertEquals(400, act(id, "hr/decline", hrT, null).status());
        assertEquals(200, act(id, "hr/decline", hrT, "missing documents").status());
        JsonNode c = candidate(id, lead);
        assertEquals("RETURNED_TO_SALES_LEAD", c.path("status").asText());
        assertEquals("missing documents", c.path("lastDeclineReason").asText());

        assertEquals(200, act(id, "sales-lead/approve", lead, "fixed").status());
        c = candidate(id, lead);
        assertEquals("IN_HR_CONTRACTS_REVIEW", c.path("status").asText());
        assertEquals("PENDING", c.path("hrDecision").asText());
    }

    @Test
    @DisplayName("HR can revise its decision until the DOJ is approved, then it's locked")
    void hrReviseThenLock() {
        String a = admin();
        TeamSetup ts = newTeam(a);
        Account hr = createUser(a, "HR", null);
        long id = submitCandidate(login(ts.recruiter()));
        String lead = login(ts.lead());
        String hrT = login(hr);
        act(id, "sales-lead/approve", lead, null);

        assertEquals(200, act(id, "hr/approve", hrT, null).status());
        assertEquals(200, act(id, "hr/decline", hrT, "changed my mind").status());
        assertEquals("RETURNED_TO_SALES_LEAD", candidate(id, lead).path("status").asText());
        assertEquals(200, act(id, "hr/approve", hrT, "ok now").status());
        assertEquals("IN_HR_CONTRACTS_REVIEW", candidate(id, lead).path("status").asText());

        assertEquals(200, act(id, "doj/approve", lead, null).status());
        assertEquals("APPROVED", candidate(id, lead).path("dojStatus").asText());
        assertEquals(400, act(id, "hr/decline", hrT, "too late").status());
        assertEquals(400, act(id, "hr/approve", hrT, null).status());
    }

    @Test
    @DisplayName("The DOJ can't be approved before the candidate is")
    void dojNeedsCandidateApprovalFirst() {
        TeamSetup ts = newTeam(admin());
        long id = submitCandidate(login(ts.recruiter()));
        assertEquals(400, act(id, "doj/approve", login(ts.lead()), null).status());
    }

    @Test
    @DisplayName("Visibility: own candidates only for recruiters; Payroll and Accounts only after HR AND Contracts approve")
    void visibilityRules() {
        String a = admin();
        TeamSetup ts = newTeam(a);
        TeamSetup other = newTeam(a);
        Account hr = createUser(a, "HR", null);
        Account contracts = createUser(a, "CONTRACTS", null);
        Account payroll = createUser(a, "PAYROLL", null);
        Account accounts = createUser(a, "ACCOUNTS", null);
        String rec = login(ts.recruiter());
        long id = submitCandidate(rec);

        assertTrue(listContains(get("/api/candidates", rec), id));
        assertEquals(403, get("/api/candidates/" + id, login(other.recruiter())).status());

        String pay = login(payroll);
        assertFalse(listContains(get("/api/candidates", pay), id));
        act(id, "sales-lead/approve", login(ts.lead()), null);
        String acc = login(accounts);
        act(id, "hr/approve", login(hr), null);
        // HR alone is not enough
        assertFalse(listContains(get("/api/candidates", pay), id));
        assertFalse(listContains(get("/api/candidates", acc), id));
        assertEquals(403, get("/api/candidates/" + id, pay).status());
        assertEquals(400, act(id, "payroll/approve", pay, null).status());
        act(id, "contracts/approve", login(contracts), null);
        assertTrue(listContains(get("/api/candidates", pay), id));
        assertTrue(listContains(get("/api/candidates", acc), id));
    }

    @Test
    @DisplayName("Payroll or Accounts can decline (comment needed); the Sales Lead re-routes and only that team redoes it")
    void payrollAccountsDecline() {
        String a = admin();
        TeamSetup ts = newTeam(a);
        String hr = login(createUser(a, "HR", null));
        String contracts = login(createUser(a, "CONTRACTS", null));
        String pay = login(createUser(a, "PAYROLL", null));
        String acc = login(createUser(a, "ACCOUNTS", null));
        long id = submitCandidate(login(ts.recruiter()));
        String lead = login(ts.lead());
        act(id, "sales-lead/approve", lead, null);
        act(id, "hr/approve", hr, null);
        act(id, "contracts/approve", contracts, null);

        assertEquals(403, act(id, "payroll/approve", acc, null).status()); // wrong role
        assertEquals(400, act(id, "accounts/decline", acc, null).status()); // comment needed
        assertEquals(200, act(id, "accounts/decline", acc, "Bank details missing").status());
        JsonNode c = candidate(id, lead);
        assertEquals("RETURNED_TO_SALES_LEAD", c.path("status").asText());
        assertEquals("DECLINED", c.path("accountsDecision").asText());
        assertEquals(400, act(id, "payroll/approve", pay, null).status()); // back with the Sales Lead

        assertEquals(200, act(id, "sales-lead/approve", lead, null).status()); // re-route
        c = candidate(id, lead);
        assertEquals("IN_PAYROLL_ACCOUNTS_REVIEW", c.path("status").asText()); // HR/Contracts approvals stand
        assertEquals("PENDING", c.path("accountsDecision").asText());
        assertEquals(200, act(id, "payroll/approve", pay, null).status());
        assertEquals(200, act(id, "accounts/approve", acc, null).status());
        assertEquals("COMPLETED", candidate(id, lead).path("status").asText());
    }

    @Test
    @DisplayName("Super Admin override: reject needs a comment; approve overrides")
    void superAdminOverride() {
        String a = admin();
        TeamSetup ts = newTeam(a);
        long id = submitCandidate(login(ts.recruiter()));
        String sa = admin();
        assertEquals(400, act(id, "override/decline", sa, null).status());
        assertEquals(200, act(id, "override/approve", sa, "approved by CEO").status());
        assertEquals("OVERRIDE_APPROVED", candidate(id, sa).path("status").asText());
        // Only the Super Admin may override
        assertEquals(403, act(id, "override/decline", login(ts.lead()), "no").status());
    }

    @Test
    @DisplayName("The Internal Entity chosen at intake is saved")
    void internalEntitySaved() {
        TeamSetup ts = newTeam(admin());
        String rec = login(ts.recruiter());
        long id = submitCandidate(rec, Map.of("internalEntity", "kennedysoft"));
        assertEquals("kennedysoft", candidate(id, rec).path("internalEntity").asText());
    }
}
