package com.intellectt.service;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.data.jpa.domain.Specification;

import com.intellectt.exception.BadRequestException;
import com.intellectt.model.Candidate;
import com.intellectt.model.User;
import com.intellectt.model.enums.BranchDecision;
import com.intellectt.model.enums.CandidateStatus;
import com.intellectt.model.enums.DojStatus;
import com.intellectt.model.enums.ProjectEndStatus;

import jakarta.persistence.criteria.Predicate;

/**
 * The database-side rules for the candidate list: who may see which candidates,
 * the search box, and the "status" filter. Paging, searching and filtering all
 * happen in ONE query, so the browser only ever receives one page.
 * <p>
 * The status keys (PENDING_HR, JOINED, ...) are the display statuses the frontend
 * shows as tags ({@code onboarding-portal/src/utils/status.js#getStatusKey}); the
 * two must agree. {@link #statusKey} is the single definition used for both the
 * filter and the dashboard counts.
 */
final class CandidateQueries {

    /** Statuses meaning the Sales Lead has approved the record at least once. */
    static final List<CandidateStatus> SALES_LEAD_APPROVED = List.of(
            CandidateStatus.IN_HR_CONTRACTS_REVIEW,
            CandidateStatus.IN_PAYROLL_ACCOUNTS_REVIEW,
            CandidateStatus.RETURNED_TO_SALES_LEAD,
            CandidateStatus.COMPLETED,
            CandidateStatus.OVERRIDE_APPROVED,
            CandidateStatus.OVERRIDE_REJECTED);

    /** Every status key {@link #statusKey} can produce (= the filter's allowed values). */
    static final List<String> STATUS_KEYS = List.of("PENDING_SALES_LEAD", "PENDING_HR", "PENDING_CONTRACTS",
            "PENDING_PAYROLL_ACCOUNTS", "DECLINED", "AWAITING_DOJ", "JOINED", "EXITED", "ADMIN_APPROVED", "ADMIN_REJECTED");

    /** Dashboard counter → the status keys it adds up (mirrors SUMMARY_GROUPS in status.js). */
    static final Map<String, List<String>> SUMMARY_GROUPS = Map.of(
            "pending", List.of("PENDING_SALES_LEAD", "PENDING_HR", "PENDING_CONTRACTS", "PENDING_PAYROLL_ACCOUNTS"),
            "approved", List.of("AWAITING_DOJ", "ADMIN_APPROVED"),
            "declined", List.of("DECLINED", "ADMIN_REJECTED"),
            "joined", List.of("JOINED"),
            "exited", List.of("EXITED"));

    private CandidateQueries() {
    }

    /**
     * The display status of a candidate. First match wins:
     * an override, a decline, a confirmed DOJ ("joined"), a completed review
     * ("approved, awaiting DOJ"), otherwise whichever stage is still pending.
     */
    static String statusKey(CandidateStatus status, BranchDecision contracts, DojStatus doj, boolean exited) {
        switch (status) {
            case OVERRIDE_REJECTED:
                return "ADMIN_REJECTED";
            case OVERRIDE_APPROVED:
                return "ADMIN_APPROVED";
            case RETURNED_TO_SALES_LEAD:
            case SALES_LEAD_DECLINED:
                return "DECLINED";
            case PENDING_SALES_LEAD_APPROVAL:
                return "PENDING_SALES_LEAD";
            default:
                break;
        }
        // A project end date (set by the Lead / Manager / Super Admin) means the candidate has exited
        if (exited) {
            return "EXITED";
        }
        if (doj == DojStatus.APPROVED) {
            return "JOINED";
        }
        if (status == CandidateStatus.COMPLETED) {
            return "AWAITING_DOJ";
        }
        if (status == CandidateStatus.IN_PAYROLL_ACCOUNTS_REVIEW) {
            return "PENDING_PAYROLL_ACCOUNTS";
        }
        // In HR/Contracts review: Contracts still to decide, or only HR left
        return contracts == BranchDecision.PENDING ? "PENDING_CONTRACTS" : "PENDING_HR";
    }

    /** Who may see which candidates (the same rules as opening a single candidate). */
    static Specification<Candidate> visibleTo(User actor) {
        return (root, query, cb) -> switch (actor.getRole()) {
            case SUPER_ADMIN -> cb.conjunction();
            case RECRUITER -> cb.equal(root.get("submittedBy").get("id"), actor.getId());
            case SALES_LEAD -> actor.getTeam() == null ? cb.disjunction()
                    : cb.equal(root.get("team").get("id"), actor.getTeam().getId());
            case SALES_MANAGER -> cb.equal(root.get("team").get("salesManager").get("id"), actor.getId());
            case HR, CONTRACTS -> root.get("status").in(SALES_LEAD_APPROVED);
            // Payroll and Accounts see a candidate only once HR AND Contracts have both approved
            case PAYROLL, ACCOUNTS -> cb.and(cb.equal(root.get("hrDecision"), BranchDecision.APPROVED),
                    cb.equal(root.get("contractsDecision"), BranchDecision.APPROVED));
            case ADMIN -> cb.disjunction(); // manages users/teams only, sees no candidates
        };
    }

    /** The search box: candidate name, client, job role or recruiter (case-insensitive). */
    static Specification<Candidate> matches(String search) {
        if (search == null || search.isBlank()) {
            return (root, query, cb) -> cb.conjunction();
        }
        String like = "%" + search.trim().toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(cb.coalesce(root.get("candidateName"), "")), like, '\\'),
                cb.like(cb.lower(cb.coalesce(root.get("clientName"), "")), like, '\\'),
                cb.like(cb.lower(cb.coalesce(root.get("jobRole"), "")), like, '\\'),
                cb.like(cb.lower(cb.coalesce(root.get("recruiterName"), "")), like, '\\'));
    }

    /** The status filter, as the database condition equivalent to {@link #statusKey}. */
    static Specification<Candidate> hasStatusKey(String key) {
        if (key == null || key.isBlank()) {
            return (root, query, cb) -> cb.conjunction();
        }
        if (!STATUS_KEYS.contains(key)) {
            throw new BadRequestException("Unknown status filter: " + key);
        }
        return (root, query, cb) -> {
            var status = root.get("status");
            Predicate inReview = cb.equal(status, CandidateStatus.IN_HR_CONTRACTS_REVIEW);
            Predicate dojApproved = cb.equal(root.get("dojStatus"), DojStatus.APPROVED);
            Predicate exited = cb.equal(root.get("projectEndStatus"), ProjectEndStatus.APPROVED);
            Predicate noEndDate = cb.not(exited);
            Predicate contractsPending = cb.equal(root.get("contractsDecision"), BranchDecision.PENDING);
            return switch (key) {
                case "ADMIN_REJECTED" -> cb.equal(status, CandidateStatus.OVERRIDE_REJECTED);
                case "ADMIN_APPROVED" -> cb.equal(status, CandidateStatus.OVERRIDE_APPROVED);
                case "DECLINED" -> status.in(CandidateStatus.RETURNED_TO_SALES_LEAD,
                        CandidateStatus.SALES_LEAD_DECLINED);
                case "PENDING_SALES_LEAD" -> cb.equal(status, CandidateStatus.PENDING_SALES_LEAD_APPROVAL);
                case "JOINED" -> cb.and(dojApproved, noEndDate, status.in(CandidateStatus.IN_HR_CONTRACTS_REVIEW,
                        CandidateStatus.IN_PAYROLL_ACCOUNTS_REVIEW, CandidateStatus.COMPLETED));
                case "EXITED" -> cb.and(exited, status.in(
                        CandidateStatus.IN_HR_CONTRACTS_REVIEW, CandidateStatus.IN_PAYROLL_ACCOUNTS_REVIEW,
                        CandidateStatus.COMPLETED));
                case "PENDING_PAYROLL_ACCOUNTS" -> cb.and(cb.equal(status, CandidateStatus.IN_PAYROLL_ACCOUNTS_REVIEW),
                        cb.not(dojApproved));
                case "AWAITING_DOJ" -> cb.and(cb.equal(status, CandidateStatus.COMPLETED), cb.not(dojApproved));
                case "PENDING_CONTRACTS" -> cb.and(inReview, cb.not(dojApproved), contractsPending);
                case "PENDING_HR" -> cb.and(inReview, cb.not(dojApproved), cb.not(contractsPending));
                default -> throw new BadRequestException("Unknown status filter: " + key);
            };
        };
    }
}
