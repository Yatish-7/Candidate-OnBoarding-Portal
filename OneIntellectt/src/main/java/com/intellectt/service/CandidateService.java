package com.intellectt.service;

import java.util.List;
import java.util.Map;

import com.intellectt.model.ApprovalAction;
import com.intellectt.model.Candidate;
import com.intellectt.model.User;

/**
 * Drives the candidate onboarding &amp; approval flow: recruiter upload → Sales
 * Lead approval → parallel HR &amp; Contracts review → DOJ sign-off, with a Super
 * Admin override and an email at every stage.
 */
public interface CandidateService {

    Candidate submit(Candidate candidate, User recruiter, String comment);

    Candidate salesLeadApprove(Long id, User actor, String comment);

    /** Sales Lead or Sales Manager declines at the first gate (comment required). */
    Candidate salesLeadDecline(Long id, User actor, String comment);

    /** Payroll approves/declines once HR and Contracts have both approved (decline needs a comment). */
    Candidate payrollDecision(Long id, User actor, boolean approve, String comment);

    /** Accounts approves/declines once HR and Contracts have both approved (decline needs a comment). */
    Candidate accountsDecision(Long id, User actor, boolean approve, String comment);

    /** The Sales Lead / Sales Manager sets (or changes) the project end date once the DOJ is approved. */
    Candidate setProjectEndDate(Long id, User actor, java.time.LocalDate date, String comment);

    /**
     * Changes the bill and/or pay rate mid-way. Only the team's Sales Lead / Sales Manager and the
     * Super Admin may; a comment (why) is required. Everyone in the loop is emailed.
     */
    Candidate changeRates(Long id, User actor, String billRate, String payRate, String comment);

    /**
     * HR edits the candidate's details at any time (full replace of the intake fields; a blank or masked
     * SSN keeps the stored one). The change list goes on the trail and in an email to everyone in the loop.
     */
    Candidate editDetails(Long id, User actor, Candidate input);

    /** Sales Lead / Manager / Super Admin approve or decline a project end date the recruiter raised (decline needs a comment). */
    Candidate decideProjectEnd(Long id, User actor, boolean approve, String comment);

    /**
     * Drop out / back out after the DOJ is approved: the Sales Lead / Manager, HR, Contracts, Payroll, Accounts
     * or the Super Admin can mark the candidate as having left (comment required). Everyone in the loop is emailed.
     */
    Candidate dropOut(Long id, User actor, String comment);

    Candidate hrDecision(Long id, User actor, boolean approve, String comment);

    Candidate contractsDecision(Long id, User actor, boolean approve, String comment);

    Candidate approveDoj(Long id, User actor, String comment);

    Candidate superAdminOverride(Long id, User actor, boolean approve, String comment);

    /**
     * One page of the candidates this user may see, newest activity first, optionally
     * narrowed by a search term and a display-status key (e.g. "PENDING_HR").
     * Returns {content, totalElements, totalPages, number, size}.
     */
    Map<String, Object> search(User actor, String search, String status, boolean dojToday, int page, int size);

    /** Dashboard counters {pending, approved, declined, joined} over the visible candidates. */
    Map<String, Long> summary(User actor);

    Candidate getVisible(Long id, User actor);

    List<ApprovalAction> getTrail(Long id, User actor);

    Candidate getById(Long id);

    boolean canView(User actor, Candidate candidate);
}
