package com.intellectt.service;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.intellectt.model.User;
import com.intellectt.model.UserSession;
import com.intellectt.model.enums.SessionEndReason;
import com.intellectt.repository.UserSessionRepository;

@Service
public class SessionServiceImpl implements SessionService {

    /** Record activity at most this often, so we don't write to the DB on every request. */
    private static final Duration TOUCH_INTERVAL = Duration.ofSeconds(30);

    private final UserSessionRepository sessions;
    private final Duration idleTimeout;
    private final Duration maxLifetime;

    public SessionServiceImpl(UserSessionRepository sessions,
            @Value("${app.session.idle-timeout-minutes:30}") long idleTimeoutMinutes,
            @Value("${app.jwt.expiration-ms:86400000}") long maxLifetimeMs) {
        this.sessions = sessions;
        this.idleTimeout = Duration.ofMinutes(idleTimeoutMinutes);
        this.maxLifetime = Duration.ofMillis(maxLifetimeMs);
    }

    @Override
    @Transactional
    public UserSession start(User user) {
        // One session per user: signing in here ends the session anywhere else.
        endAll(user, SessionEndReason.SIGNED_IN_ELSEWHERE);

        Instant now = Instant.now();
        UserSession s = new UserSession();
        s.setId(UUID.randomUUID().toString());
        s.setUser(user);
        s.setCreatedAt(now);
        s.setLastActivityAt(now);
        s.setExpiresAt(now.plus(maxLifetime));
        return sessions.save(s);
    }

    @Override
    @Transactional
    public SessionEndReason check(String sessionId, Long userId) {
        if (sessionId == null) {
            return SessionEndReason.INVALID; // e.g. a token issued before sessions existed
        }
        UserSession s = sessions.findById(sessionId).orElse(null);
        if (s == null || !s.getUser().getId().equals(userId)) {
            return SessionEndReason.INVALID;
        }
        if (!s.isLive()) {
            return SessionEndReason.from(s.getEndReason());
        }
        Instant now = Instant.now();
        if (now.isAfter(s.getExpiresAt())) {
            s.revoke(SessionEndReason.EXPIRED);
            return SessionEndReason.EXPIRED;
        }
        if (now.isAfter(s.getLastActivityAt().plus(idleTimeout))) {
            s.revoke(SessionEndReason.IDLE_TIMEOUT);
            return SessionEndReason.IDLE_TIMEOUT;
        }
        if (Duration.between(s.getLastActivityAt(), now).compareTo(TOUCH_INTERVAL) >= 0) {
            s.setLastActivityAt(now); // saved when the transaction commits
        }
        return null;
    }

    @Override
    @Transactional
    public void end(String sessionId, SessionEndReason reason) {
        if (sessionId != null) {
            sessions.findById(sessionId).ifPresent(s -> s.revoke(reason));
        }
    }

    @Override
    @Transactional
    public void endAll(User user, SessionEndReason reason) {
        sessions.findByUserAndRevokedAtIsNull(user).forEach(s -> s.revoke(reason));
    }

    @Override
    @Transactional
    public void endAllExcept(User user, String keepSessionId, SessionEndReason reason) {
        sessions.findByUserAndRevokedAtIsNull(user).stream()
                .filter(s -> !s.getId().equals(keepSessionId))
                .forEach(s -> s.revoke(reason));
    }

    @Override
    @Transactional
    public void deleteAll(User user) {
        sessions.deleteAll(sessions.findByUser(user));
    }

    @Override
    public long getIdleTimeoutMinutes() {
        return idleTimeout.toMinutes();
    }
}
