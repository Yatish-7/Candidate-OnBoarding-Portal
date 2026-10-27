package com.intellectt.model.enums;

/**
 * The overall position of a candidate record in the onboarding flow.
 * HR and Contracts run in parallel once the Sales Lead approves, so their
 * individual outcomes are tracked separately on the candidate (see
 * {@link BranchDecision}); this enum captures the record's main stage.
 */
public enum CandidateStatus {

    /** Submitted by the recruiter, waiting for the Sales Lead's first approval. */
    PENDING_SALES_LEAD_APPROVAL,

    /** The Sales Lead or Sales Manager declined it at the first gate; nothing goes further. */
    SALES_LEAD_DECLINED,

    /** Sales Lead approved; open to HR and Contracts in parallel. */
    IN_HR_CONTRACTS_REVIEW,

    /** HR and Contracts both approved; open to Payroll and Accounts (in parallel) to approve or decline. */
    IN_PAYROLL_ACCOUNTS_REVIEW,

    /** HR, Contracts, Payroll or Accounts declined; returned to the Sales Lead with a reason. */
    RETURNED_TO_SALES_LEAD,

    /** HR, Contracts, Payroll and Accounts all approved; the candidate review chain is complete. */
    COMPLETED,

    /** Super Admin override approval; candidate completely approved. */
    OVERRIDE_APPROVED,

    /** Super Admin override decline; candidate completely rejected. */
    OVERRIDE_REJECTED
}
