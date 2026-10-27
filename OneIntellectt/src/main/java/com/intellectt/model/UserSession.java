package com.intellectt.model;

import java.time.Instant;

import org.hibernate.envers.Audited;
import org.hibernate.envers.NotAudited;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.intellectt.model.enums.SessionEndReason;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * One sign-in session. Created at login; the JWT carries its id ("sid" claim) and
 * every request checks the session is still live. Ending a session (logout,
 * signing in elsewhere, idle timeout, deactivation, password reset) revokes it
 * immediately, even though the JWT itself hasn't expired.
 */
@Entity
@Audited
// One row per sign-in, forever: find a user's sessions (at every login) without a full scan
@Table(name = "user_sessions", indexes = @Index(name = "idx_user_sessions_user", columnList = "user_id"))
public class UserSession {

    /** Random UUID; also the "sid" claim in the token. */
    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnore
    private User user;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    /** Last request seen. Not audited: it changes constantly and would flood the log. */
    @NotAudited
    @Column(nullable = false)
    private Instant lastActivityAt;

    /** Hard limit, same as the token's own expiry. */
    @Column(nullable = false)
    private Instant expiresAt;

    /** Set when the session ends; null while it is live. */
    private Instant revokedAt;

    /**
     * A {@link SessionEndReason} name. Stored as plain text (not a DB enum) so adding
     * a reason later can't trip a database CHECK constraint.
     */
    @Column(length = 32)
    private String endReason;

    public UserSession() {
    }

    public boolean isLive() {
        return revokedAt == null;
    }

    /** Ends the session now for the given reason (no-op if it already ended). */
    public void revoke(SessionEndReason reason) {
        if (revokedAt == null) {
            revokedAt = Instant.now();
            endReason = reason.name();
        }
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getLastActivityAt() {
        return lastActivityAt;
    }

    public void setLastActivityAt(Instant lastActivityAt) {
        this.lastActivityAt = lastActivityAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public void setRevokedAt(Instant revokedAt) {
        this.revokedAt = revokedAt;
    }

    public String getEndReason() {
        return endReason;
    }

    public void setEndReason(String endReason) {
        this.endReason = endReason;
    }
}
