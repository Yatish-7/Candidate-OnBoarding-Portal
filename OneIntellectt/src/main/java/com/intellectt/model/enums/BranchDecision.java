package com.intellectt.model.enums;

/**
 * The outcome of a single parallel review branch (HR or Contracts).
 */
public enum BranchDecision {

    /** Not yet acted on (also the reset state after a Sales Lead re-routes). */
    PENDING,

    /** Branch approved (HR → Payroll visibility, Contracts → Accounts visibility). */
    APPROVED,

    /** Branch declined; record returns to the Sales Lead with a reason. */
    DECLINED
}
