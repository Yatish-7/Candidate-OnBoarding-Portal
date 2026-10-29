package com.intellectt.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.intellectt.exception.BadRequestException;
import com.intellectt.exception.ForbiddenException;
import com.intellectt.security.FieldCipher;
import com.intellectt.exception.ResourceNotFoundException;
import com.intellectt.model.ApprovalAction;
import com.intellectt.model.Candidate;
import com.intellectt.model.Team;
import com.intellectt.model.User;
import com.intellectt.model.enums.ActionType;
import com.intellectt.model.enums.BranchDecision;
import com.intellectt.model.enums.CandidateStatus;
import com.intellectt.model.enums.DojStatus;
import com.intellectt.model.enums.ProjectEndStatus;
import com.intellectt.model.enums.Role;
import com.intellectt.model.enums.Stage;
import com.intellectt.repository.ApprovalActionRepository;
import com.intellectt.repository.CandidateRepository;
import com.intellectt.repository.TeamRepository;
import com.intellectt.repository.UserRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Root;

@Service
public class CandidateServiceImpl implements CandidateService {

    private final CandidateRepository candidateRepository;
    private final ApprovalActionRepository approvalActionRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final TeamRepository teamRepository;
    /** Where the portal lives; the "View candidate" button in emails points at it. */
    private final String frontendBaseUrl;

    /** The offices a recruiter can work from (the form's dropdown; keep in step with options.js). */
    static final List<String> RECRUITER_LOCATIONS = List.of("Hyderabad", "Vijayawada", "Banglore", "Indore",
            "Noida", "USA");

    /** The 50 US states and DC for the client state (keep in step with options.js). */
    static final List<String> US_STATES = List.of(
            "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
            "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia", "Hawaii",
            "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
            "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
            "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
            "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
            "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
            "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
            "West Virginia", "Wisconsin", "Wyoming");

    /** Team types in the form's radio buttons (keep in step with options.js). */
    static final List<String> TEAM_TYPES = List.of("SALES", "REQ", "BOTH");

    /** The employment types in the form's dropdown (keep in step with options.js). */
    static final List<String> EMPLOYMENT_TYPES = List.of("W2", "C2C", "Full-time", "Self");

    /** Our own companies a candidate can be placed with (keep in step with options.js). */
    static final List<String> PLACEMENT_COMPANIES = List.of("novozen", "revereit", "premierlifesciences",
            "unitedpharmatechnologies", "kennedysoft", "shoolin-inc", "lumininc", "lumin-innovation",
            "kkrconsulting", "ubitz", "Intellectt", "NewMEK Software Solutions");

    /** Payroll company choices: our ten entities, or "Other" with the name typed in (keep in step with options.js). */
    static final String PAYROLL_OTHER = "Other";
    static final int MAX_PAYROLL_OTHER_LENGTH = 100;

    /** Largest page the list endpoint will return. */
    private static final int MAX_PAGE_SIZE = 100;

    @PersistenceContext
    private EntityManager entityManager;

    public CandidateServiceImpl(CandidateRepository candidateRepository,
            ApprovalActionRepository approvalActionRepository, UserRepository userRepository,
            EmailService emailService, TeamRepository teamRepository,
            @org.springframework.beans.factory.annotation.Value("${app.frontend.base-url:http://localhost:5173}") String frontendBaseUrl) {
        this.candidateRepository = candidateRepository;
        this.approvalActionRepository = approvalActionRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.teamRepository = teamRepository;
        this.frontendBaseUrl = frontendBaseUrl.endsWith("/")
                ? frontendBaseUrl.substring(0, frontendBaseUrl.length() - 1) : frontendBaseUrl;
    }

    // ---------------------------------------------------------------------
    // Stage 1 — Recruiter upload
    // ---------------------------------------------------------------------

    @Override
    @Transactional
    public Candidate submit(Candidate input, User recruiter, String comment) {
        if (recruiter.getRole() != Role.RECRUITER) {
            throw new ForbiddenException("Only a Recruiter can upload a candidate");
        }
        if (input.getCandidateName() == null || input.getCandidateName().isBlank()) {
            throw new BadRequestException("Candidate name is required");
        }
        if (!isBlank(input.getTeamType()) && !TEAM_TYPES.contains(input.getTeamType())) {
            throw new BadRequestException("Team type must be one of: " + String.join(", ", TEAM_TYPES));
        }
        if (!isBlank(input.getReferralAmount())) {
            checkRate(input.getReferralAmount(), "Referral amount");
        }
        checkDiscount(input);

        checkIntakeChoices(input);
        checkPayrollCompany(input);

        // Reload the recruiter inside this transaction so the team (and its
        // lazy sales lead) is managed, not the detached JWT principal's copy.
        User rec = userRepository.findById(recruiter.getId())
                .orElseThrow(() -> new ForbiddenException("Recruiter account not found"));

        Candidate c = new Candidate();
        applyIntake(c, input);
        applyPlacement(c, input, rec.getTeam());
        c.setSubmittedBy(rec);
        c.setRecruiterLocation(rec.getLocation()); // comes from the recruiter's profile, never from the request
        c.setTeam(rec.getTeam());
        if (isBlank(c.getRecruiterName())) {
            c.setRecruiterName(rec.getFullName());
        }
        if (isBlank(c.getLeadOrTeamName()) && rec.getTeam() != null) {
            c.setLeadOrTeamName(rec.getTeam().getName());
        }
        c.setStatus(CandidateStatus.PENDING_SALES_LEAD_APPROVAL);
        // The recruiter supplies the Date of Joining at intake; mark it raised
        // so the Sales Lead can approve it (only after approving the candidate).
        c.setDojStatus(c.getDojDate() != null ? DojStatus.RAISED : DojStatus.NOT_RAISED);

        c = candidateRepository.save(c);
        recordAction(c, recruiter, Stage.RECRUITER, ActionType.SUBMIT, comment);

        fillApprovers(c);

        // Email: on submission, only the team's Sales Lead and Sales Manager are notified
        // (not the Super Admin). Either of them can approve.
        for (User approver : approvers(c)) {
            emailService.notifyUserOnly(approver,
                    "New candidate submitted: " + c.getCandidateName(),
                    emailHtml(recruiter.getFullName() + " submitted candidate '" + c.getCandidateName()
                            + "' for your approval.", c));
        }
        return c;
    }

    // ---------------------------------------------------------------------
    // Stage 2 — Sales Lead / Sales Manager approval (pivot of the flow)
    // ---------------------------------------------------------------------

    @Override
    @Transactional
    public Candidate salesLeadApprove(Long id, User actor, String comment) {
        Candidate c = getById(id);
        assertTeamApprover(actor, c);
        if (c.getStatus() != CandidateStatus.PENDING_SALES_LEAD_APPROVAL
                && c.getStatus() != CandidateStatus.RETURNED_TO_SALES_LEAD) {
            throw new BadRequestException("Candidate is not awaiting Sales Lead approval");
        }

        // Re-route: clear any declined branch so that team can review again.
        if (c.getHrDecision() == BranchDecision.DECLINED) {
            c.setHrDecision(BranchDecision.PENDING);
        }
        if (c.getContractsDecision() == BranchDecision.DECLINED) {
            c.setContractsDecision(BranchDecision.PENDING);
        }
        if (c.getPayrollDecision() == BranchDecision.DECLINED) {
            c.setPayrollDecision(BranchDecision.PENDING);
        }
        if (c.getAccountsDecision() == BranchDecision.DECLINED) {
            c.setAccountsDecision(BranchDecision.PENDING);
        }
        c.setLastDeclineReason(null);
        recomputeStatus(c);

        c = candidateRepository.save(c);
        recordAction(c, actor, Stage.SALES_LEAD, ActionType.APPROVE, comment);

        // Email: one message to the Placement Entity's HR, Contracts, Payroll and Accounts mailboxes (plus its
        // Super Admin), e.g. hr@novozen.com, and to the team's other approver (Sales Lead / Sales Manager).
        // Payroll and Accounts hear about it now but only SEE the candidate in the portal once HR and
        // Contracts have both approved (visibility rules).
        String subject = "Candidate approved by " + roleLabel(actor) + ": " + c.getCandidateName();
        String body = emailHtml(actor.getFullName() + " approved candidate '" + c.getCandidateName()
                + "'. It is now open to HR and Contracts review; Payroll and Accounts will see it once both approve.", c);
        List<User> people = new ArrayList<>(otherApprovers(c, actor));
        if (c.getSubmittedBy() != null && !c.getSubmittedBy().getId().equals(actor.getId())) {
            people.add(c.getSubmittedBy()); // the recruiter hears about the approval too
        }
        emailService.notifyStage(emailEntities(c), List.of(Role.HR, Role.CONTRACTS, Role.PAYROLL, Role.ACCOUNTS),
                people, subject, body);
        return c;
    }

    /**
     * The Sales Lead or Sales Manager turns the candidate down at the first gate. A
     * reason is required. It ends there (the Super Admin can still override); nothing
     * goes to HR or Contracts.
     */
    @Override
    @Transactional
    public Candidate salesLeadDecline(Long id, User actor, String comment) {
        Candidate c = getById(id);
        assertTeamApprover(actor, c);
        if (c.getStatus() != CandidateStatus.PENDING_SALES_LEAD_APPROVAL
                && c.getStatus() != CandidateStatus.RETURNED_TO_SALES_LEAD) {
            throw new BadRequestException("Candidate is not awaiting Sales Lead approval");
        }
        requireComment(comment, roleLabel(actor) + " decline");

        c.setStatus(CandidateStatus.SALES_LEAD_DECLINED);
        c.setLastDeclineReason(comment);
        c = candidateRepository.save(c);
        recordAction(c, actor, Stage.SALES_LEAD, ActionType.DECLINE, comment);

        // Tell the recruiter and the other approver; copy the entity's Super Admin mailbox.
        List<User> notify = new ArrayList<>(approvers(c));
        notify.removeIf(u -> u.getId().equals(actor.getId()));
        if (c.getSubmittedBy() != null) {
            notify.add(c.getSubmittedBy());
        }
        emailService.notifyStage(emailEntities(c), List.of(), notify,
                roleLabel(actor) + " declined candidate: " + c.getCandidateName(),
                emailHtml(actor.getFullName() + " (" + roleLabel(actor) + ") declined '" + c.getCandidateName()
                        + "'. Reason: " + comment, c));
        return c;
    }

    // ---------------------------------------------------------------------
    // Stage 3A — HR review (parallel with Contracts)
    // ---------------------------------------------------------------------

    @Override
    @Transactional
    public Candidate hrDecision(Long id, User actor, boolean approve, String comment) {
        Candidate c = getById(id);
        if (actor.getRole() != Role.HR) {
            throw new ForbiddenException("Only HR can act on this stage");
        }
        // HR can only act once the Sales Lead has approved the candidate into review.
        if (c.getStatus() == CandidateStatus.PENDING_SALES_LEAD_APPROVAL
                || c.getStatus() == CandidateStatus.SALES_LEAD_DECLINED) {
            throw new BadRequestException("Candidate is not in HR review yet");
        }
        // A Super Admin override is final.
        if (c.getStatus() == CandidateStatus.OVERRIDE_APPROVED
                || c.getStatus() == CandidateStatus.OVERRIDE_REJECTED) {
            throw new BadRequestException("This candidate has been overridden by the Super Admin");
        }
        // HR may revise its decision (approve <-> decline) freely UNTIL the Date of
        // Joining is approved; after that the HR decision is locked.
        if (c.getDojStatus() == DojStatus.APPROVED) {
            throw new BadRequestException(
                    "HR's decision can no longer be changed once the Date of Joining is approved");
        }

        CandidateStatus before = c.getStatus();
        if (approve) {
            c.setHrDecision(BranchDecision.APPROVED);
            // Clear a stale HR decline reason unless another team is the one still declining.
            if (!anyBranchDeclined(c)) {
                c.setLastDeclineReason(null);
            }
            recomputeStatus(c);
            c = candidateRepository.save(c);
            recordAction(c, actor, Stage.HR, ActionType.APPROVE, comment);
            notifyBranchApproved(c, actor, "HR", before);
        } else {
            requireComment(comment, "HR decline");
            c.setHrDecision(BranchDecision.DECLINED);
            c.setLastDeclineReason(comment);
            // Payroll/Accounts approvals were given on the strength of HR's; they start over.
            c.setPayrollDecision(BranchDecision.PENDING);
            c.setAccountsDecision(BranchDecision.PENDING);
            recomputeStatus(c);
            c = candidateRepository.save(c);
            recordAction(c, actor, Stage.HR, ActionType.DECLINE, comment);
            notifyLeadOfDecline(c, "HR", comment);
        }
        return c;
    }

    // ---------------------------------------------------------------------
    // Stage 3B — Contracts review (parallel with HR)
    // ---------------------------------------------------------------------

    @Override
    @Transactional
    public Candidate contractsDecision(Long id, User actor, boolean approve, String comment) {
        Candidate c = getById(id);
        if (actor.getRole() != Role.CONTRACTS) {
            throw new ForbiddenException("Only the Contracts team can act on this stage");
        }
        if (c.getStatus() != CandidateStatus.IN_HR_CONTRACTS_REVIEW
                || c.getContractsDecision() != BranchDecision.PENDING) {
            throw new BadRequestException("Candidate is not awaiting Contracts review");
        }

        CandidateStatus before = c.getStatus();
        if (approve) {
            c.setContractsDecision(BranchDecision.APPROVED);
            recomputeStatus(c);
            c = candidateRepository.save(c);
            recordAction(c, actor, Stage.CONTRACTS, ActionType.APPROVE, comment);
            notifyBranchApproved(c, actor, "Contracts", before);
        } else {
            requireComment(comment, "Contracts decline");
            c.setContractsDecision(BranchDecision.DECLINED);
            c.setStatus(CandidateStatus.RETURNED_TO_SALES_LEAD);
            c.setLastDeclineReason(comment);
            c = candidateRepository.save(c);
            recordAction(c, actor, Stage.CONTRACTS, ActionType.DECLINE, comment);
            notifyLeadOfDecline(c, "Contracts", comment);
        }
        return c;
    }

    // ---------------------------------------------------------------------
    // Stage 3C — Payroll and Accounts (parallel, after HR and Contracts both approve)
    // ---------------------------------------------------------------------

    @Override
    @Transactional
    public Candidate payrollDecision(Long id, User actor, boolean approve, String comment) {
        return payrollAccountsDecision(id, actor, Role.PAYROLL, approve, comment);
    }

    @Override
    @Transactional
    public Candidate accountsDecision(Long id, User actor, boolean approve, String comment) {
        return payrollAccountsDecision(id, actor, Role.ACCOUNTS, approve, comment);
    }

    private Candidate payrollAccountsDecision(Long id, User actor, Role role, boolean approve, String comment) {
        boolean payroll = role == Role.PAYROLL;
        String label = payroll ? "Payroll" : "Accounts";
        Candidate c = getById(id);
        if (actor.getRole() != role) {
            throw new ForbiddenException("Only " + label + " can act on this stage");
        }
        BranchDecision mine = payroll ? c.getPayrollDecision() : c.getAccountsDecision();
        if (c.getStatus() != CandidateStatus.IN_PAYROLL_ACCOUNTS_REVIEW || mine != BranchDecision.PENDING) {
            throw new BadRequestException("Candidate is not awaiting " + label + " review");
        }
        Stage stage = payroll ? Stage.PAYROLL : Stage.ACCOUNTS;

        if (approve) {
            if (payroll) {
                c.setPayrollDecision(BranchDecision.APPROVED);
            } else {
                c.setAccountsDecision(BranchDecision.APPROVED);
            }
            recomputeStatus(c);
            c = candidateRepository.save(c);
            recordAction(c, actor, stage, ActionType.APPROVE, comment);
            if (c.getStatus() == CandidateStatus.COMPLETED) {
                // Everyone has approved: tell the team (and the recruiter) the DOJ can be approved.
                List<User> team = new ArrayList<>(approvers(c));
                if (c.getSubmittedBy() != null) {
                    team.add(c.getSubmittedBy());
                }
                emailService.notifyStage(emailEntities(c), List.of(), team,
                        "Candidate fully approved: " + c.getCandidateName(),
                        emailHtml("HR, Contracts, Payroll and Accounts have all approved '" + c.getCandidateName()
                                + "'. The Date of Joining can now be approved.", c));
            }
        } else {
            requireComment(comment, label + " decline");
            if (payroll) {
                c.setPayrollDecision(BranchDecision.DECLINED);
            } else {
                c.setAccountsDecision(BranchDecision.DECLINED);
            }
            c.setLastDeclineReason(comment);
            recomputeStatus(c);
            c = candidateRepository.save(c);
            recordAction(c, actor, stage, ActionType.DECLINE, comment);
            notifyLeadOfDecline(c, label, comment);
        }
        return c;
    }

    // ---------------------------------------------------------------------
    // Stage 4 — Date of Joining
    // ---------------------------------------------------------------------

    @Override
    @Transactional
    public Candidate approveDoj(Long id, User actor, String comment) {
        Candidate c = getById(id);
        assertTeamApprover(actor, c);
        // The Sales Lead / Manager must approve the candidate first; the DOJ approval is a
        // separate, individual action that only becomes available afterwards.
        if (c.getStatus() == CandidateStatus.PENDING_SALES_LEAD_APPROVAL
                || c.getStatus() == CandidateStatus.SALES_LEAD_DECLINED) {
            throw new BadRequestException("Approve the candidate before approving the Date of Joining");
        }
        if (c.getDojStatus() != DojStatus.RAISED) {
            throw new BadRequestException(
                    "There is no Date of Joining to approve (the recruiter must provide one)");
        }
        c.setDojStatus(DojStatus.APPROVED);
        c = candidateRepository.save(c);
        recordAction(c, actor, Stage.DOJ, ActionType.APPROVE_DOJ, comment);

        String subject = "Date of Joining confirmed: " + c.getCandidateName();
        String body = emailHtml(actor.getFullName() + " approved the Date of Joining ("
                + c.getDojDate() + ") for '" + c.getCandidateName() + "'.", c);
        emailService.notifyStage(emailEntities(c), List.of(Role.PAYROLL, Role.ACCOUNTS),
                users(c.getSubmittedBy()), subject, body);
        return c;
    }

    // ---------------------------------------------------------------------
    // Project end date (only after the DOJ is approved; approved or declined like the DOJ)
    // ---------------------------------------------------------------------

    /**
     * The recruiter RAISES a project end date (it then waits for approval); the team's Sales Lead /
     * Sales Manager or the Super Admin entering one is the approval itself, and the candidate exits.
     */
    @Override
    @Transactional
    public Candidate setProjectEndDate(Long id, User actor, java.time.LocalDate date, String comment) {
        Candidate c = getById(id);
        boolean recruiter = actor.getRole() == Role.RECRUITER;
        if (recruiter) {
            if (c.getSubmittedBy() == null || !c.getSubmittedBy().getId().equals(actor.getId())) {
                throw new ForbiddenException("You can only raise the project end date of your own candidates");
            }
        } else if (actor.getRole() != Role.SUPER_ADMIN) {
            assertTeamApprover(actor, c); // the team's own Sales Lead / Sales Manager
        }
        if (date == null) {
            throw new BadRequestException("Project end date is required");
        }
        if (c.getDojStatus() != DojStatus.APPROVED || c.getStatus() == CandidateStatus.OVERRIDE_REJECTED) {
            throw new BadRequestException("The project end date can be set once the Date of Joining is approved");
        }
        if (c.getDojDate() != null && date.isBefore(c.getDojDate())) {
            throw new BadRequestException("The project end date can't be before the Date of Joining");
        }
        String note = "Project end date: " + date + (isBlank(comment) ? "" : ". " + comment);

        if (recruiter) {
            if (c.getProjectEndStatus() == ProjectEndStatus.APPROVED) {
                throw new BadRequestException("The project end date is already approved; ask your Sales Lead or Sales Manager to change it");
            }
            c.setProjectEndDate(date);
            c.setProjectEndStatus(ProjectEndStatus.RAISED);
            c = candidateRepository.save(c);
            recordAction(c, actor, Stage.PROJECT_END, ActionType.RAISE_PROJECT_END, note);
            // the approvers (and the Super Admin) are asked to approve or decline it
            emailService.notifyStage(emailEntities(c), List.of(), approvers(c),
                    "Project end date to approve: " + c.getCandidateName(),
                    emailHtml(actor.getFullName() + " (recruiter) raised the project end date of '"
                            + c.getCandidateName() + "': " + date + ". Please approve or decline it.", c));
            return c;
        }

        boolean changed = c.getProjectEndStatus() == ProjectEndStatus.APPROVED;
        c.setProjectEndDate(date);
        c.setProjectEndStatus(ProjectEndStatus.APPROVED);
        c = candidateRepository.save(c);
        recordAction(c, actor, Stage.PROJECT_END, ActionType.SET_PROJECT_END, note);
        notifyProjectEndApproved(c, actor, changed);
        return c;
    }

    @Override
    @Transactional
    public Candidate decideProjectEnd(Long id, User actor, boolean approve, String comment) {
        Candidate c = getById(id);
        if (actor.getRole() != Role.SUPER_ADMIN) {
            assertTeamApprover(actor, c);
        }
        if (c.getProjectEndStatus() != ProjectEndStatus.RAISED) {
            throw new BadRequestException("No project end date is waiting for approval");
        }
        String date = String.valueOf(c.getProjectEndDate());
        if (approve) {
            c.setProjectEndStatus(ProjectEndStatus.APPROVED);
            c = candidateRepository.save(c);
            recordAction(c, actor, Stage.PROJECT_END, ActionType.APPROVE_PROJECT_END,
                    "Project end date: " + date + (isBlank(comment) ? "" : ". " + comment));
            notifyProjectEndApproved(c, actor, false);
        } else {
            requireComment(comment, "project end date decline");
            c.setProjectEndStatus(ProjectEndStatus.DECLINED);
            c = candidateRepository.save(c);
            recordAction(c, actor, Stage.PROJECT_END, ActionType.DECLINE_PROJECT_END,
                    "Project end date: " + date + ". " + comment);
            // the recruiter (who raised it) and the other approver hear about it; Super Admin copied
            List<User> people = new ArrayList<>(otherApprovers(c, actor));
            if (c.getSubmittedBy() != null) {
                people.add(c.getSubmittedBy());
            }
            String who = actor.getRole() == Role.SUPER_ADMIN ? "Super Admin" : roleLabel(actor);
            emailService.notifyStage(emailEntities(c), List.of(), people,
                    "Project end date declined: " + c.getCandidateName(),
                    emailHtml(actor.getFullName() + " (" + who + ") declined the project end date " + date + " of '"
                            + c.getCandidateName() + "'. Reason: " + comment, c));
        }
        return c;
    }

    /** The project end date is approved: the candidate has exited. HR, Contracts, Payroll, Accounts and everyone else hear it. */
    private void notifyProjectEndApproved(Candidate c, User actor, boolean changed) {
        List<User> people = new ArrayList<>(otherApprovers(c, actor));
        if (c.getSubmittedBy() != null && !c.getSubmittedBy().getId().equals(actor.getId())) {
            people.add(c.getSubmittedBy());
        }
        String who = actor.getRole() == Role.SUPER_ADMIN ? "Super Admin" : roleLabel(actor);
        emailService.notifyStage(emailEntities(c), List.of(Role.HR, Role.CONTRACTS, Role.PAYROLL, Role.ACCOUNTS),
                people, "Project end date " + (changed ? "changed" : "approved") + ": " + c.getCandidateName(),
                emailHtml(actor.getFullName() + " (" + who + ") " + (changed ? "changed" : "approved")
                        + " the project end date of '" + c.getCandidateName() + "': " + c.getProjectEndDate()
                        + ". The candidate has exited.", c));
    }

    // ---------------------------------------------------------------------
    // HR edits the candidate's details (any time)
    // ---------------------------------------------------------------------

    @Override
    @Transactional
    public Candidate editDetails(Long id, User actor, Candidate input) {
        if (actor.getRole() != Role.HR) {
            throw new ForbiddenException("Only HR can edit a candidate's details");
        }
        Candidate c = getById(id);
        if (!canView(actor, c)) {
            throw new ForbiddenException("You are not allowed to edit this candidate");
        }
        if (input.getCandidateName() == null || input.getCandidateName().isBlank()) {
            throw new BadRequestException("Candidate name is required");
        }
        checkIntakeChoices(input);
        checkPayrollCompany(input);
        if (!isBlank(input.getTeamType()) && !TEAM_TYPES.contains(input.getTeamType())) {
            throw new BadRequestException("Team type must be one of: " + String.join(", ", TEAM_TYPES));
        }
        if (!isBlank(input.getReferralAmount())) {
            checkRate(input.getReferralAmount(), "Referral amount");
        }
        checkDiscount(input);
        for (String rate : new String[] { input.getBillRate(), input.getPayRate() }) {
            if (!isBlank(rate)) {
                checkRate(rate, "Rate");
            }
        }

        Map<String, String> before = editableSnapshot(c);
        String storedSsn = c.getSsnNo();
        applyIntake(c, input);
        applyPlacement(c, input, c.getTeam());
        // The browser never receives the full SSN: blank or masked (***-**-1234) means "unchanged"
        boolean ssnReplaced = !isBlank(input.getSsnNo()) && !input.getSsnNo().contains("*")
                && !input.getSsnNo().equals(storedSsn);
        if (!ssnReplaced) {
            c.setSsnNo(storedSsn);
        }
        // keep the DOJ state in step with the date (an approved DOJ stays approved)
        if (c.getDojStatus() == DojStatus.NOT_RAISED && c.getDojDate() != null) {
            c.setDojStatus(DojStatus.RAISED);
        } else if (c.getDojStatus() == DojStatus.RAISED && c.getDojDate() == null) {
            c.setDojStatus(DojStatus.NOT_RAISED);
        }

        List<String> changes = new ArrayList<>();
        Map<String, String> after = editableSnapshot(c);
        for (Map.Entry<String, String> e : after.entrySet()) {
            String old = before.get(e.getKey());
            if (!java.util.Objects.equals(old, e.getValue())) {
                changes.add("Job Description".equals(e.getKey()) ? "Job Description changed"
                        : e.getKey() + ": " + old + " → " + e.getValue());
            }
        }
        if (ssnReplaced) {
            changes.add("SSN changed");
        }
        if (changes.isEmpty()) {
            throw new BadRequestException("Nothing was changed");
        }

        String summary = String.join("; ", changes);
        if (summary.length() > 1900) {
            summary = summary.substring(0, 1900) + "…";
        }
        c = candidateRepository.save(c);
        recordAction(c, actor, Stage.HR, ActionType.EDIT, summary);

        // Email everyone in the loop: HR, Contracts, Payroll and Accounts (+ Super Admin), the team's
        // Sales Lead and Sales Manager, and the recruiter.
        List<User> people = new ArrayList<>(approvers(c));
        if (c.getSubmittedBy() != null) {
            people.add(c.getSubmittedBy());
        }
        emailService.notifyStage(emailEntities(c), List.of(Role.HR, Role.CONTRACTS, Role.PAYROLL, Role.ACCOUNTS),
                people, "Candidate details edited: " + c.getCandidateName(),
                emailHtml(actor.getFullName() + " (HR) edited the details of '" + c.getCandidateName()
                        + "'. Changes: " + summary, c));
        return c;
    }

    /** The editable fields as label → display text, so two snapshots can be compared. */
    private Map<String, String> editableSnapshot(Candidate c) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("Candidate Name", show(c.getCandidateName()));
        m.put("Personal Email", show(c.getCandidatePersonalEmail()));
        m.put("Direct Number", show(c.getCandidateDirectNumber()));
        m.put("Recruiter", show(c.getRecruiterName()));
        m.put("Sourcing Recruiter", show(c.getSourcingRecruiter()));
        m.put("Sourcing Recruiter Lead", show(c.getSourcingRecruiterLead()));
        m.put("Team Type", show(c.getTeamType()));
        m.put("Lead / Team", show(c.getLeadOrTeamName()));
        m.put("Placement Entity", show(c.getInternalEntity()));
        m.put("Payroll Company", PAYROLL_OTHER.equals(c.getPayrollCompany())
                ? "Other: " + show(c.getPayrollCompanyOther()) : show(c.getPayrollCompany()));
        m.put("Client", show(c.getClientName()));
        m.put("Client State", show(c.getClientState()));
        m.put("Client Location", show(c.getClientLocation()));
        m.put("Client Reporting Manager", show(c.getClientReportingManager()));
        m.put("Reporting Manager Email", show(c.getReportingManagerEmail()));
        m.put("Reporting Manager Contact", show(c.getReportingManagerContact()));
        m.put("Vendor", show(c.getVendor()));
        m.put("Job Title", show(c.getJobRole()));
        m.put("Location", show(c.getLocation()));
        m.put("Employment Type", show(c.getEmploymentType()));
        m.put("Bill Rate", show(c.getBillRate()));
        m.put("Discount Price", show(c.getDiscountPrice()));
        m.put("Pay Rate", show(c.getPayRate()));
        m.put("Start Date", show(c.getStartDate()));
        m.put("Date of Joining", show(c.getDojDate()));
        m.put("CC Company", show(c.getCcCompany()));
        m.put("Referral", show(c.getReferral()));
        m.put("Referral Amount", show(c.getReferralAmount()));
        m.put("Visa Status", show(c.getVisaStatus()));
        m.put("Work Authorization Exp. Date", show(c.getWorkAuthorizationExpDate()));
        m.put("Relocation Expenses", show(c.getRelocationExpenses()));
        m.put("Pay Cycle", show(c.getPayCycle()));
        m.put("Existing Employee", show(c.getExistingEmployee()));
        m.put("Placed with our company", c.getInternalCompanyPlacement() == null ? "(none)"
                : c.getInternalCompanyPlacement() ? "Yes: " + show(c.getPlacementCompany()) : "No");
        m.put("Shared placement", c.getSharedPlacement() == null ? "(none)"
                : c.getSharedPlacement() ? "Yes: " + (c.getSharedWithTeam() == null ? "(none)"
                        : c.getSharedWithTeam().getName()) : "No");
        m.put("Job Description", show(c.getJobDescription()));
        return m;
    }

    private String show(Object value) {
        return value == null || value.toString().isBlank() ? "(none)" : value.toString();
    }

    // ---------------------------------------------------------------------
    // Rate change (Sales Lead / Sales Manager / Super Admin, any time)
    // ---------------------------------------------------------------------

    @Override
    @Transactional
    public Candidate changeRates(Long id, User actor, String billRate, String payRate, String comment) {
        Candidate c = getById(id);
        if (actor.getRole() != Role.SUPER_ADMIN) {
            assertTeamApprover(actor, c); // the team's own Sales Lead / Sales Manager
        }
        if (c.getStatus() == CandidateStatus.SALES_LEAD_DECLINED || c.getStatus() == CandidateStatus.OVERRIDE_REJECTED) {
            throw new BadRequestException("The rates of a declined candidate can't be changed");
        }
        requireComment(comment, "rate change");
        String newBill = isBlank(billRate) ? c.getBillRate() : checkRate(billRate, "Bill rate");
        if (!isBlank(c.getDiscountPrice()) && !isBlank(newBill)
                && new java.math.BigDecimal(c.getDiscountPrice().trim()).compareTo(new java.math.BigDecimal(newBill.trim())) > 0) {
            throw new BadRequestException("The bill rate can't be lower than the discount price");
        }
        String newPay = isBlank(payRate) ? c.getPayRate() : checkRate(payRate, "Pay rate");
        boolean billChanged = !sameRate(c.getBillRate(), newBill);
        boolean payChanged = !sameRate(c.getPayRate(), newPay);
        if (!billChanged && !payChanged) {
            throw new BadRequestException("Enter a new bill rate or pay rate");
        }

        String change = (billChanged ? "Bill rate " + shown(c.getBillRate()) + " → " + newBill : "")
                + (billChanged && payChanged ? "; " : "")
                + (payChanged ? "Pay rate " + shown(c.getPayRate()) + " → " + newPay : "");
        c.setBillRate(newBill);
        c.setPayRate(newPay);
        c = candidateRepository.save(c);
        Stage stage = actor.getRole() == Role.SUPER_ADMIN ? Stage.SUPER_ADMIN : Stage.SALES_LEAD;
        recordAction(c, actor, stage, ActionType.RATE_CHANGE, change + ". " + comment);

        // Email everyone in the loop: HR, Contracts, Payroll and Accounts (+ Super Admin), the team's
        // Sales Lead and Sales Manager, and the recruiter.
        List<User> people = new ArrayList<>(otherApprovers(c, actor));
        if (c.getSubmittedBy() != null && !c.getSubmittedBy().getId().equals(actor.getId())) {
            people.add(c.getSubmittedBy());
        }
        String who = actor.getRole() == Role.SUPER_ADMIN ? "Super Admin" : roleLabel(actor);
        emailService.notifyStage(emailEntities(c), List.of(Role.HR, Role.CONTRACTS, Role.PAYROLL, Role.ACCOUNTS),
                people, "Rates changed: " + c.getCandidateName(),
                emailHtml(actor.getFullName() + " (" + who + ") changed the rates of '" + c.getCandidateName()
                        + "': " + change + ". Reason: " + comment, c));
        return c;
    }

    /** Optional discount price: a non-negative amount that is not more than the bill rate. */
    private void checkDiscount(Candidate in) {
        if (isBlank(in.getDiscountPrice())) {
            return;
        }
        String v = checkRate(in.getDiscountPrice(), "Discount price");
        if (!isBlank(in.getBillRate())
                && new java.math.BigDecimal(v).compareTo(new java.math.BigDecimal(in.getBillRate().trim())) > 0) {
            throw new BadRequestException("The discount price can't be more than the bill rate");
        }
    }

    /** A non-negative amount such as 85 or 85.50 (kept as typed, trimmed). */
    private String checkRate(String value, String what) {
        String v = value.trim();
        try {
            if (v.length() > 20 || new java.math.BigDecimal(v).signum() < 0) {
                throw new NumberFormatException();
            }
        } catch (NumberFormatException e) {
            throw new BadRequestException(what + " must be a number, e.g. 85 or 85.50");
        }
        return v;
    }

    private boolean sameRate(String a, String b) {
        if (isBlank(a) || isBlank(b)) {
            return isBlank(a) && isBlank(b);
        }
        try {
            return new java.math.BigDecimal(a.trim()).compareTo(new java.math.BigDecimal(b.trim())) == 0;
        } catch (NumberFormatException e) {
            return a.trim().equals(b.trim());
        }
    }

    private String shown(String rate) {
        return isBlank(rate) ? "(none)" : rate;
    }

    // ---------------------------------------------------------------------
    // Super Admin override (final, overwrites the flow)
    // ---------------------------------------------------------------------

    @Override
    @Transactional
    public Candidate superAdminOverride(Long id, User actor, boolean approve, String comment) {
        Candidate c = getById(id);
        if (actor.getRole() != Role.SUPER_ADMIN) {
            throw new ForbiddenException("Only the Super Admin can override a candidate");
        }

        if (approve) {
            c.setStatus(CandidateStatus.OVERRIDE_APPROVED);
            c.setHrDecision(BranchDecision.APPROVED);
            c.setContractsDecision(BranchDecision.APPROVED);
            c.setPayrollDecision(BranchDecision.APPROVED);
            c.setAccountsDecision(BranchDecision.APPROVED);
            c = candidateRepository.save(c);
            recordAction(c, actor, Stage.SUPER_ADMIN, ActionType.OVERRIDE_APPROVE, comment);
        } else {
            requireComment(comment, "Super Admin decline");
            c.setStatus(CandidateStatus.OVERRIDE_REJECTED);
            c = candidateRepository.save(c);
            recordAction(c, actor, Stage.SUPER_ADMIN, ActionType.OVERRIDE_DECLINE, comment);
        }

        String outcome = approve ? "completely approved" : "completely rejected";
        String subject = "Super Admin override — " + c.getCandidateName() + " " + outcome;
        String body = emailHtml("Super Admin " + actor.getFullName() + " has " + outcome + " candidate '"
                + c.getCandidateName() + "'. This decision is final."
                + (comment != null && !comment.isBlank() ? " Note: " + comment : ""), c);
        emailService.notifyStage(emailEntities(c),
                List.of(Role.HR, Role.CONTRACTS, Role.ACCOUNTS, Role.PAYROLL), approvers(c), subject, body);
        return c;
    }

    // ---------------------------------------------------------------------
    // Reads / visibility
    // ---------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> search(User actor, String search, String status, int page, int size) {
        Specification<Candidate> spec = CandidateQueries.visibleTo(actor)
                .and(CandidateQueries.matches(search))
                .and(CandidateQueries.hasStatusKey(status));
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE),
                Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id"))); // latest activity first
        Page<Candidate> result = candidateRepository.findAll(spec, pageable);
        result.getContent().forEach(this::fillApprovers);

        // The shape the frontend expects (Spring's Page JSON): one page + the totals
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("content", result.getContent());
        body.put("totalElements", result.getTotalElements());
        body.put("totalPages", result.getTotalPages());
        body.put("number", result.getNumber());
        body.put("size", result.getSize());
        return body;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> summary(User actor) {
        // One small GROUP BY over the visible candidates instead of downloading them all
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Tuple> q = cb.createTupleQuery();
        Root<Candidate> root = q.from(Candidate.class);
        // 1 when the project end date is approved (the candidate has exited), else 0
        var exitedFlag = cb.<Integer>selectCase()
                .when(cb.equal(root.get("projectEndStatus"), ProjectEndStatus.APPROVED), 1).otherwise(0);
        q.multiselect(root.get("status"), root.get("contractsDecision"), root.get("dojStatus"), exitedFlag, cb.count(root))
                .where(CandidateQueries.visibleTo(actor).toPredicate(root, q, cb))
                .groupBy(root.get("status"), root.get("contractsDecision"), root.get("dojStatus"), exitedFlag);

        Map<String, Long> counts = new LinkedHashMap<>();
        for (String group : List.of("pending", "approved", "declined", "joined", "exited")) {
            counts.put(group, 0L);
        }
        for (Tuple t : entityManager.createQuery(q).getResultList()) {
            String key = CandidateQueries.statusKey(t.get(0, CandidateStatus.class),
                    t.get(1, BranchDecision.class), t.get(2, DojStatus.class), t.get(3, Integer.class) == 1);
            CandidateQueries.SUMMARY_GROUPS.forEach((group, keys) -> {
                if (keys.contains(key)) {
                    counts.merge(group, t.get(4, Long.class), Long::sum);
                }
            });
        }
        return counts;
    }

    @Override
    @Transactional(readOnly = true)
    public Candidate getVisible(Long id, User actor) {
        Candidate c = getById(id);
        if (!canView(actor, c)) {
            throw new ForbiddenException("You are not allowed to view this candidate");
        }
        return c;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ApprovalAction> getTrail(Long id, User actor) {
        Candidate c = getVisible(id, actor);
        return approvalActionRepository.findByCandidateOrderByCreatedAtAsc(c);
    }

    @Override
    public boolean canView(User actor, Candidate c) {
        return switch (actor.getRole()) {
            case SUPER_ADMIN -> true;
            case RECRUITER -> c.getSubmittedBy() != null && c.getSubmittedBy().getId().equals(actor.getId());
            case SALES_LEAD -> c.getTeam() != null && actor.getTeam() != null
                    && c.getTeam().getId().equals(actor.getTeam().getId());
            case SALES_MANAGER -> managerOf(c) != null && managerOf(c).getId().equals(actor.getId());
            case HR, CONTRACTS -> CandidateQueries.SALES_LEAD_APPROVED.contains(c.getStatus());
            // Payroll and Accounts see a candidate only once HR AND Contracts have both approved
            case PAYROLL, ACCOUNTS -> c.getHrDecision() == BranchDecision.APPROVED
                    && c.getContractsDecision() == BranchDecision.APPROVED;
            // Admin manages users/teams only and has no candidate visibility.
            case ADMIN -> false;
        };
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public Candidate getById(Long id) {
        Candidate c = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidate not found: " + id));
        fillApprovers(c);
        return c;
    }

    /** Puts the team's current Sales Lead / Sales Manager names on the candidate for the response. */
    private void fillApprovers(Candidate c) {
        c.setSalesLeadName(teamLead(c) != null ? teamLead(c).getFullName() : null);
        c.setSalesManagerName(managerOf(c) != null ? managerOf(c).getFullName() : null);
    }

    /**
     * Re-derives the status from the four branch decisions (HR and Contracts first, then
     * Payroll and Accounts). Any decline returns the candidate to the Sales Lead; when HR and
     * Contracts have both approved it moves to Payroll/Accounts review; when those two approve
     * as well it is COMPLETED. HR may revise its decision until the DOJ is approved, so this runs
     * after every decision.
     */
    private void recomputeStatus(Candidate c) {
        if (anyBranchDeclined(c)) {
            c.setStatus(CandidateStatus.RETURNED_TO_SALES_LEAD);
        } else if (c.getHrDecision() == BranchDecision.APPROVED
                && c.getContractsDecision() == BranchDecision.APPROVED) {
            c.setStatus(c.getPayrollDecision() == BranchDecision.APPROVED
                    && c.getAccountsDecision() == BranchDecision.APPROVED
                            ? CandidateStatus.COMPLETED
                            : CandidateStatus.IN_PAYROLL_ACCOUNTS_REVIEW);
        } else {
            c.setStatus(CandidateStatus.IN_HR_CONTRACTS_REVIEW);
        }
    }

    private boolean anyBranchDeclined(Candidate c) {
        return c.getHrDecision() == BranchDecision.DECLINED
                || c.getContractsDecision() == BranchDecision.DECLINED
                || c.getPayrollDecision() == BranchDecision.DECLINED
                || c.getAccountsDecision() == BranchDecision.DECLINED;
    }

    /**
     * HR or Contracts approved: HR, Contracts, Payroll and Accounts (plus the Super Admin) all get an
     * email. When this approval completes the pair, the email also says Payroll and Accounts can now
     * see and decide it.
     */
    private void notifyBranchApproved(Candidate c, User actor, String team, CandidateStatus before) {
        boolean nowOpen = before != CandidateStatus.IN_PAYROLL_ACCOUNTS_REVIEW
                && c.getStatus() == CandidateStatus.IN_PAYROLL_ACCOUNTS_REVIEW;
        emailService.notifyStage(emailEntities(c), List.of(Role.HR, Role.CONTRACTS, Role.PAYROLL, Role.ACCOUNTS),
                List.of(), team + " approved candidate: " + c.getCandidateName(),
                emailHtml(actor.getFullName() + " (" + team + ") approved '" + c.getCandidateName() + "'."
                        + (nowOpen ? " HR and Contracts have both approved, so it is now open to Payroll and Accounts." : ""), c));
    }

    /**
     * Which entities' mailboxes a stage email goes to: the candidate's Placement Entity, plus the
     * payroll company's when that is a different one of our companies (so hr@novozen.com AND
     * hr@kennedysoft.com). "Other" (a company we have no mailboxes for) adds nothing.
     */
    private List<String> emailEntities(Candidate c) {
        List<String> entities = new ArrayList<>();
        entities.add(c.getInternalEntity());
        String payroll = c.getPayrollCompany();
        String entity = c.getInternalEntity() == null ? "" : c.getInternalEntity().trim();
        if (!isBlank(payroll) && !PAYROLL_OTHER.equals(payroll) && !payroll.equalsIgnoreCase(entity)) {
            entities.add(payroll);
        }
        return entities;
    }

    /** The team's Sales Lead / Manager other than {@code actor} (so they hear what their counterpart did). */
    private List<User> otherApprovers(Candidate c, User actor) {
        List<User> list = new ArrayList<>(approvers(c));
        list.removeIf(u -> u.getId().equals(actor.getId()));
        return list;
    }

    private void notifyLeadOfDecline(Candidate c, String by, String reason) {
        // To the Sales Lead, copying the entity's Super Admin mailbox.
        emailService.notifyStage(emailEntities(c), List.of(), approvers(c),
                by + " declined candidate: " + c.getCandidateName(),
                emailHtml(by + " declined '" + c.getCandidateName() + "' and returned it to the Sales Lead / Sales Manager. Reason: " + reason, c));
    }

    /** A list of the given person, or empty when there is nobody (e.g. a team with no lead). */
    private List<User> users(User user) {
        return user == null ? List.of() : List.of(user);
    }

    private void recordAction(Candidate c, User actor, Stage stage, ActionType type, String comment) {
        ApprovalAction action = new ApprovalAction();
        action.setCandidate(c);
        action.setActor(actor);
        action.setActorRole(actor != null ? actor.getRole() : null);
        action.setStage(stage);
        action.setActionType(type);
        action.setComment(comment);
        approvalActionRepository.save(action);
    }

    private User teamLead(Candidate c) {
        return c.getTeam() != null ? c.getTeam().getSalesLead() : null;
    }

    private User managerOf(Candidate c) {
        return c.getTeam() != null ? c.getTeam().getSalesManager() : null;
    }

    /** The team's Sales Lead and Sales Manager (whichever exist): either may approve or decline. */
    private List<User> approvers(Candidate c) {
        List<User> list = new ArrayList<>();
        if (teamLead(c) != null) {
            list.add(teamLead(c));
        }
        if (managerOf(c) != null) {
            list.add(managerOf(c));
        }
        return list;
    }

    private String roleLabel(User actor) {
        return actor.getRole() == Role.SALES_MANAGER ? "Sales Manager" : "Sales Lead";
    }

    /** Only the candidate's own Sales Lead, or the Sales Manager over its team, may act. */
    private void assertTeamApprover(User actor, Candidate c) {
        if (actor.getRole() != Role.SALES_LEAD && actor.getRole() != Role.SALES_MANAGER) {
            throw new ForbiddenException("Only a Sales Lead or Sales Manager can perform this action");
        }
        User approver = actor.getRole() == Role.SALES_LEAD ? teamLead(c) : managerOf(c);
        if (approver == null || !approver.getId().equals(actor.getId())) {
            throw new ForbiddenException("You are not the Sales Lead or Sales Manager for this candidate's team");
        }
    }

    private void requireComment(String comment, String action) {
        if (isBlank(comment)) {
            throw new BadRequestException("A comment is mandatory for a " + action);
        }
    }

    /** Optional; when given it is one of the ten entities or "Other" with a name. */
    private void checkPayrollCompany(Candidate in) {
        String choice = in.getPayrollCompany();
        if (isBlank(choice)) {
            return;
        }
        if (PAYROLL_OTHER.equals(choice)) {
            String name = in.getPayrollCompanyOther();
            if (isBlank(name)) {
                throw new BadRequestException("Enter the name of the payroll company");
            }
            if (name.trim().length() > MAX_PAYROLL_OTHER_LENGTH) {
                throw new BadRequestException("The payroll company name is too long");
            }
        } else if (!PLACEMENT_COMPANIES.subList(0, 10).contains(choice)) {
            throw new BadRequestException("Choose one of the listed payroll companies, or Other");
        }
    }

    /** The dropdown-backed fields must hold one of the allowed choices (and the "if yes, which?" parts). */
    private void checkIntakeChoices(Candidate in) {
        if (!isBlank(in.getClientState()) && !US_STATES.contains(in.getClientState())) {
            throw new BadRequestException("Client state must be a US state");
        }
        if (!isBlank(in.getEmploymentType()) && !EMPLOYMENT_TYPES.contains(in.getEmploymentType())) {
            throw new BadRequestException("Employment type must be one of: " + String.join(", ", EMPLOYMENT_TYPES));
        }
        if (Boolean.TRUE.equals(in.getInternalCompanyPlacement())
                && (in.getPlacementCompany() == null || !PLACEMENT_COMPANIES.contains(in.getPlacementCompany()))) {
            throw new BadRequestException("Choose which of our companies the candidate is placed with");
        }
        if (Boolean.TRUE.equals(in.getSharedPlacement())
                && (in.getSharedWithTeam() == null || in.getSharedWithTeam().getId() == null)) {
            throw new BadRequestException("Choose the team the placement is shared with");
        }
    }

    /** "Which company" / "which team" only count when the matching answer is Yes. */
    private void applyPlacement(Candidate c, Candidate src, Team ownTeam) {
        c.setInternalCompanyPlacement(src.getInternalCompanyPlacement());
        c.setPlacementCompany(Boolean.TRUE.equals(src.getInternalCompanyPlacement()) ? src.getPlacementCompany() : null);
        c.setSharedPlacement(src.getSharedPlacement());
        Team shared = null;
        if (Boolean.TRUE.equals(src.getSharedPlacement())) {
            Long teamId = src.getSharedWithTeam().getId();
            if (ownTeam != null && ownTeam.getId().equals(teamId)) {
                throw new BadRequestException("Choose a team other than your own to share with");
            }
            shared = teamRepository.findById(teamId)
                    .orElseThrow(() -> new BadRequestException("The team you chose to share with no longer exists"));
        }
        c.setSharedWithTeam(shared);
    }

    /** Copy only the intake fields so a client cannot set workflow state directly. */
    private void applyIntake(Candidate c, Candidate src) {
        c.setCandidateName(src.getCandidateName());
        c.setCandidatePersonalEmail(src.getCandidatePersonalEmail());
        c.setCandidateDirectNumber(src.getCandidateDirectNumber());
        c.setRecruiterName(src.getRecruiterName());
        c.setSourcingRecruiter(src.getSourcingRecruiter());
        c.setDiscountPrice(isBlank(src.getDiscountPrice()) ? null : src.getDiscountPrice().trim());
        c.setSourcingRecruiterLead(src.getSourcingRecruiterLead());
        c.setTeamType(isBlank(src.getTeamType()) ? null : src.getTeamType());
        c.setReferralAmount(isBlank(src.getReferralAmount()) ? null : src.getReferralAmount().trim());
        c.setClientState(src.getClientState());
        c.setClientLocation(src.getClientLocation());
        c.setEmploymentType(src.getEmploymentType());
        c.setPayrollCompany(isBlank(src.getPayrollCompany()) ? null : src.getPayrollCompany());
        // the typed name only counts for "Other"
        c.setPayrollCompanyOther(PAYROLL_OTHER.equals(src.getPayrollCompany()) ? src.getPayrollCompanyOther().trim() : null);
        c.setLeadOrTeamName(src.getLeadOrTeamName());
        c.setInternalEntity(src.getInternalEntity());
        c.setClientName(src.getClientName());
        c.setClientReportingManager(src.getClientReportingManager());
        c.setReportingManagerEmail(src.getReportingManagerEmail());
        c.setReportingManagerContact(src.getReportingManagerContact());
        c.setVendor(src.getVendor());
        c.setJobRole(src.getJobRole());
        c.setLocation(src.getLocation());
        c.setBillRate(src.getBillRate());
        c.setPayRate(src.getPayRate());
        c.setStartDate(src.getStartDate());
        c.setCcCompany(src.getCcCompany());
        c.setReferral(src.getReferral());
        c.setSsnNo(src.getSsnNo());
        c.setVisaStatus(src.getVisaStatus());
        c.setWorkAuthorizationExpDate(src.getWorkAuthorizationExpDate());
        c.setRelocationExpenses(src.getRelocationExpenses());
        c.setPayCycle(src.getPayCycle());
        c.setExistingEmployee(src.getExistingEmployee());
        c.setJobDescription(src.getJobDescription());
        c.setDojDate(src.getDojDate());
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    /**
     * Builds a structured HTML email: a short intro line followed by the candidate's
     * details laid out in a clean table (instead of raw text).
     */
    private String emailHtml(String intro, Candidate c) {
        StringBuilder rows = new StringBuilder();
        row(rows, "Candidate Name", c.getCandidateName());
        row(rows, "Personal Email", c.getCandidatePersonalEmail());
        row(rows, "Direct Number", c.getCandidateDirectNumber());
        row(rows, "Recruiter", c.getRecruiterName());
        row(rows, "Sourcing Recruiter", c.getSourcingRecruiter());
        row(rows, "Sourcing Recruiter Lead", c.getSourcingRecruiterLead());
        row(rows, "Recruiter Location", c.getRecruiterLocation());
        row(rows, "Lead / Team", c.getLeadOrTeamName());
        row(rows, "Sales Lead", c.getSalesLeadName());
        row(rows, "Sales Manager", c.getSalesManagerName());
        row(rows, "Team Type", "BOTH".equals(c.getTeamType()) ? "Sales & Req" : c.getTeamType());
        row(rows, "Placement Entity", c.getInternalEntity());
        row(rows, "Client", c.getClientName());
        row(rows, "Client Reporting Manager", c.getClientReportingManager());
        row(rows, "Reporting Manager Email", c.getReportingManagerEmail());
        row(rows, "Reporting Manager Contact", c.getReportingManagerContact());
        row(rows, "Vendor", c.getVendor());
        row(rows, "Job Title", c.getJobRole());
        row(rows, "Location", c.getLocation());
        row(rows, "Client State", c.getClientState());
        row(rows, "Client Location", c.getClientLocation());
        row(rows, "Employment Type", c.getEmploymentType());
        row(rows, "Payroll Company", PAYROLL_OTHER.equals(c.getPayrollCompany())
                ? "Other: " + c.getPayrollCompanyOther() : c.getPayrollCompany());
        row(rows, "Placed with our company", c.getInternalCompanyPlacement() == null ? null
                : c.getInternalCompanyPlacement() ? "Yes: " + c.getPlacementCompany() : "No");
        row(rows, "Shared placement", c.getSharedPlacement() == null ? null
                : c.getSharedPlacement() ? "Yes: " + c.getSharedWithTeam().getName() : "No");
        row(rows, "Bill Rate", c.getBillRate());
        row(rows, "Discount Price", c.getDiscountPrice());
        row(rows, "Discounted Bill Rate", c.getDiscountedBillRate());
        row(rows, "Pay Rate", c.getPayRate());
        row(rows, "Vendor Percentage", c.getVendorPercentage() == null ? null : c.getVendorPercentage() + "%");
        row(rows, "Start Date", c.getStartDate());
        row(rows, "C-C Company", c.getCcCompany());
        row(rows, "Referral", c.getReferral());
        row(rows, "Referral Amount", c.getReferralAmount());
        row(rows, "SSN No", FieldCipher.maskSsn(c.getSsnNo()));
        row(rows, "Visa Status", c.getVisaStatus());
        row(rows, "Work Authorization Exp. Date", c.getWorkAuthorizationExpDate());
        row(rows, "Relocation Expenses", c.getRelocationExpenses());
        row(rows, "Pay Cycle", c.getPayCycle());
        row(rows, "Existing Employee", c.getExistingEmployee());
        row(rows, "Date of Joining", c.getDojDate());
        row(rows, "Project End Date", c.getProjectEndDate());
        row(rows, "Job Description", c.getJobDescription());
        if (c.getLastDeclineReason() != null && !c.getLastDeclineReason().isBlank()) {
            row(rows, "Last Decline Reason", c.getLastDeclineReason());
        }

        return "<div style=\"font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:14px;"
                + "max-width:660px;margin:0 auto;padding:8px\">"
                + "<p style=\"margin:0 0 16px;line-height:1.5\">" + esc(intro) + "</p>"
                + "<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" "
                + "style=\"border-collapse:collapse;width:100%;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden\">"
                + "<thead><tr><th colspan=\"2\" style=\"text-align:left;background:#4f46e5;color:#ffffff;"
                + "padding:12px 16px;font-size:15px;letter-spacing:.3px\">Candidate Details</th></tr></thead>"
                + "<tbody>" + rows + "</tbody></table>"
                + "<p style=\"margin:20px 0 0\"><a href=\"" + esc(frontendBaseUrl + "/candidates/" + c.getId())
                + "\" style=\"display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;"
                + "font-weight:600;padding:12px 22px;border-radius:8px\">View candidate</a></p>"
                + "<p style=\"margin:8px 0 0;color:#94a3b8;font-size:12px\">Opens this candidate in the portal "
                + "(sign in first if asked).</p>"
                + "<p style=\"margin:16px 0 0;color:#94a3b8;font-size:12px\">Current status: "
                + esc(String.valueOf(c.getStatus())) + " &middot; One Intellectt — Candidate Onboarding</p>"
                + "</div>";
    }

    private void row(StringBuilder sb, String label, Object value) {
        String v = (value == null || value.toString().isBlank()) ? "&mdash;" : esc(value.toString());
        sb.append("<tr>")
                .append("<td style=\"padding:9px 16px;border-top:1px solid #eef2f7;")
                .append("background:#f8fafc;color:#475569;width:42%;font-weight:600;vertical-align:top\">")
                .append(esc(label)).append("</td>")
                .append("<td style=\"padding:9px 16px;border-top:1px solid #eef2f7;vertical-align:top\">")
                .append(v).append("</td>")
                .append("</tr>");
    }

    private String esc(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    /** Mask the SSN to the last 4 digits so full SSNs aren't sent in plaintext email. */
}
