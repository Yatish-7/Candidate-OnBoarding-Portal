package com.intellectt.model;

import java.time.Instant;

import org.hibernate.envers.Audited;
import org.hibernate.envers.NotAudited;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonProperty.Access;
import com.intellectt.model.enums.Role;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * A portal user. Every user has exactly one {@link Role}. Recruiters (and the
 * Sales Lead) are linked to a {@link Team}; the remaining roles are
 * organisation-wide and need no team.
 */
@Entity
@Audited
@Table(name = "users")
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false, unique = true)
    private String email;

    /** BCrypt-hashed password. Accepted on input, never returned in responses. Kept out of the audit log. */
    @JsonProperty(access = Access.WRITE_ONLY)
    @NotAudited
    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    /**
     * The team this user belongs to (recruiters) or leads (sales leads).
     * Eager so the detached JWT principal always carries its team. When this
     * user is serialised, the nested team is kept shallow (no members/lead) to
     * avoid a serialisation cycle.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "team_id")
    @JsonIgnoreProperties({ "members", "salesLead", "salesManager" })
    private Team team;

    /**
     * Recruiters only: the office they work from (one of CandidateServiceImpl.RECRUITER_LOCATIONS).
     * Copied onto every candidate they submit, so recruiters never type it in.
     */
    private String location;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    /**
     * True while the user still has a password someone else set (a new account, or one
     * an admin reset): they must choose their own before using the portal.
     * Set only by the server, never from a request.
     */
    @JsonProperty(access = Access.READ_ONLY)
    @Column(nullable = false, columnDefinition = "boolean default false not null")
    private boolean mustChangePassword;

    /** Last successful sign-in, for access reviews. Not audited (it changes at every login). */
    @JsonProperty(access = Access.READ_ONLY)
    @NotAudited
    private Instant lastLoginAt;

    public User() {
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public Team getTeam() {
        return team;
    }

    public void setTeam(Team team) {
        this.team = team;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public boolean isMustChangePassword() {
        return mustChangePassword;
    }

    public void setMustChangePassword(boolean mustChangePassword) {
        this.mustChangePassword = mustChangePassword;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(Instant lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }
}
