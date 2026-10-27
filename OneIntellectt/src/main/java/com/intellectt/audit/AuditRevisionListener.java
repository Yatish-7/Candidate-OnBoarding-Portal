package com.intellectt.audit;

import org.hibernate.envers.RevisionListener;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;

import com.intellectt.security.AppUserPrincipal;

/**
 * Fills in who made a change each time Envers opens a new audit revision. Runs
 * inside the request that made the change.
 */
public class AuditRevisionListener implements RevisionListener {

    @Override
    public void newRevision(Object revisionEntity) {
        AuditRevision rev = (AuditRevision) revisionEntity;
        rev.setUsername(currentUsername());
    }

    private String currentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AppUserPrincipal principal) {
            return principal.getUser().getEmail();
        }
        // Public endpoints (forgot/reset password) have no signed-in user; startup
        // seeding has no request at all.
        return RequestContextHolder.getRequestAttributes() != null ? "anonymous" : "system";
    }
}
