package com.intellectt.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.intellectt.model.ApprovalAction;
import com.intellectt.model.Candidate;
import com.intellectt.security.AppUserPrincipal;
import com.intellectt.service.CandidateFilter;
import com.intellectt.service.CandidateService;

/**
 * Candidate onboarding &amp; approval endpoints. The acting user is taken from the
 * JWT; each stage enforces its own role and team rules in the service layer.
 * Decision endpoints take an optional {@code comment} request parameter
 * (required on declines).
 */
@RestController
@RequestMapping("/api/candidates")
public class CandidateController {

    private final CandidateService candidateService;

    public CandidateController(CandidateService candidateService) {
        this.candidateService = candidateService;
    }

    // ----- Stage 1: Recruiter upload -----
    @PostMapping
    public ResponseEntity<Candidate> submit(@RequestBody Candidate candidate,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.submit(candidate, principal.getUser(), comment));
    }

    // ----- Reads -----
    /**
     * One page of candidates: ?page=0&size=20&search=&status=&dojToday= (page is 0-based, size max 100), plus the
     * optional filters of {@link CandidateFilter}: dateField, from, to (yyyy-MM-dd), recruiterId, teamId,
     * employmentType, internalEntity, clientState, recruiterLocation, payrollCompany.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> list(@RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "false") boolean dojToday,
            @RequestParam(required = false) String dateField,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long recruiterId,
            @RequestParam(required = false) Long teamId,
            @RequestParam(required = false) String employmentType,
            @RequestParam(required = false) String internalEntity,
            @RequestParam(required = false) String clientState,
            @RequestParam(required = false) String recruiterLocation,
            @RequestParam(required = false) String payrollCompany,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.search(principal.getUser(), search, status, dojToday,
                new CandidateFilter(dateField, from, to, recruiterId, teamId, employmentType, internalEntity, clientState,
                        recruiterLocation, payrollCompany), page, size));
    }

    /** Dashboard counters {pending, approved, declined, joined, exited}, computed on the server. */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Long>> summary(@RequestParam(required = false) String dateField,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long recruiterId,
            @RequestParam(required = false) Long teamId,
            @RequestParam(required = false) String employmentType,
            @RequestParam(required = false) String internalEntity,
            @RequestParam(required = false) String clientState,
            @RequestParam(required = false) String recruiterLocation,
            @RequestParam(required = false) String payrollCompany,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.summary(principal.getUser(),
                new CandidateFilter(dateField, from, to, recruiterId, teamId, employmentType, internalEntity, clientState,
                        recruiterLocation, payrollCompany)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Candidate> get(@PathVariable Long id,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.getVisible(id, principal.getUser()));
    }

    @GetMapping("/{id}/trail")
    public ResponseEntity<List<ApprovalAction>> trail(@PathVariable Long id,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.getTrail(id, principal.getUser()));
    }

    // ----- HR edits the details (any time); everyone in the loop is emailed -----
    @PutMapping("/{id}")
    public ResponseEntity<Candidate> edit(@PathVariable Long id, @RequestBody Candidate candidate,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.editDetails(id, principal.getUser(), candidate));
    }

    // ----- Stage 2: Sales Lead or Sales Manager (either one is enough) -----
    @PostMapping("/{id}/sales-lead/approve")
    public ResponseEntity<Candidate> salesLeadApprove(@PathVariable Long id,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.salesLeadApprove(id, principal.getUser(), comment));
    }

    @PostMapping("/{id}/sales-lead/decline")
    public ResponseEntity<Candidate> salesLeadDecline(@PathVariable Long id,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.salesLeadDecline(id, principal.getUser(), comment));
    }

    // ----- Stage 3A: HR -----
    @PostMapping("/{id}/hr/approve")
    public ResponseEntity<Candidate> hrApprove(@PathVariable Long id,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.hrDecision(id, principal.getUser(), true, comment));
    }

    @PostMapping("/{id}/hr/decline")
    public ResponseEntity<Candidate> hrDecline(@PathVariable Long id,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.hrDecision(id, principal.getUser(), false, comment));
    }

    // ----- Stage 3B: Contracts -----
    @PostMapping("/{id}/contracts/approve")
    public ResponseEntity<Candidate> contractsApprove(@PathVariable Long id,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.contractsDecision(id, principal.getUser(), true, comment));
    }

    @PostMapping("/{id}/contracts/decline")
    public ResponseEntity<Candidate> contractsDecline(@PathVariable Long id,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.contractsDecision(id, principal.getUser(), false, comment));
    }

    // ----- Stage 3C: Payroll and Accounts (after HR and Contracts both approve) -----
    @PostMapping("/{id}/payroll/approve")
    public ResponseEntity<Candidate> payrollApprove(@PathVariable Long id,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.payrollDecision(id, principal.getUser(), true, comment));
    }

    @PostMapping("/{id}/payroll/decline")
    public ResponseEntity<Candidate> payrollDecline(@PathVariable Long id,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.payrollDecision(id, principal.getUser(), false, comment));
    }

    @PostMapping("/{id}/accounts/approve")
    public ResponseEntity<Candidate> accountsApprove(@PathVariable Long id,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.accountsDecision(id, principal.getUser(), true, comment));
    }

    @PostMapping("/{id}/accounts/decline")
    public ResponseEntity<Candidate> accountsDecline(@PathVariable Long id,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.accountsDecision(id, principal.getUser(), false, comment));
    }

    // ----- Date of Joining (recruiter supplies the date at intake; Sales Lead approves) -----
    @PostMapping("/{id}/doj/approve")
    public ResponseEntity<Candidate> approveDoj(@PathVariable Long id,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.approveDoj(id, principal.getUser(), comment));
    }

    // ----- Project end date: the recruiter raises it, the Lead / Manager / Super Admin approve or decline (after the DOJ is approved) -----
    @PostMapping("/{id}/project-end")
    public ResponseEntity<Candidate> setProjectEnd(@PathVariable Long id,
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate date,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.setProjectEndDate(id, principal.getUser(), date, comment));
    }

    // ----- Rate change (Sales Lead / Sales Manager / Super Admin; comment required) -----
    @PostMapping("/{id}/rates")
    public ResponseEntity<Candidate> changeRates(@PathVariable Long id,
            @RequestParam(required = false) String billRate,
            @RequestParam(required = false) String payRate,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.changeRates(id, principal.getUser(), billRate, payRate, comment));
    }

    @PostMapping("/{id}/project-end/approve")
    public ResponseEntity<Candidate> approveProjectEnd(@PathVariable Long id,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.decideProjectEnd(id, principal.getUser(), true, comment));
    }

    @PostMapping("/{id}/project-end/decline")
    public ResponseEntity<Candidate> declineProjectEnd(@PathVariable Long id,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.decideProjectEnd(id, principal.getUser(), false, comment));
    }

    // ----- Drop out / back out (after the DOJ is approved; comment required) -----
    @PostMapping("/{id}/drop-out")
    public ResponseEntity<Candidate> dropOut(@PathVariable Long id,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.dropOut(id, principal.getUser(), comment));
    }

    // ----- Super Admin override -----
    @PostMapping("/{id}/override/approve")
    public ResponseEntity<Candidate> overrideApprove(@PathVariable Long id,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.superAdminOverride(id, principal.getUser(), true, comment));
    }

    @PostMapping("/{id}/override/decline")
    public ResponseEntity<Candidate> overrideDecline(@PathVariable Long id,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(candidateService.superAdminOverride(id, principal.getUser(), false, comment));
    }
}
