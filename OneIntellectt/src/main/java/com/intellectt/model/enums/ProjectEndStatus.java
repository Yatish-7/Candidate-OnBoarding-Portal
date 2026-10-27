package com.intellectt.model.enums;

/** Where the project end date is in its approval (like the Date of Joining). Exited = APPROVED. */
public enum ProjectEndStatus {

    /** No project end date yet. */
    NOT_RAISED,

    /** The recruiter raised a date; the Sales Lead / Sales Manager / Super Admin has yet to approve or decline it. */
    RAISED,

    /** Approved (or entered by an approver): the candidate has exited. */
    APPROVED,

    /** Declined with a reason; the recruiter can raise a new date. */
    DECLINED
}
