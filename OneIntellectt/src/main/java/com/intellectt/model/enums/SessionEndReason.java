package com.intellectt.model.enums;

/**
 * Why a sign-in session ended. Stored on the session and sent to the browser (in
 * the 401 response) so the login page can explain what happened.
 */
public enum SessionEndReason {

    SIGNED_OUT("You signed out."),
    SIGNED_IN_ELSEWHERE("You were signed out because your account signed in on another device or browser."),
    IDLE_TIMEOUT("You were signed out after a period of inactivity."),
    ACCOUNT_DEACTIVATED("Your account has been deactivated."),
    PASSWORD_RESET("Your password was reset. Please sign in again."),
    EXPIRED("Your session has expired. Please sign in again."),
    INVALID("Please sign in to continue.");

    private final String message;

    SessionEndReason(String message) {
        this.message = message;
    }

    public String getMessage() {
        return message;
    }

    /** Parses a stored reason, defaulting to INVALID for anything unknown. */
    public static SessionEndReason from(String value) {
        if (value != null) {
            for (SessionEndReason r : values()) {
                if (r.name().equals(value)) {
                    return r;
                }
            }
        }
        return INVALID;
    }
}
