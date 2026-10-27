package com.intellectt.audit;

import org.hibernate.envers.RevisionEntity;
import org.hibernate.envers.RevisionNumber;
import org.hibernate.envers.RevisionTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * One audit revision: a single transaction that changed one or more audited
 * tables. Every row in a "<table>_aud" log table points here (column "rev"), so
 * each change records WHO made it and WHEN. (IP addresses are deliberately not
 * recorded.)
 */
@Entity
@Table(name = "audit_revisions")
@RevisionEntity(AuditRevisionListener.class)
public class AuditRevision {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @RevisionNumber
    private Long id;

    /** When the change was committed (epoch millis). */
    @RevisionTimestamp
    private long timestamp;

    /** Email of the signed-in user, or "anonymous" / "system" when there is none. */
    @Column(length = 255)
    private String username;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }
}
