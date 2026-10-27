package com.intellectt.model;

import java.time.Instant;
import java.time.LocalDate;

import org.hibernate.envers.Audited;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonProperty.Access;
import com.intellectt.model.enums.BranchDecision;
import com.intellectt.model.enums.CandidateStatus;
import com.intellectt.model.enums.DojStatus;
import com.intellectt.model.enums.ProjectEndStatus;
import com.intellectt.security.FieldCipher;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

/**
 * A placed candidate moving through the onboarding &amp; approval flow.
 * Holds the recruiter intake fields (Section 7 of the process document) plus
 * the workflow state. HR and Contracts review in parallel, so their outcomes
 * are tracked independently via {@link #hrDecision} and {@link #contractsDecision}.
 */
@Entity
@Audited
// Indexes for the paged list: who submitted it, which team, status filter, newest-first sort
@Table(name = "candidates", indexes = {
        @Index(name = "idx_candidates_submitted_by", columnList = "submitted_by_id"),
        @Index(name = "idx_candidates_team", columnList = "team_id"),
        @Index(name = "idx_candidates_status", columnList = "status"),
        @Index(name = "idx_candidates_updated_at", columnList = "updated_at") })
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class Candidate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ----- Candidate & Recruiter -----
    @Column(nullable = false)
    private String candidateName;
    private String candidatePersonalEmail;
    private String candidateDirectNumber;
    private String recruiterName;
    private String leadOrTeamName;
    /** Which placement entity the recruiter is placing this candidate under. */
    private String internalEntity;

    /** SALES, REQ or BOTH (Sales and Req). */
    private String teamType;

    /** Optional referral amount (a number, kept as typed). */
    private String referralAmount;

    /** Optional: the recruiter who sourced the candidate, when that is someone else. */
    private String sourcingRecruiter;

    /** Optional: the sourcing recruiter's lead. */
    private String sourcingRecruiterLead;

    /** Where the recruiter works (one of the fixed offices, checked in CandidateServiceImpl). */
    private String recruiterLocation;

    /** The team's Sales Lead / Sales Manager right now. Filled in by the service for responses; never stored. */
    @Transient
    @JsonProperty(access = Access.READ_ONLY)
    private String salesLeadName;

    @Transient
    @JsonProperty(access = Access.READ_ONLY)
    private String salesManagerName;

    // ----- Client Details -----
    private String clientName;
    private String clientReportingManager;
    private String reportingManagerEmail;
    private String reportingManagerContact;

    /** The client's state, and (separately) the city / site where the work is done. */
    private String clientState;
    private String clientLocation;

    // ----- Engagement & Compliance -----
    /** W2, C2C, Full-time or Self (checked in CandidateServiceImpl). */
    private String employmentType;

    /** Optional: which company runs the candidate's payroll (one of ours, or "Other" + the name below). */
    private String payrollCompany;
    private String payrollCompanyOther;

    /** Placed with one of our own companies? If so, {@link #placementCompany} says which. */
    private Boolean internalCompanyPlacement;
    private String placementCompany;

    /** Shared with another team? If so, {@link #sharedWithTeam} says which. */
    private Boolean sharedPlacement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shared_with_team_id")
    @JsonIgnoreProperties({ "members", "salesLead", "salesManager" })
    private Team sharedWithTeam;

    private String vendor;
    private String jobRole;
    private String location;
    private String billRate;

    /** Optional discount price in dollars: the bill rate is reduced by it (see getDiscountedBillRate). */
    private String discountPrice;
    private String payRate;
    private LocalDate startDate;
    private String ccCompany;
    private String referral;
    /**
     * Full SSN: accepted on input, stored encrypted (SsnConverter), never sent back.
     * Responses carry only {@link #getSsnMasked()}.
     */
    @JsonProperty(access = Access.WRITE_ONLY)
    @Convert(converter = SsnConverter.class)
    private String ssnNo;
    private String visaStatus;
    private LocalDate workAuthorizationExpDate;
    private String relocationExpenses;
    private String payCycle;
    private Boolean existingEmployee;

    @Column(length = 4000)
    private String jobDescription;

    // ----- Ownership -----
    /** The recruiter who submitted the record. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submitted_by_id", nullable = false)
    @JsonIgnoreProperties({ "team" })
    private User submittedBy;

    /** The team the submitting recruiter belonged to (for Sales Lead visibility). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id")
    @JsonIgnoreProperties({ "members", "salesLead", "salesManager" })
    private Team team;

    // ----- Workflow state -----
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CandidateStatus status = CandidateStatus.PENDING_SALES_LEAD_APPROVAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BranchDecision hrDecision = BranchDecision.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BranchDecision contractsDecision = BranchDecision.PENDING;

    /** Payroll and Accounts review in parallel once HR and Contracts have both approved. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(255) default 'PENDING' not null")
    private BranchDecision payrollDecision = BranchDecision.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(255) default 'PENDING' not null")
    private BranchDecision accountsDecision = BranchDecision.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DojStatus dojStatus = DojStatus.NOT_RAISED;

    /** When the project ends. Set (and thereby approved) by the Sales Lead / Sales Manager after the DOJ is approved. */
    private LocalDate projectEndDate;

    /** NOT_RAISED / RAISED (waiting for approval) / APPROVED (= exited) / DECLINED. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(255) default 'NOT_RAISED' not null")
    private ProjectEndStatus projectEndStatus = ProjectEndStatus.NOT_RAISED;

    /** The actual Date of Joining, captured when the DOJ is raised. */
    private LocalDate dojDate;

    /** Last reason a record was returned to the Sales Lead (HR/Contracts decline). */
    @Column(length = 2000)
    private String lastDeclineReason;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    public Candidate() {
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCandidateName() {
        return candidateName;
    }

    public void setCandidateName(String candidateName) {
        this.candidateName = candidateName;
    }

    public String getCandidatePersonalEmail() {
        return candidatePersonalEmail;
    }

    public void setCandidatePersonalEmail(String candidatePersonalEmail) {
        this.candidatePersonalEmail = candidatePersonalEmail;
    }

    public String getCandidateDirectNumber() {
        return candidateDirectNumber;
    }

    public void setCandidateDirectNumber(String candidateDirectNumber) {
        this.candidateDirectNumber = candidateDirectNumber;
    }

    public String getRecruiterName() {
        return recruiterName;
    }

    public void setRecruiterName(String recruiterName) {
        this.recruiterName = recruiterName;
    }

    public String getLeadOrTeamName() {
        return leadOrTeamName;
    }

    public void setLeadOrTeamName(String leadOrTeamName) {
        this.leadOrTeamName = leadOrTeamName;
    }

    public String getInternalEntity() {
        return internalEntity;
    }

    public void setInternalEntity(String internalEntity) {
        this.internalEntity = internalEntity;
    }

    public String getClientName() {
        return clientName;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public String getClientReportingManager() {
        return clientReportingManager;
    }

    public void setClientReportingManager(String clientReportingManager) {
        this.clientReportingManager = clientReportingManager;
    }

    public String getReportingManagerEmail() {
        return reportingManagerEmail;
    }

    public void setReportingManagerEmail(String reportingManagerEmail) {
        this.reportingManagerEmail = reportingManagerEmail;
    }

    public String getReportingManagerContact() {
        return reportingManagerContact;
    }

    public void setReportingManagerContact(String reportingManagerContact) {
        this.reportingManagerContact = reportingManagerContact;
    }

    public String getVendor() {
        return vendor;
    }

    public void setVendor(String vendor) {
        this.vendor = vendor;
    }

    public String getJobRole() {
        return jobRole;
    }

    public void setJobRole(String jobRole) {
        this.jobRole = jobRole;
    }

    public String getSourcingRecruiter() {
        return sourcingRecruiter;
    }

    public void setSourcingRecruiter(String sourcingRecruiter) {
        this.sourcingRecruiter = sourcingRecruiter;
    }

    public String getClientLocation() {
        return clientLocation;
    }

    public void setClientLocation(String clientLocation) {
        this.clientLocation = clientLocation;
    }

    public String getClientState() {
        return clientState;
    }

    public void setClientState(String clientState) {
        this.clientState = clientState;
    }

    public String getEmploymentType() {
        return employmentType;
    }

    public void setEmploymentType(String employmentType) {
        this.employmentType = employmentType;
    }

    public Boolean getInternalCompanyPlacement() {
        return internalCompanyPlacement;
    }

    public void setInternalCompanyPlacement(Boolean internalCompanyPlacement) {
        this.internalCompanyPlacement = internalCompanyPlacement;
    }

    public String getPlacementCompany() {
        return placementCompany;
    }

    public void setPlacementCompany(String placementCompany) {
        this.placementCompany = placementCompany;
    }

    public Boolean getSharedPlacement() {
        return sharedPlacement;
    }

    public void setSharedPlacement(Boolean sharedPlacement) {
        this.sharedPlacement = sharedPlacement;
    }

    public Team getSharedWithTeam() {
        return sharedWithTeam;
    }

    public void setSharedWithTeam(Team sharedWithTeam) {
        this.sharedWithTeam = sharedWithTeam;
    }

    public BranchDecision getPayrollDecision() {
        return payrollDecision;
    }

    public void setPayrollDecision(BranchDecision payrollDecision) {
        this.payrollDecision = payrollDecision;
    }

    public BranchDecision getAccountsDecision() {
        return accountsDecision;
    }

    public void setAccountsDecision(BranchDecision accountsDecision) {
        this.accountsDecision = accountsDecision;
    }

    public String getPayrollCompany() {
        return payrollCompany;
    }

    public void setPayrollCompany(String payrollCompany) {
        this.payrollCompany = payrollCompany;
    }

    public String getPayrollCompanyOther() {
        return payrollCompanyOther;
    }

    public void setPayrollCompanyOther(String payrollCompanyOther) {
        this.payrollCompanyOther = payrollCompanyOther;
    }

    public ProjectEndStatus getProjectEndStatus() {
        return projectEndStatus;
    }

    public void setProjectEndStatus(ProjectEndStatus projectEndStatus) {
        this.projectEndStatus = projectEndStatus;
    }

    public LocalDate getProjectEndDate() {
        return projectEndDate;
    }

    public void setProjectEndDate(LocalDate projectEndDate) {
        this.projectEndDate = projectEndDate;
    }

    public String getTeamType() {
        return teamType;
    }

    public void setTeamType(String teamType) {
        this.teamType = teamType;
    }

    public String getReferralAmount() {
        return referralAmount;
    }

    public void setReferralAmount(String referralAmount) {
        this.referralAmount = referralAmount;
    }

    public String getSourcingRecruiterLead() {
        return sourcingRecruiterLead;
    }

    public void setSourcingRecruiterLead(String sourcingRecruiterLead) {
        this.sourcingRecruiterLead = sourcingRecruiterLead;
    }

    /**
     * Vendor percentage = pay rate ÷ bill rate × 100, to two decimals. Worked out from the two rates
     * every time (never stored), so a rate change updates it. Null when a rate is missing or the bill rate is 0.
     */
    @JsonProperty(access = Access.READ_ONLY)
    public java.math.BigDecimal getVendorPercentage() {
        try {
            if (billRate == null || payRate == null || billRate.isBlank() || payRate.isBlank()) {
                return null;
            }
            // with a discount the percentage is worked out from the discounted bill rate
            java.math.BigDecimal bill = effectiveBillRate();
            if (bill == null || bill.signum() == 0) {
                return null;
            }
            return new java.math.BigDecimal(payRate.trim()).multiply(java.math.BigDecimal.valueOf(100))
                    .divide(bill, 2, java.math.RoundingMode.HALF_UP);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Bill rate after the discount: bill rate − discount price, to two decimals.
     * Null when there is no discount (or no bill rate); worked out each time, never stored.
     */
    @JsonProperty(access = Access.READ_ONLY)
    public java.math.BigDecimal getDiscountedBillRate() {
        try {
            if (discountPrice == null || discountPrice.isBlank() || billRate == null || billRate.isBlank()) {
                return null;
            }
            return new java.math.BigDecimal(billRate.trim()).subtract(new java.math.BigDecimal(discountPrice.trim()))
                    .setScale(2, java.math.RoundingMode.HALF_UP);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** The bill rate that counts: the discounted one when there is a discount, else the bill rate. */
    private java.math.BigDecimal effectiveBillRate() {
        java.math.BigDecimal discounted = getDiscountedBillRate();
        if (discounted != null) {
            return discounted;
        }
        return new java.math.BigDecimal(billRate.trim());
    }

    public String getDiscountPrice() {
        return discountPrice;
    }

    public void setDiscountPrice(String discountPrice) {
        this.discountPrice = discountPrice;
    }

    public String getRecruiterLocation() {
        return recruiterLocation;
    }

    public void setRecruiterLocation(String recruiterLocation) {
        this.recruiterLocation = recruiterLocation;
    }

    public String getSalesLeadName() {
        return salesLeadName;
    }

    public void setSalesLeadName(String salesLeadName) {
        this.salesLeadName = salesLeadName;
    }

    public String getSalesManagerName() {
        return salesManagerName;
    }

    public void setSalesManagerName(String salesManagerName) {
        this.salesManagerName = salesManagerName;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getBillRate() {
        return billRate;
    }

    public void setBillRate(String billRate) {
        this.billRate = billRate;
    }

    public String getPayRate() {
        return payRate;
    }

    public void setPayRate(String payRate) {
        this.payRate = payRate;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public String getCcCompany() {
        return ccCompany;
    }

    public void setCcCompany(String ccCompany) {
        this.ccCompany = ccCompany;
    }

    public String getReferral() {
        return referral;
    }

    public void setReferral(String referral) {
        this.referral = referral;
    }

    public String getSsnNo() {
        return ssnNo;
    }

    public void setSsnNo(String ssnNo) {
        this.ssnNo = ssnNo;
    }

    /** What the API returns instead of the SSN: "***-**-1234". */
    @JsonProperty(access = Access.READ_ONLY)
    public String getSsnMasked() {
        return FieldCipher.maskSsn(ssnNo);
    }

    public String getVisaStatus() {
        return visaStatus;
    }

    public void setVisaStatus(String visaStatus) {
        this.visaStatus = visaStatus;
    }

    public LocalDate getWorkAuthorizationExpDate() {
        return workAuthorizationExpDate;
    }

    public void setWorkAuthorizationExpDate(LocalDate workAuthorizationExpDate) {
        this.workAuthorizationExpDate = workAuthorizationExpDate;
    }

    public String getRelocationExpenses() {
        return relocationExpenses;
    }

    public void setRelocationExpenses(String relocationExpenses) {
        this.relocationExpenses = relocationExpenses;
    }

    public String getPayCycle() {
        return payCycle;
    }

    public void setPayCycle(String payCycle) {
        this.payCycle = payCycle;
    }

    public Boolean getExistingEmployee() {
        return existingEmployee;
    }

    public void setExistingEmployee(Boolean existingEmployee) {
        this.existingEmployee = existingEmployee;
    }

    public String getJobDescription() {
        return jobDescription;
    }

    public void setJobDescription(String jobDescription) {
        this.jobDescription = jobDescription;
    }

    public User getSubmittedBy() {
        return submittedBy;
    }

    public void setSubmittedBy(User submittedBy) {
        this.submittedBy = submittedBy;
    }

    public Team getTeam() {
        return team;
    }

    public void setTeam(Team team) {
        this.team = team;
    }

    public CandidateStatus getStatus() {
        return status;
    }

    public void setStatus(CandidateStatus status) {
        this.status = status;
    }

    public BranchDecision getHrDecision() {
        return hrDecision;
    }

    public void setHrDecision(BranchDecision hrDecision) {
        this.hrDecision = hrDecision;
    }

    public BranchDecision getContractsDecision() {
        return contractsDecision;
    }

    public void setContractsDecision(BranchDecision contractsDecision) {
        this.contractsDecision = contractsDecision;
    }

    public DojStatus getDojStatus() {
        return dojStatus;
    }

    public void setDojStatus(DojStatus dojStatus) {
        this.dojStatus = dojStatus;
    }

    public LocalDate getDojDate() {
        return dojDate;
    }

    public void setDojDate(LocalDate dojDate) {
        this.dojDate = dojDate;
    }

    public String getLastDeclineReason() {
        return lastDeclineReason;
    }

    public void setLastDeclineReason(String lastDeclineReason) {
        this.lastDeclineReason = lastDeclineReason;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
