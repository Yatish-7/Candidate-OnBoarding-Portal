package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.verify;

import java.util.Collection;
import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.intellectt.model.User;
import com.intellectt.model.enums.Role;
import com.intellectt.service.EmailService;

/**
 * Which roles each workflow email is addressed to. The email service is replaced by a mock, so
 * nothing is sent: we only check the recipients the workflow asks for.
 */
class WorkflowEmailApiTest extends ApiTestSupport {

    @MockitoBean
    EmailService emailService;

    private static final Set<Role> ALL_FOUR = Set.of(Role.HR, Role.CONTRACTS, Role.PAYROLL, Role.ACCOUNTS);

    /** The role set of the (one) stage email sent with this subject text. */
    @SuppressWarnings("unchecked")
    private Set<Role> rolesOf(String subjectPart) {
        ArgumentCaptor<Collection<Role>> roles = ArgumentCaptor.forClass(Collection.class);
        verify(emailService).notifyStage(ArgumentMatchers.<Collection<String>>any(), roles.capture(),
                ArgumentMatchers.<Collection<User>>any(), org.mockito.ArgumentMatchers.contains(subjectPart), anyString());
        Set<Role> result = Set.copyOf(roles.getValue());
        clearInvocations(emailService);
        return result;
    }

    @Test
    @DisplayName("Sales Lead approval, then each HR and Contracts approval, email HR, Contracts, Payroll and Accounts")
    void allFourAreEmailed() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        String hr = login(createUser(sa, "HR", null));
        String contracts = login(createUser(sa, "CONTRACTS", null));
        String payroll = login(createUser(sa, "PAYROLL", null));
        String accounts = login(createUser(sa, "ACCOUNTS", null));
        String lead = login(ts.lead());
        long id = submitCandidate(login(ts.recruiter()));
        clearInvocations(emailService);

        // Sales Lead approves -> all four are emailed...
        assertEquals(200, act(id, "sales-lead/approve", lead, null).status());
        assertEquals(ALL_FOUR, rolesOf("approved by Sales Lead"));
        // ...but Payroll and Accounts still can't see the candidate in the portal
        assertEquals(403, get("/api/candidates/" + id, payroll).status());
        assertEquals(403, get("/api/candidates/" + id, accounts).status());

        // HR approves -> all four are emailed, still not visible to Payroll / Accounts
        assertEquals(200, act(id, "hr/approve", hr, null).status());
        assertEquals(ALL_FOUR, rolesOf("HR approved candidate"));
        assertEquals(403, get("/api/candidates/" + id, payroll).status());

        // Contracts approves -> all four are emailed, and now Payroll and Accounts can see it
        assertEquals(200, act(id, "contracts/approve", contracts, null).status());
        assertEquals(ALL_FOUR, rolesOf("Contracts approved candidate"));
        assertEquals(200, get("/api/candidates/" + id, payroll).status());
        assertEquals(200, get("/api/candidates/" + id, accounts).status());
        assertTrue(true);
    }

    @Test
    @DisplayName("The recruiter is emailed when the Sales Lead approves or declines; emails carry a View candidate link")
    @SuppressWarnings("unchecked")
    void recruiterAndLink() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        String lead = login(ts.lead());
        long approved = submitCandidate(login(ts.recruiter()));
        long declined = submitCandidate(login(ts.recruiter()));
        clearInvocations(emailService);

        // approve
        assertEquals(200, act(approved, "sales-lead/approve", lead, null).status());
        ArgumentCaptor<Collection<User>> people = ArgumentCaptor.forClass(Collection.class);
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(emailService).notifyStage(ArgumentMatchers.<Collection<String>>any(), ArgumentMatchers.<Collection<Role>>any(),
                people.capture(), org.mockito.ArgumentMatchers.contains("approved by"), body.capture());
        assertTrue(people.getValue().stream().anyMatch(u -> u.getEmail().equals(ts.recruiter().email())),
                "the recruiter must get the approval email");
        assertTrue(body.getValue().contains("View candidate"));
        assertTrue(body.getValue().contains("/login\""), "the button must open the sign-in page");
        clearInvocations(emailService);

        // decline
        assertEquals(200, act(declined, "sales-lead/decline", lead, "Not a fit").status());
        ArgumentCaptor<Collection<User>> people2 = ArgumentCaptor.forClass(Collection.class);
        ArgumentCaptor<String> body2 = ArgumentCaptor.forClass(String.class);
        verify(emailService).notifyStage(ArgumentMatchers.<Collection<String>>any(), ArgumentMatchers.<Collection<Role>>any(),
                people2.capture(), org.mockito.ArgumentMatchers.contains("declined candidate"), body2.capture());
        assertTrue(people2.getValue().stream().anyMatch(u -> u.getEmail().equals(ts.recruiter().email())),
                "the recruiter must get the decline email");
        assertTrue(body2.getValue().contains("/login\""));
    }

    @Test
    @DisplayName("Vendor percentage above 75%: everyone in the loop gets a warning when the Sales Lead approves; 75% or less sends none")
    @SuppressWarnings("unchecked")
    void highVendorPercentageWarning() {
        TeamSetup ts = newTeam(admin());
        String lead = login(ts.lead());
        String rec = login(ts.recruiter());
        long high = submitCandidate(rec, java.util.Map.of("billRate", "100", "payRate", "80"));
        long edge = submitCandidate(rec, java.util.Map.of("billRate", "100", "payRate", "75"));
        clearInvocations(emailService);

        assertEquals(200, act(edge, "sales-lead/approve", lead, null).status());
        verify(emailService, org.mockito.Mockito.never()).notifyStage(ArgumentMatchers.<Collection<String>>any(),
                ArgumentMatchers.<Collection<Role>>any(), ArgumentMatchers.<Collection<User>>any(),
                org.mockito.ArgumentMatchers.contains("Warning: vendor percentage"), anyString());
        clearInvocations(emailService);

        assertEquals(200, act(high, "sales-lead/approve", lead, null).status());
        ArgumentCaptor<Collection<Role>> roles = ArgumentCaptor.forClass(Collection.class);
        ArgumentCaptor<Collection<User>> people = ArgumentCaptor.forClass(Collection.class);
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(emailService).notifyStage(ArgumentMatchers.<Collection<String>>any(), roles.capture(), people.capture(),
                org.mockito.ArgumentMatchers.contains("Warning: vendor percentage"), body.capture());
        assertEquals(ALL_FOUR, Set.copyOf(roles.getValue()));
        Set<String> to = people.getValue().stream().map(User::getEmail).collect(java.util.stream.Collectors.toSet());
        assertEquals(Set.of(ts.lead().email(), ts.recruiter().email()), to);
        assertTrue(body.getValue().contains("80.00%") && body.getValue().contains("greater than 75%"));
    }

    @Test
    @DisplayName("Project end date: raising it emails Lead, Manager and HR; each approval and the final approval email everyone")
    @SuppressWarnings("unchecked")
    void projectEndEmails() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        Account manager = createUser(sa, "SALES_MANAGER", null);
        assertEquals(200, put("/api/teams/" + ts.teamId() + "/sales-manager/" + manager.id(), sa, null).status());
        String hr = login(createUser(sa, "HR", null));
        String rec = login(ts.recruiter());
        String lead = login(ts.lead());
        long id = submitCandidate(rec);
        act(id, "sales-lead/approve", lead, null);
        approveDojBoth(id, lead, hr);
        clearInvocations(emailService);

        // the recruiter fixes the date: the Sales Lead, the Sales Manager and HR are emailed (Super Admin copied)
        assertEquals(200, act(id, "project-end?date=2027-06-30", rec, null).status());
        ArgumentCaptor<Collection<Role>> rolesRaise = ArgumentCaptor.forClass(Collection.class);
        ArgumentCaptor<Collection<User>> people = ArgumentCaptor.forClass(Collection.class);
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(emailService).notifyStage(ArgumentMatchers.<Collection<String>>any(), rolesRaise.capture(),
                people.capture(), org.mockito.ArgumentMatchers.contains("Project end date to approve"), body.capture());
        Set<String> to = people.getValue().stream().map(User::getEmail).collect(java.util.stream.Collectors.toSet());
        assertEquals(Set.of(ts.lead().email(), manager.email()), to);
        assertEquals(Set.of(Role.HR), Set.copyOf(rolesRaise.getValue()));
        assertTrue(body.getValue().contains("/login\""), "the button opens the sign-in page");
        clearInvocations(emailService);

        // the Sales Manager approves: everyone is told, still waiting for HR
        assertEquals(200, act(id, "project-end/approve", login(manager), null).status());
        ArgumentCaptor<Collection<Role>> roles = ArgumentCaptor.forClass(Collection.class);
        ArgumentCaptor<Collection<User>> people2 = ArgumentCaptor.forClass(Collection.class);
        ArgumentCaptor<String> body2 = ArgumentCaptor.forClass(String.class);
        verify(emailService).notifyStage(ArgumentMatchers.<Collection<String>>any(), roles.capture(),
                people2.capture(), org.mockito.ArgumentMatchers.contains("Project end date approved by"), body2.capture());
        assertEquals(ALL_FOUR, Set.copyOf(roles.getValue()));
        Set<String> to2 = people2.getValue().stream().map(User::getEmail).collect(java.util.stream.Collectors.toSet());
        assertEquals(Set.of(ts.lead().email(), ts.recruiter().email()), to2); // the other approver + the recruiter
        assertTrue(body2.getValue().contains("waiting for HR"));
        clearInvocations(emailService);

        // HR approves: the date is approved and everyone is told
        assertEquals(200, act(id, "project-end/approve", hr, null).status());
        ArgumentCaptor<Collection<User>> people3 = ArgumentCaptor.forClass(Collection.class);
        verify(emailService).notifyStage(ArgumentMatchers.<Collection<String>>any(), ArgumentMatchers.<Collection<Role>>any(),
                people3.capture(), org.mockito.ArgumentMatchers.contains("Project end date approved:"), anyString());
        Set<String> to3 = people3.getValue().stream().map(User::getEmail).collect(java.util.stream.Collectors.toSet());
        assertEquals(Set.of(ts.lead().email(), manager.email(), ts.recruiter().email()), to3);
    }
}
