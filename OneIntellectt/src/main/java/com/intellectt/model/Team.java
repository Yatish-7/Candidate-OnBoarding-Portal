package com.intellectt.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.hibernate.envers.Audited;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * A sales/req team. A team has one Sales Lead and a set of recruiter members.
 * The Sales Lead can add or remove recruiters from their team.
 */
@Entity
@Audited
@Table(name = "teams")
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class Team {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    /** The Sales Lead who owns this team (shown without their own team to avoid a cycle). */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sales_lead_id")
    @JsonIgnoreProperties({ "team", "members" })
    private User salesLead;

    /** The Sales Manager who oversees this team (a manager has several teams). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sales_manager_id")
    @JsonIgnoreProperties({ "team", "members" })
    private User salesManager;

    /** Recruiters (and the lead) that belong to this team. */
    @OneToMany(mappedBy = "team", fetch = FetchType.LAZY)
    @JsonIgnoreProperties({ "team" })
    private List<User> members = new ArrayList<>();

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public Team() {
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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public User getSalesLead() {
        return salesLead;
    }

    public void setSalesLead(User salesLead) {
        this.salesLead = salesLead;
    }

    public User getSalesManager() {
        return salesManager;
    }

    public void setSalesManager(User salesManager) {
        this.salesManager = salesManager;
    }

    public List<User> getMembers() {
        return members;
    }

    public void setMembers(List<User> members) {
        this.members = members;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
