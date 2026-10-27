package com.intellectt.service;

import java.util.Map;

import com.intellectt.model.User;

/** Read-only access to the audit log (the Envers "*_aud" tables). Super Admin only. */
public interface AuditService {

    /**
     * One page of the combined change history across every audited table, newest
     * first. All filters are optional.
     *
     * @param entity one of USER, TEAM, CANDIDATE, APPROVAL_ACTION, PASSWORD_RESET
     * @param action 0 = created, 1 = updated, 2 = deleted
     * @param user   part of the email of whoever made the change
     * @param q      part of the record's label (email, team name, candidate name...)
     * @param from   epoch millis, inclusive
     * @param to     epoch millis, exclusive
     */
    Map<String, Object> search(User actor, String entity, Integer action, String user, String q,
            Long from, Long to, int page, int size);

    /** The record as it was at this revision, plus its previous version (or null) for a diff. */
    Map<String, Object> detail(User actor, String entity, String entityId, Long rev);
}
