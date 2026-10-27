package com.intellectt.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * The security event log: sign-ins (good and bad), lock-outs, refused access,
 * password changes. Written to logs/security.log (see logback-spring.xml), kept a
 * year, so suspicious activity can be reviewed. Data changes themselves are in the
 * audit log; this records access. No IP addresses and no passwords are ever written.
 */
public final class SecurityEvents {

    private static final Logger log = LoggerFactory.getLogger("SECURITY");

    private SecurityEvents() {
    }

    /** e.g. event("LOGIN_FAILED", email, "wrong password") */
    public static void event(String type, String who, String detail) {
        log.info("{} user={} {}", type, clean(who), clean(detail));
    }

    /** Same, as a warning (lock-outs, refused access). */
    public static void warn(String type, String who, String detail) {
        log.warn("{} user={} {}", type, clean(who), clean(detail));
    }

    /** The signed-in user's email, or "-". */
    public static String currentUser() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getPrincipal() instanceof AppUserPrincipal p ? p.getUser().getEmail() : "-";
    }

    /** Stops a crafted value (e.g. an "email" with line breaks) from forging extra log lines. */
    private static String clean(String s) {
        if (s == null) {
            return "-";
        }
        String oneLine = s.replaceAll("[\\r\\n\\t]", "_");
        return oneLine.length() > 200 ? oneLine.substring(0, 200) + "..." : oneLine;
    }
}
