package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.verify;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

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
 * The DOJ needs two approvals (Sales Lead / Manager and HR), the Sales Manager is in the approval emails,
 * "joining today", and Drop out / Back out. The email service is a mock: nothing is sent.
 */
class DojAndDropOutApiTest extends ApiTestSupport {

    @MockitoBean
    EmailService emailService;

    private static final Set<Role> ALL_FOUR = Set.of(Role.HR, Role.CONTRACTS, Role.PAYROLL, Role.ACCOUNTS);

    /** A team with Sales Lead, Sales Manager, recruiter, and the HR / Contracts / Payroll / Accounts people. */
    private record Loop(TeamSetup team, Account manager, Account hr, Account contracts, Account payroll, Account accounts,
            String sa) {
    }

    private Loop loop() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        Account manager = createUser(sa, "SALES_MANAGER", null);
        assertEquals(200, put("/api/teams/" + ts.teamId() + "/sales-manager/" + manager.id(), sa, null).status());
        return new Loop(ts, manager, createUser(sa, "HR", null), createUser(sa, "CONTRACTS", null),
                createUser(sa, "PAYROLL", null), createUser(sa, "ACCOUNTS", null), sa);
    }

    private static Set<String> emails(Collection<User> users) {
        return users.stream().map(User::getEmail).collect(Collectors.toSet());
    }

    /** Takes a fresh candidate through the Sales Lead, HR, Contracts, Payroll, Accounts and both DOJ approvals. */
    private long joinedCandidate(Loop l, Map<String, Object> extra) {
        long id = submitCandidate(login(l.team().recruiter()), extra);
        String lead = login(l.team().lead());
        act(id, "sales-lead/approve", lead, null);
        act(id, "hr/approve", login(l.hr()), null);
        act(id, "contracts/approve", login(l.contracts()), null);
        act(id, "payroll/approve", login(l.payroll()), null);
        act(id, "accounts/approve", login(l.accounts()), null);
        approveDojBoth(id, lead, login(l.hr()));
        return id;
    }

    @Test
    @DisplayName("The DOJ is approved only when the Sales Lead / Manager AND HR have approved; everyone is emailed each time")
    @SuppressWarnings("unchecked")
    void dojNeedsLeadAndHr() {
        Loop l = loop();
        String rec = login(l.team().recruiter());
        String lead = login(l.team().lead());
        String hr = login(l.hr());
        long id = submitCandidate(rec);

        // HR can't see the candidate before the Sales Lead's first approval, so it can't approve the DOJ yet
        assertEquals(403, act(id, "doj/approve", hr, null).status());
        act(id, "sales-lead/approve", lead, null);
        clearInvocations(emailService);

        // nobody else may approve the DOJ
        for (Account a : List.of(l.contracts(), l.payroll(), l.accounts())) {
            assertEquals(403, act(id, "doj/approve", login(a), null).status());
        }
        assertEquals(403, act(id, "doj/approve", rec, null).status());
        clearInvocations(emailService);

        // the Sales Lead approves: not approved yet; HR, Contracts, Payroll, Accounts, the Manager and the recruiter are told
        assertEquals(200, act(id, "doj/approve", lead, null).status());
        JsonNode half = candidate(id, rec);
        assertEquals("RAISED", half.path("dojStatus").asText());
        assertTrue(half.path("dojLeadApproved").asBoolean());
        assertFalse(half.path("dojHrApproved").asBoolean());
        ArgumentCaptor<Collection<Role>> roles = ArgumentCaptor.forClass(Collection.class);
        ArgumentCaptor<Collection<User>> people = ArgumentCaptor.forClass(Collection.class);
        verify(emailService).notifyStage(ArgumentMatchers.<Collection<String>>any(), roles.capture(), people.capture(),
                org.mockito.ArgumentMatchers.contains("Date of Joining approved by"), anyString());
        assertEquals(ALL_FOUR, Set.copyOf(roles.getValue()));
        assertEquals(Set.of(l.manager().email(), l.team().recruiter().email()), emails(people.getValue()));
        clearInvocations(emailService);

        assertEquals(400, act(id, "doj/approve", lead, null).status()); // once each
        assertEquals(400, act(id, "project-end?date=2027-06-30", rec, null).status()); // not approved yet

        // HR approves: the DOJ is approved, everyone is told (Lead, Manager and recruiter included)
        assertEquals(200, act(id, "doj/approve", hr, null).status());
        assertEquals("APPROVED", candidate(id, rec).path("dojStatus").asText());
        ArgumentCaptor<Collection<User>> people2 = ArgumentCaptor.forClass(Collection.class);
        verify(emailService).notifyStage(ArgumentMatchers.<Collection<String>>any(), ArgumentMatchers.<Collection<Role>>any(),
                people2.capture(), org.mockito.ArgumentMatchers.contains("Date of Joining approved:"), anyString());
        assertEquals(Set.of(l.team().lead().email(), l.manager().email(), l.team().recruiter().email()),
                emails(people2.getValue()));
    }

    @Test
    @DisplayName("The Sales Manager (and Lead) are emailed when HR, Contracts, Payroll and Accounts approve")
    @SuppressWarnings("unchecked")
    void managerGetsBranchEmails() {
        Loop l = loop();
        String lead = login(l.team().lead());
        long id = submitCandidate(login(l.team().recruiter()));
        act(id, "sales-lead/approve", lead, null);
        clearInvocations(emailService);

        Set<String> approvers = Set.of(l.team().lead().email(), l.manager().email());
        String[][] steps = { { "hr/approve", "HR approved candidate" }, { "contracts/approve", "Contracts approved candidate" } };
        Account[] who = { l.hr(), l.contracts() };
        for (int i = 0; i < steps.length; i++) {
            assertEquals(200, act(id, steps[i][0], login(who[i]), null).status());
            ArgumentCaptor<Collection<User>> people = ArgumentCaptor.forClass(Collection.class);
            verify(emailService).notifyStage(ArgumentMatchers.<Collection<String>>any(), ArgumentMatchers.<Collection<Role>>any(),
                    people.capture(), org.mockito.ArgumentMatchers.contains(steps[i][1]), anyString());
            assertTrue(emails(people.getValue()).containsAll(approvers), steps[i][1] + ": Lead and Manager must be emailed");
            clearInvocations(emailService);
        }
        // Payroll approves (Accounts still pending): everyone incl. Lead and Manager is told
        assertEquals(200, act(id, "payroll/approve", login(l.payroll()), null).status());
        ArgumentCaptor<Collection<User>> people = ArgumentCaptor.forClass(Collection.class);
        ArgumentCaptor<Collection<Role>> roles = ArgumentCaptor.forClass(Collection.class);
        verify(emailService).notifyStage(ArgumentMatchers.<Collection<String>>any(), roles.capture(), people.capture(),
                org.mockito.ArgumentMatchers.contains("Payroll approved candidate"), anyString());
        assertEquals(ALL_FOUR, Set.copyOf(roles.getValue()));
        assertTrue(emails(people.getValue()).containsAll(approvers));
    }

    @Test
    @DisplayName("Joining today: the count and the list filter find candidates whose DOJ is today")
    void joiningToday() {
        Loop l = loop();
        String rec = login(l.team().recruiter());
        String lead = login(l.team().lead());
        String hr = login(l.hr());
        String today = LocalDate.now().toString();
        long todays = submitCandidate(rec, Map.of("dojDate", today));
        long later = submitCandidate(rec, Map.of("dojDate", LocalDate.now().plusDays(10).toString()));
        act(todays, "sales-lead/approve", lead, null);
        act(later, "sales-lead/approve", lead, null);

        for (String token : List.of(lead, login(l.manager()), hr)) {
            assertEquals(1, get("/api/candidates/summary", token).body().path("dojToday").asInt());
            JsonNode page = get("/api/candidates?dojToday=true", token).body();
            assertEquals(1, page.path("totalElements").asInt());
            assertEquals(todays, page.path("content").get(0).path("id").asLong());
        }
        // a candidate who dropped out is not "joining today" any more
        approveDojBoth(todays, lead, hr);
        assertEquals(200, act(todays, "drop-out", lead, "Changed mind").status());
        assertEquals(0, get("/api/candidates/summary", lead).body().path("dojToday").asInt());
    }

    @Test
    @DisplayName("Drop out / back out: after the DOJ is approved, the Lead, Manager, HR, Contracts, Payroll, Accounts or Super Admin can record it")
    @SuppressWarnings("unchecked")
    void dropOut() {
        Loop l = loop();
        String rec = login(l.team().recruiter());
        String lead = login(l.team().lead());
        String hr = login(l.hr());

        // not before the DOJ is approved
        long early = submitCandidate(rec);
        act(early, "sales-lead/approve", lead, null);
        assertEquals(400, act(early, "drop-out", lead, "too early").status());

        long id = joinedCandidate(l, Map.of());
        // joinedCandidate signs these people in again, which ends the earlier sessions: take fresh tokens
        rec = login(l.team().recruiter());
        lead = login(l.team().lead());
        hr = login(l.hr());
        clearInvocations(emailService);
        // who may not: the recruiter, an Admin and another team's lead
        assertEquals(403, act(id, "drop-out", rec, "x").status());
        assertEquals(403, act(id, "drop-out", login(createUser(l.sa(), "ADMIN", null)), "x").status());
        assertEquals(403, act(id, "drop-out", login(newTeam(l.sa()).lead()), "x").status());
        assertEquals(400, act(id, "drop-out", hr, null).status()); // a reason is needed

        // HR records it
        assertEquals(1, get("/api/candidates/summary", lead).body().path("joined").asInt());
        assertEquals(200, act(id, "drop-out", hr, "Left after two weeks").status());
        JsonNode c = candidate(id, rec);
        assertEquals("DROPPED_OUT", c.path("status").asText());
        assertEquals("Left after two weeks", c.path("lastDeclineReason").asText());
        JsonNode summary = get("/api/candidates/summary", lead).body();
        assertEquals(1, summary.path("dropouts").asInt());
        assertEquals(0, summary.path("joined").asInt());
        assertEquals(0, summary.path("declined").asInt()); // its own card, not "declined"
        assertEquals(1, get("/api/candidates?status=DROPPED_OUT", lead).body().path("totalElements").asInt());

        // everyone in the loop is emailed
        ArgumentCaptor<Collection<Role>> roles = ArgumentCaptor.forClass(Collection.class);
        ArgumentCaptor<Collection<User>> people = ArgumentCaptor.forClass(Collection.class);
        verify(emailService).notifyStage(ArgumentMatchers.<Collection<String>>any(), roles.capture(), people.capture(),
                org.mockito.ArgumentMatchers.contains("Candidate dropped out"), anyString());
        assertEquals(ALL_FOUR, Set.copyOf(roles.getValue()));
        assertEquals(Set.of(l.team().lead().email(), l.manager().email(), l.team().recruiter().email()), emails(people.getValue()));

        // a second drop out, rates and project end date are refused now
        assertEquals(400, act(id, "drop-out", lead, "again").status());
        assertEquals(400, act(id, "project-end?date=2027-06-30", rec, null).status());
        assertEquals(400, post("/api/candidates/" + id + "/rates?billRate=1&comment=x", lead, null).status());
        Res trail = get("/api/candidates/" + id + "/trail", lead);
        assertEquals("DROP_OUT", trail.body().get(trail.body().size() - 1).path("actionType").asText());

        // every other allowed role can do it on its own candidate (sign in right before each use)
        Map<String, Account> others = new java.util.LinkedHashMap<>();
        others.put("SALES_LEAD", l.team().lead());
        others.put("SALES_MANAGER", l.manager());
        others.put("CONTRACTS", l.contracts());
        others.put("PAYROLL", l.payroll());
        others.put("ACCOUNTS", l.accounts());
        for (Map.Entry<String, Account> e : others.entrySet()) {
            long other = joinedCandidate(l, Map.of());
            assertEquals(200, act(other, "drop-out", login(e.getValue()), "left (" + e.getKey() + ")").status(), e.getKey());
            assertEquals("DROPPED_OUT", candidate(other, login(l.team().recruiter())).path("status").asText());
        }
        long bySa = joinedCandidate(l, Map.of());
        assertEquals(200, act(bySa, "drop-out", admin(), "left (Super Admin)").status());
    }

    @Test
    @DisplayName("Once the project end date is approved the candidate has exited and can no longer drop out")
    void noDropOutAfterExit() {
        Loop l = loop();
        long id = joinedCandidate(l, Map.of());
        String rec = login(l.team().recruiter());
        act(id, "project-end?date=2027-06-30", rec, null);
        assertEquals(200, act(id, "project-end/approve", login(l.manager()), null).status());
        assertEquals(200, act(id, "project-end/approve", login(l.hr()), null).status());
        assertEquals(400, act(id, "drop-out", login(l.team().lead()), "too late").status());
        verify(emailService, atLeastOnce()).notifyStage(ArgumentMatchers.<Collection<String>>any(),
                ArgumentMatchers.<Collection<Role>>any(), ArgumentMatchers.<Collection<User>>any(), anyString(), anyString());
    }
}
