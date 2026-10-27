package com.intellectt.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.intellectt.model.Team;
import com.intellectt.model.User;

public interface TeamRepository extends JpaRepository<Team, Long> {

    Optional<Team> findByName(String name);

    boolean existsByName(String name);

    Optional<Team> findBySalesLead(User salesLead);

    /** Every team a Sales Manager oversees. */
    List<Team> findBySalesManager(User salesManager);

    /** One team with its lead and members (returned by every team action). */
    @Override
    @EntityGraph(attributePaths = { "salesLead", "salesManager", "members" })
    Optional<Team> findById(Long id);

    /** The Teams page: load each team's lead and members in the same query. */
    @Override
    @EntityGraph(attributePaths = { "salesLead", "salesManager", "members" })
    List<Team> findAll();
}
