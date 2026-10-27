package com.intellectt.repository;

import java.util.List;
import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import com.intellectt.model.Team;
import com.intellectt.model.User;
import com.intellectt.model.enums.Role;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    /** Records a sign-in time without touching anything else (no audit entry per login). */
    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.lastLoginAt = :at WHERE u.id = :id")
    void touchLastLogin(@Param("id") Long id, @Param("at") Instant at);

    boolean existsByEmail(String email);

    List<User> findByRole(Role role);

    /** The Users page: load each user's team in the same query (not one query per user). */
    @Override
    @EntityGraph(attributePaths = { "team" })
    List<User> findAll();

    List<User> findByTeam(Team team);

    List<User> findByTeamAndRole(Team team, Role role);
}
