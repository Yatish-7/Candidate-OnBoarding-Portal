package com.intellectt.repository;

import java.util.List;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.intellectt.model.ApprovalAction;
import com.intellectt.model.Candidate;
import com.intellectt.model.User;

public interface ApprovalActionRepository extends JpaRepository<ApprovalAction, Long> {

    /** The full approval trail for a candidate, oldest first, with who acted (one query). */
    @EntityGraph(attributePaths = { "actor" })
    List<ApprovalAction> findByCandidateOrderByCreatedAtAsc(Candidate candidate);

    /** Trail entries recorded by a given user (used to detach them on a permanent delete). */
    List<ApprovalAction> findByActor(User actor);
}
