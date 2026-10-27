package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

/** The Sales Manager role (oversees several teams) and the Sales Lead / Manager decline. */
class SalesManagerApiTest extends ApiTestSupport {

    private static boolean listContains(Res list, long id) {
        for (JsonNode n : list.body().path("content")) {
            if (n.path("id").asLong() == id) {
                return true;
            }
        }
        return false;
    }

    private void putUnder(String sa, long teamId, Account manager) {
        assertEquals(200, put("/api/teams/" + teamId + "/sales-manager/" + manager.id(), sa, null).status());
    }

    @Test
    @DisplayName("A Sales Manager sees only the candidates and teams under them")
    void managerVisibility() {
        String sa = admin();
        TeamSetup t1 = newTeam(sa);
        TeamSetup t2 = newTeam(sa);
        TeamSetup outside = newTeam(sa);
        Account manager = createUser(sa, "SALES_MANAGER", null);
        putUnder(sa, t1.teamId(), manager);
        putUnder(sa, t2.teamId(), manager);

        long c1 = submitCandidate(login(t1.recruiter()));
        long c2 = submitCandidate(login(t2.recruiter()));
        long cOut = submitCandidate(login(outside.recruiter()));
        String m = login(manager);

        Res list = get("/api/candidates", m);
        assertTrue(listContains(list, c1));
        assertTrue(listContains(list, c2));
        assertFalse(listContains(list, cOut));
        assertEquals(200, get("/api/candidates/" + c1, m).status());
        assertEquals(403, get("/api/candidates/" + cOut, m).status());
        assertEquals(2, get("/api/teams", m).body().size());
        assertEquals(403, get("/api/teams/" + outside.teamId(), m).status());
    }

    @Test
    @DisplayName("Either the Sales Lead or the Sales Manager can approve; the other is not needed")
    void eitherCanApprove() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        Account manager = createUser(sa, "SALES_MANAGER", null);
        putUnder(sa, ts.teamId(), manager);

        long byManager = submitCandidate(login(ts.recruiter()));
        long byLead = submitCandidate(login(ts.recruiter()));
        String m = login(manager);
        String lead = login(ts.lead());

        assertEquals(200, act(byManager, "sales-lead/approve", m, null).status());
        assertEquals("IN_HR_CONTRACTS_REVIEW", candidate(byManager, m).path("status").asText());
        // The lead can't approve it a second time
        assertEquals(400, act(byManager, "sales-lead/approve", lead, null).status());

        assertEquals(200, act(byLead, "sales-lead/approve", lead, null).status());
        assertEquals("IN_HR_CONTRACTS_REVIEW", candidate(byLead, lead).path("status").asText());

        // The trail names the manager's role
        Res trail = get("/api/candidates/" + byManager + "/trail", m);
        assertEquals("SALES_MANAGER", trail.body().get(1).path("actorRole").asText());
    }

    @Test
    @DisplayName("A Sales Manager can't act on a team that isn't theirs, and approves the DOJ too")
    void otherManagerAndDoj() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        Account manager = createUser(sa, "SALES_MANAGER", null);
        Account stranger = createUser(sa, "SALES_MANAGER", null);
        putUnder(sa, ts.teamId(), manager);

        long id = submitCandidate(login(ts.recruiter()));
        String s = login(stranger);
        String m = login(manager);
        assertEquals(403, act(id, "sales-lead/approve", s, null).status());
        assertEquals(403, act(id, "sales-lead/decline", s, "no").status());
        assertEquals(400, act(id, "doj/approve", m, null).status()); // approve the candidate first
        assertEquals(200, act(id, "sales-lead/approve", m, null).status());
        assertEquals(200, act(id, "doj/approve", m, null).status());
        assertEquals("APPROVED", candidate(id, m).path("dojStatus").asText());
    }

    @Test
    @DisplayName("Sales Lead decline needs a comment, ends the flow and shows as Declined")
    void leadDecline() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        Account hr = createUser(sa, "HR", null);
        long id = submitCandidate(login(ts.recruiter()));
        String lead = login(ts.lead());

        assertEquals(400, act(id, "sales-lead/decline", lead, null).status());
        assertEquals(200, act(id, "sales-lead/decline", lead, "Rate too low").status());

        JsonNode c = candidate(id, lead);
        assertEquals("SALES_LEAD_DECLINED", c.path("status").asText());
        assertEquals("Rate too low", c.path("lastDeclineReason").asText());
        assertTrue(listContains(get("/api/candidates?status=DECLINED", lead), id));
        assertEquals(1, get("/api/candidates/summary", lead).body().path("declined").asInt());

        // Nothing moves on: no re-approval, HR can't see or act on it
        assertEquals(400, act(id, "sales-lead/approve", lead, null).status());
        String hrT = login(hr);
        assertEquals(403, get("/api/candidates/" + id, hrT).status());
        assertEquals(400, act(id, "hr/approve", hrT, null).status());
        // The Super Admin can still override
        assertEquals(200, act(id, "override/approve", sa, "ok").status());
    }

    @Test
    @DisplayName("A Sales Manager can decline too; only admins can put managers over teams")
    void managerDeclineAndAssignRules() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        Account manager = createUser(sa, "SALES_MANAGER", null);
        Account notManager = createUser(sa, "HR", null);

        // Only a Sales Manager can be assigned, and only an admin can assign
        assertEquals(400, put("/api/teams/" + ts.teamId() + "/sales-manager/" + notManager.id(), sa, null).status());
        assertEquals(403, put("/api/teams/" + ts.teamId() + "/sales-manager/" + manager.id(),
                login(ts.lead()), null).status());
        putUnder(sa, ts.teamId(), manager);

        long id = submitCandidate(login(ts.recruiter()));
        String m = login(manager);
        assertEquals(200, act(id, "sales-lead/decline", m, "Not a fit").status());
        assertEquals("SALES_LEAD_DECLINED", candidate(id, m).path("status").asText());
        Res trail = get("/api/candidates/" + id + "/trail", m);
        assertEquals("DECLINE", trail.body().get(1).path("actionType").asText());
    }

    @Test
    @DisplayName("Teams can be created with a manager, and a deactivated manager releases them")
    void createWithManagerAndDeactivate() {
        String sa = admin();
        Account manager = createUser(sa, "SALES_MANAGER", null);
        Res team = post("/api/teams", sa, Map.of("name", uniq("Team"), "salesManager", Map.of("id", manager.id())));
        assertEquals(200, team.status());
        assertEquals(manager.id(), team.body().path("salesManager").path("id").asLong());

        assertEquals(204, delete("/api/users/" + manager.id(), sa).status());
        assertTrue(get("/api/teams/" + team.id(), sa).body().path("salesManager").isNull());
    }

    @Test
    @DisplayName("Candidates and the recruiter's profile carry the Sales Lead and Sales Manager names")
    void namesOnCandidates() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        Account manager = createUser(sa, "SALES_MANAGER", null);
        putUnder(sa, ts.teamId(), manager);
        String rec = login(ts.recruiter());

        JsonNode me = get("/api/auth/me", rec).body();
        assertEquals("Test SALES_LEAD", me.path("salesLeadName").asText());
        assertEquals("Test SALES_MANAGER", me.path("salesManagerName").asText());

        long id = submitCandidate(rec);
        JsonNode c = candidate(id, rec);
        assertEquals("Test SALES_LEAD", c.path("salesLeadName").asText());
        assertEquals("Test SALES_MANAGER", c.path("salesManagerName").asText());
    }

    @Test
    @DisplayName("Recruiter location comes from the recruiter's profile, never from the request")
    void recruiterLocationFromProfile() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        long recruiterId = ts.recruiter().id();

        // only the listed offices, and only recruiters have one
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("fullName", "Rec Loc");
        body.put("email", uniq("loc") + "@test.local");
        body.put("password", PASSWORD);
        body.put("role", "RECRUITER");
        body.put("location", "Mars");
        assertEquals(400, post("/api/users", sa, body).status());
        body.put("location", "Indore");
        Res created = post("/api/users", sa, body);
        assertEquals(200, created.status());
        assertEquals("Indore", created.text("location"));
        body.put("role", "HR");
        body.put("email", uniq("hrloc") + "@test.local");
        assertTrue(post("/api/users", sa, body).body().path("location").isNull());

        // set Noida on the team's recruiter (an edit sends the whole user)
        Map<String, Object> edit = new java.util.LinkedHashMap<>();
        edit.put("fullName", "Test RECRUITER");
        edit.put("email", ts.recruiter().email());
        edit.put("role", "RECRUITER");
        edit.put("active", true);
        edit.put("team", Map.of("id", ts.teamId()));
        edit.put("location", "Noida");
        assertEquals(200, put("/api/users/" + recruiterId, sa, edit).status());

        String rec = login(ts.recruiter());
        assertEquals("Noida", get("/api/auth/me", rec).body().path("location").asText());
        // a location in the request is ignored
        long id = submitCandidate(rec, Map.of("recruiterLocation", "USA"));
        assertEquals("Noida", candidate(id, rec).path("recruiterLocation").asText());
    }

    @Test
    @DisplayName("Team type (Sales, Req or Both) and referral amount are checked and saved")
    void teamTypeAndReferralAmount() {
        TeamSetup ts = newTeam(admin());
        String rec = login(ts.recruiter());
        assertEquals(400, post("/api/candidates", rec, Map.of("candidateName", "X", "teamType", "OTHER")).status());
        assertEquals(400, post("/api/candidates", rec, Map.of("candidateName", "X", "referralAmount", "lots")).status());

        long id = submitCandidate(rec, Map.of("teamType", "BOTH", "referralAmount", "500.50"));
        JsonNode c = candidate(id, rec);
        assertEquals("BOTH", c.path("teamType").asText());
        assertEquals("500.50", c.path("referralAmount").asText());
        assertTrue(candidate(submitCandidate(rec), rec).path("referralAmount").isNull()); // optional
        assertTrue(candidate(submitCandidate(rec), rec).path("vendorPercentage").isNull()); // no rates yet
    }

    @Test
    @DisplayName("New intake fields: employment type, internal placement and shared team are checked and returned")
    void placementFields() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        TeamSetup other = newTeam(sa);
        String rec = login(ts.recruiter());

        assertEquals(400, post("/api/candidates", rec, Map.of("candidateName", "X", "employmentType", "Freelance")).status());
        assertEquals(400, post("/api/candidates", rec,
                Map.of("candidateName", "X", "internalCompanyPlacement", true)).status()); // which company?
        assertEquals(400, post("/api/candidates", rec,
                Map.of("candidateName", "X", "internalCompanyPlacement", true, "placementCompany", "Nope")).status());
        assertEquals(400, post("/api/candidates", rec,
                Map.of("candidateName", "X", "sharedPlacement", true)).status()); // which team?

        long id = submitCandidate(rec, Map.of("employmentType", "C2C", "clientState", "Texas", "clientLocation", "Dallas",
                "sourcingRecruiter", "Asha", "sourcingRecruiterLead", "Ravi", "internalCompanyPlacement", true,
                "placementCompany", "NewMEK Software Solutions", "sharedPlacement", true,
                "sharedWithTeam", Map.of("id", other.teamId())));
        JsonNode c = candidate(id, rec);
        assertEquals("C2C", c.path("employmentType").asText());
        assertEquals("Texas", c.path("clientState").asText());
        assertEquals("Dallas", c.path("clientLocation").asText());
        assertEquals("Asha", c.path("sourcingRecruiter").asText());
        assertEquals("Ravi", c.path("sourcingRecruiterLead").asText());
        assertEquals("NewMEK Software Solutions", c.path("placementCompany").asText());
        assertEquals(other.teamId(), c.path("sharedWithTeam").path("id").asLong());

        // "No" clears the follow-up answers
        long no = submitCandidate(rec, Map.of("internalCompanyPlacement", false, "placementCompany", "Intellectt",
                "sharedPlacement", false, "sharedWithTeam", Map.of("id", other.teamId())));
        JsonNode n = candidate(no, rec);
        assertTrue(n.path("placementCompany").isNull());
        assertTrue(n.path("sharedWithTeam").isNull());

        // Any signed-in user can list team names for the dropdown, and only names
        Res opts = get("/api/teams/options", rec);
        assertEquals(200, opts.status());
        assertTrue(opts.body().size() >= 1);
        for (JsonNode t : opts.body()) {
            assertTrue(t.path("id").asLong() != ts.teamId(), "own team must not be offered");
        }
        assertEquals(400, post("/api/candidates", rec, Map.of("candidateName", "X", "sharedPlacement", true,
                "sharedWithTeam", Map.of("id", ts.teamId()))).status());
        assertTrue(opts.body().get(0).path("members").isMissingNode());
    }

    @Test
    @DisplayName("Payroll company is optional: one of the ten entities, or Other with a name")
    void payrollCompany() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        String rec = login(ts.recruiter());

        assertEquals(400, post("/api/candidates", rec, Map.of("candidateName", "X", "payrollCompany", "acme")).status());
        assertEquals(400, post("/api/candidates", rec, Map.of("candidateName", "X", "payrollCompany", "Other")).status());

        long none = submitCandidate(rec);
        assertTrue(candidate(none, rec).path("payrollCompany").isNull());

        long listed = submitCandidate(rec, Map.of("payrollCompany", "kennedysoft", "payrollCompanyOther", "ignored"));
        JsonNode l = candidate(listed, rec);
        assertEquals("kennedysoft", l.path("payrollCompany").asText());
        assertTrue(l.path("payrollCompanyOther").isNull());

        long other = submitCandidate(rec, Map.of("payrollCompany", "Other", "payrollCompanyOther", " Acme Payroll "));
        JsonNode o = candidate(other, rec);
        assertEquals("Other", o.path("payrollCompany").asText());
        assertEquals("Acme Payroll", o.path("payrollCompanyOther").asText());
    }

    @Test
    @DisplayName("Project end date: the recruiter raises it after the DOJ is approved; Lead / Manager / Super Admin approve or decline")
    void projectEndDate() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        Account manager = createUser(sa, "SALES_MANAGER", null);
        putUnder(sa, ts.teamId(), manager);
        String rec = login(ts.recruiter());
        String lead = login(ts.lead());
        String m = login(manager);
        long id = submitCandidate(rec); // DOJ 2026-12-01 from intake

        // nothing can be raised before the DOJ is approved
        assertEquals(400, act(id, "project-end?date=2027-06-30", rec, null).status());
        assertEquals(400, act(id, "project-end?date=2027-06-30", lead, null).status());
        act(id, "sales-lead/approve", lead, null);
        act(id, "doj/approve", lead, null);

        assertEquals(400, act(id, "project-end?date=2026-11-30", rec, null).status()); // before the DOJ
        assertEquals(400, act(id, "project-end?date=not-a-date", rec, null).status());
        assertEquals(403, act(id, "project-end?date=2027-06-30", login(newTeam(sa).recruiter()), null).status()); // not theirs
        assertEquals(400, act(id, "project-end/approve", lead, null).status()); // nothing raised yet

        // the recruiter raises it: it waits for approval and the candidate has NOT exited
        assertEquals(200, act(id, "project-end?date=2027-06-30", rec, null).status());
        JsonNode raised = candidate(id, rec);
        assertEquals("RAISED", raised.path("projectEndStatus").asText());
        assertEquals("2027-06-30", raised.path("projectEndDate").asText());
        assertTrue(!listContains(get("/api/candidates?status=EXITED", lead), id));

        // the recruiter can't approve it; a decline needs a comment
        assertEquals(403, act(id, "project-end/approve", rec, null).status());
        assertEquals(400, act(id, "project-end/decline", lead, null).status());
        assertEquals(200, act(id, "project-end/decline", lead, "Wrong date").status());
        assertEquals("DECLINED", candidate(id, rec).path("projectEndStatus").asText());
        assertTrue(!listContains(get("/api/candidates?status=EXITED", lead), id));

        // raised again, the Sales Manager approves: now the candidate has exited
        assertEquals(200, act(id, "project-end?date=2027-07-31", rec, null).status());
        assertEquals(200, act(id, "project-end/approve", m, null).status());
        JsonNode done = candidate(id, rec);
        assertEquals("APPROVED", done.path("projectEndStatus").asText());
        assertTrue(listContains(get("/api/candidates?status=EXITED", lead), id));
        // once approved the recruiter can't change it; the Lead can
        assertEquals(400, act(id, "project-end?date=2027-09-30", rec, null).status());
        assertEquals(200, act(id, "project-end?date=2027-09-30", lead, null).status());
        assertEquals("2027-09-30", candidate(id, m).path("projectEndDate").asText());
        Res trail = get("/api/candidates/" + id + "/trail", lead);
        assertEquals("SET_PROJECT_END", trail.body().get(trail.body().size() - 1).path("actionType").asText());
    }

    /** Calls POST /rates with the given query (e.g. "billRate=90") and an optional comment. */
    private Res rates(long id, String query, String token, String comment) {
        String c = comment == null ? "" : "&comment=" + java.net.URLEncoder.encode(comment, java.nio.charset.StandardCharsets.UTF_8);
        return post("/api/candidates/" + id + "/rates?" + query + c, token, null);
    }

    @Test
    @DisplayName("Rates can be changed mid-way, with a comment, by the team's Sales Lead/Manager and the Super Admin only")
    void changeRates() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        TeamSetup other = newTeam(sa);
        Account manager = createUser(sa, "SALES_MANAGER", null);
        putUnder(sa, ts.teamId(), manager);
        String rec = login(ts.recruiter());
        String lead = login(ts.lead());
        String m = login(manager);
        String hr = login(createUser(sa, "HR", null));
        long id = submitCandidate(rec, Map.of("billRate", "80", "payRate", "60"));
        act(id, "sales-lead/approve", lead, null);

        String path = "billRate=90&payRate=65.50";
        assertEquals(400, rates(id, path, lead, null).status()); // comment needed
        assertEquals(403, rates(id, path, rec, "why").status());
        assertEquals(403, rates(id, path, hr, "why").status());
        assertEquals(403, rates(id, path, login(other.lead()), "why").status()); // another team's lead
        assertEquals(400, rates(id, "billRate=abc", lead, "why").status());
        assertEquals(400, rates(id, "billRate=80", lead, "same as now").status()); // nothing changed

        assertEquals(200, rates(id, path, lead, "Client agreed a raise").status());
        JsonNode c = candidate(id, rec);
        assertEquals("90", c.path("billRate").asText());
        assertEquals("65.50", c.path("payRate").asText());
        assertEquals("72.78", c.path("vendorPercentage").asText()); // 65.50 / 90 * 100

        assertEquals(200, rates(id, "payRate=70", m, "Adjusted").status()); // the manager, only pay rate
        assertEquals("90", candidate(id, m).path("billRate").asText());
        assertEquals("70", candidate(id, m).path("payRate").asText());
        assertEquals("77.78", candidate(id, m).path("vendorPercentage").asText()); // 70 / 90 * 100, follows the rates
        assertEquals(200, rates(id, "billRate=95", admin(), "Approved by CEO").status()); // Super Admin

        Res trail = get("/api/candidates/" + id + "/trail", login(ts.lead()));
        JsonNode last = trail.body().get(trail.body().size() - 1);
        assertEquals("RATE_CHANGE", last.path("actionType").asText());
        assertTrue(last.path("comment").asText().contains("Bill rate 90 → 95"));
    }

    @Test
    @DisplayName("Only HR can edit a candidate's details (any time after the first approval); changes go on the trail")
    void hrEditsDetails() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        String rec = login(ts.recruiter());
        String lead = login(ts.lead());
        String hr = login(createUser(sa, "HR", null));
        long id = submitCandidate(rec, Map.of("vendor", "Old Vendor", "jobRole", "Tester", "ssnNo", "123-45-6789"));

        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("candidateName", "Edited Name");
        body.put("internalEntity", "novozen");
        body.put("vendor", "New Vendor");
        body.put("jobRole", "Tester");
        body.put("dojDate", "2026-12-01");

        // nobody but HR may edit
        assertEquals(403, put("/api/candidates/" + id, rec, body).status());
        assertEquals(403, put("/api/candidates/" + id, lead, body).status());
        assertEquals(403, put("/api/candidates/" + id, sa, body).status());
        // HR can't see it yet (not approved by the Sales Lead), so can't edit it either
        assertEquals(403, put("/api/candidates/" + id, hr, body).status());

        act(id, "sales-lead/approve", lead, null);
        Map<String, Object> bad = new java.util.LinkedHashMap<>(body);
        bad.put("candidateName", " ");
        assertEquals(400, put("/api/candidates/" + id, hr, bad).status());
        bad.put("candidateName", "X");
        bad.put("employmentType", "Freelance");
        assertEquals(400, put("/api/candidates/" + id, hr, bad).status());

        Res ok = put("/api/candidates/" + id, hr, body);
        assertEquals(200, ok.status());
        assertEquals("Edited Name", ok.text("candidateName"));
        assertEquals("New Vendor", ok.text("vendor"));
        assertEquals("IN_HR_CONTRACTS_REVIEW", ok.text("status")); // approvals are not reset
        assertEquals("***-**-6789", ok.text("ssnMasked")); // SSN left out = kept

        Res trail = get("/api/candidates/" + id + "/trail", lead);
        JsonNode last = trail.body().get(trail.body().size() - 1);
        assertEquals("EDIT", last.path("actionType").asText());
        assertTrue(last.path("comment").asText().contains("Vendor: Old Vendor → New Vendor"));
        assertTrue(last.path("comment").asText().contains("Candidate Name"));

        // saving the same thing again changes nothing
        assertEquals(400, put("/api/candidates/" + id, hr, body).status());

        // a masked SSN is ignored, a real one replaces the stored value
        body.put("ssnNo", "***-**-6789");
        assertEquals(400, put("/api/candidates/" + id, hr, body).status());
        body.put("ssnNo", "999-88-7777");
        assertEquals("***-**-7777", put("/api/candidates/" + id, hr, body).text("ssnMasked"));

        // still editable once everything is done, e.g. after the DOJ is approved
        act(id, "doj/approve", lead, null);
        body.put("vendor", "Even Newer");
        assertEquals(200, put("/api/candidates/" + id, hr, body).status());
    }

    @Test
    @DisplayName("Optional discount price: bill rate - discount price, and the vendor percentage uses the new bill rate")
    void discount() {
        TeamSetup ts = newTeam(admin());
        String rec = login(ts.recruiter());
        assertEquals(400, post("/api/candidates", rec,
                Map.of("candidateName", "X", "billRate", "100", "discountPrice", "150")).status()); // more than the bill rate
        assertEquals(400, post("/api/candidates", rec, Map.of("candidateName", "X", "discountPrice", "lots")).status());

        // no discount: percentage is pay / bill
        JsonNode plain = candidate(submitCandidate(rec, Map.of("billRate", "100", "payRate", "72")), rec);
        assertTrue(plain.path("discountedBillRate").isNull());
        assertEquals(72.0, plain.path("vendorPercentage").asDouble(), 0.001);

        // $10 off 100 = 90; 72 / 90 * 100 = 80
        long id = submitCandidate(rec, Map.of("billRate", "100", "payRate", "72", "discountPrice", "10"));
        JsonNode disc = candidate(id, rec);
        assertEquals("10", disc.path("discountPrice").asText());
        assertEquals(90.0, disc.path("discountedBillRate").asDouble(), 0.001);
        assertEquals(80.0, disc.path("vendorPercentage").asDouble(), 0.001);

        // the bill rate can't later drop below the discount price
        act(id, "sales-lead/approve", login(ts.lead()), null);
        Res low = post("/api/candidates/" + id + "/rates?billRate=5&comment=cut", login(ts.lead()), null);
        assertEquals(400, low.status());
    }

    @Test
    @DisplayName("An approved project end date (Lead, Manager or Super Admin) makes the candidate Exited")
    void exited() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        String rec = login(ts.recruiter());
        String lead = login(ts.lead());
        long id = submitCandidate(rec);
        act(id, "sales-lead/approve", lead, null);
        act(id, "doj/approve", lead, null);

        JsonNode before = get("/api/candidates/summary", lead).body();
        assertEquals(1, before.path("joined").asInt());
        assertEquals(0, before.path("exited").asInt());
        assertTrue(listContains(get("/api/candidates?status=JOINED", lead), id));

        // raised by the recruiter: still Joined until approved
        assertEquals(200, act(id, "project-end?date=2027-06-30", rec, null).status());
        assertEquals(1, get("/api/candidates/summary", lead).body().path("joined").asInt());
        assertEquals(0, get("/api/candidates/summary", lead).body().path("exited").asInt());

        // the Super Admin approves it
        assertEquals(200, act(id, "project-end/approve", sa, null).status());
        JsonNode after = get("/api/candidates/summary", lead).body();
        assertEquals(0, after.path("joined").asInt()); // no longer counted as joined
        assertEquals(1, after.path("exited").asInt());
        assertTrue(listContains(get("/api/candidates?status=EXITED", lead), id));
        assertTrue(!listContains(get("/api/candidates?status=JOINED", lead), id));
        Res trail = get("/api/candidates/" + id + "/trail", lead);
        assertEquals("APPROVE_PROJECT_END", trail.body().get(trail.body().size() - 1).path("actionType").asText());
    }
}
