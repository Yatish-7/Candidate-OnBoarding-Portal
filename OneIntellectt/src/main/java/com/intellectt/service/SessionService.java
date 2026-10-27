package com.intellectt.service;

import com.intellectt.model.User;
import com.intellectt.model.UserSession;
import com.intellectt.model.enums.SessionEndReason;

/** Server-side sign-in sessions: one live session per user, idle timeout, revocation. */
public interface SessionService {

    /** Starts a session at login, ending the user's other sessions (one session per user). */
    UserSession start(User user);

    /**
     * Checks a session on each request and records the activity.
     *
     * @return null if the session is valid, otherwise why it isn't
     */
    SessionEndReason check(String sessionId, Long userId);

    /** Ends one session (e.g. logout). */
    void end(String sessionId, SessionEndReason reason);

    /** Ends every live session of a user (e.g. deactivated, password reset). */
    void endAll(User user, SessionEndReason reason);

    /** Ends all of the user's live sessions except {@code keepSessionId}. */
    void endAllExcept(User user, String keepSessionId, SessionEndReason reason);

    /** Removes all of a user's session rows (before the user is permanently deleted). */
    void deleteAll(User user);

    long getIdleTimeoutMinutes();
}
