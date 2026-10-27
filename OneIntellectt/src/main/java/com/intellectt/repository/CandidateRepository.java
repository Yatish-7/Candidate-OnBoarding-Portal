package com.intellectt.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.intellectt.model.Candidate;
import com.intellectt.model.Team;
import com.intellectt.model.User;

/**
 * The list queries fetch each candidate's recruiter and team in the SAME query
 * ({@code @EntityGraph}). Without that, building a list of N candidates triggered a
 * separate query per recruiter/team (~800 queries for one HR list under load).
 */
public interface CandidateRepository extends JpaRepository<Candidate, Long>, JpaSpecificationExecutor<Candidate> {

    /** One candidate with its recruiter and team (used for the detail page and every action). */
    @Override
    @EntityGraph(attributePaths = { "submittedBy", "submittedBy.team", "team", "team.salesLead", "team.salesManager", "sharedWithTeam" })
    Optional<Candidate> findById(Long id);

    /** The paged, filtered list (see CandidateQueries); recruiter and team in the same query. */
    @Override
    @EntityGraph(attributePaths = { "submittedBy", "submittedBy.team", "team", "team.salesLead", "team.salesManager", "sharedWithTeam" })
    Page<Candidate> findAll(Specification<Candidate> spec, Pageable pageable);

    /** Every candidate, with recruiter and team (not used for the paged list). */
    @Override
    @EntityGraph(attributePaths = { "submittedBy", "submittedBy.team", "team", "team.salesLead", "team.salesManager", "sharedWithTeam" })
    List<Candidate> findAll();

    /** How many candidates a user has submitted (used to guard a permanent delete). */
    long countBySubmittedBy(User submittedBy);

    /** All of a team's candidates (used to detach them when a team is deleted). */
    @EntityGraph(attributePaths = { "submittedBy", "submittedBy.team", "team", "team.salesLead", "team.salesManager", "sharedWithTeam" })
    List<Candidate> findByTeam(Team team);
}
