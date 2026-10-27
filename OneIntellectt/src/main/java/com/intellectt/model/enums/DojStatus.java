package com.intellectt.model.enums;

/**
 * Tracks the Date of Joining (DOJ) sign-off at the final stage.
 */
public enum DojStatus {

    /** The candidate has not joined yet; no DOJ raised. */
    NOT_RAISED,

    /** The candidate joined and the DOJ has been raised for the Sales Lead to approve. */
    RAISED,

    /** The Sales Lead approved the DOJ, confirming the joining. */
    APPROVED
}
