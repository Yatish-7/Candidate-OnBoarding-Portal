package com.intellectt.service;

import java.util.Collection;
import java.util.List;

import com.intellectt.model.User;
import com.intellectt.model.enums.Role;

/** Sends the stage-by-stage notifications described in the process document. */
public interface EmailService {

    /**
     * Sends ONE workflow email for a stage, always copying the Super Admin.
     * <p>
     * Recipients are driven by the candidate's Placement Entity: each role in
     * {@code roles} (and the Super Admin) is emailed at its entity mailbox, e.g.
     * entity "novozen" + HR → hr@novozen.com (see {@code app.entity-mail.*}). If the
     * entity is blank or not configured, it falls back to the active portal users
     * who hold those roles. {@code users} are individual people (the Sales Lead,
     * the recruiter) who are always emailed directly.
     */
    void notifyStage(String internalEntity, Collection<Role> roles, Collection<User> users,
            String subject, String body);

    /**
     * Same as above for several Internal Entities at once, in ONE email: each role's mailbox
     * at every entity is a recipient (e.g. hr@novozen.com and hr@kennedysoft.com), and the
     * Super Admin of each is copied. {@code users} are emailed once.
     */
    void notifyStage(Collection<String> internalEntities, Collection<Role> roles, Collection<User> users,
            String subject, String body);

    /** Notifies only this user, WITHOUT copying the Super Admin. */
    void notifyUserOnly(User user, String subject, String body);

    void send(List<String> recipients, String subject, String body);
}
