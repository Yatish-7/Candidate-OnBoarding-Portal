package com.intellectt.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.intellectt.model.User;
import com.intellectt.model.UserSession;

public interface UserSessionRepository extends JpaRepository<UserSession, String> {

    /** The user's sessions that haven't ended yet. */
    List<UserSession> findByUserAndRevokedAtIsNull(User user);

    List<UserSession> findByUser(User user);
}
