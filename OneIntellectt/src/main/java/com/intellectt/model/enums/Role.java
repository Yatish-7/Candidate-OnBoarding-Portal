package com.intellectt.model.enums;

/**
 * The roles that participate in the candidate onboarding &amp; approval process.
 * Each role has a different responsibility and visibility, as described in the
 * process document.
 */
public enum Role {

    /** Uploads (posts) the candidate record once a candidate is placed. */
    RECRUITER,

    /** First approval gate for their own team; pivot of the whole flow. */
    SALES_LEAD,

    /**
     * Oversees several teams (3-5 usually, no hard limit). Sees their candidates and may
     * approve or decline them just like the teams' Sales Leads; either one is enough.
     */
    SALES_MANAGER,

    /** Reviews in parallel with Contracts after Sales Lead approval. */
    HR,

    /** Reviews in parallel with HR after Sales Lead approval. */
    CONTRACTS,

    /** View-only; gains visibility once HR approves. */
    PAYROLL,

    /** View-only; gains visibility once Contracts approves. */
    ACCOUNTS,

    /**
     * Manages users and teams only. Can add, edit, deactivate and delete users
     * (any role except Super Admin) and manage teams, but has NO visibility into
     * candidates or the approval workflow.
     */
    ADMIN,

    /** CEO / President. Full oversight and a final override on any candidate. */
    SUPER_ADMIN
}
