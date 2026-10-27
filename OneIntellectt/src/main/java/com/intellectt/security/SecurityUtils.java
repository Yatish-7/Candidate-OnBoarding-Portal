package com.intellectt.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import com.intellectt.exception.ForbiddenException;
import com.intellectt.model.User;

/** Convenience access to the authenticated {@link User} in the security context. */
public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof AppUserPrincipal principal)) {
            throw new ForbiddenException("No authenticated user in context");
        }
        return principal.getUser();
    }
}
