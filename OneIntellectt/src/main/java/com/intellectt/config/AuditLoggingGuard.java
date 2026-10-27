package com.intellectt.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Refuses to start the app when audit logging can't work.
 *
 * If the hibernate-envers library is missing from the runtime classpath (e.g. an
 * IDE that hasn't picked up the pom.xml dependency), Java silently ignores the
 * {@code @Audited} annotations: the app runs normally but NOTHING is written to
 * the "*_aud" log tables. For a security log that silent failure is worse than
 * not starting, so we fail fast with instructions instead.
 */
@Component
public class AuditLoggingGuard {

    private static final Logger log = LoggerFactory.getLogger(AuditLoggingGuard.class);

    public AuditLoggingGuard() {
        try {
            // Looked up by name so this class itself loads even when Envers is absent.
            Class.forName("org.hibernate.envers.Audited", false, getClass().getClassLoader());
        } catch (ClassNotFoundException ex) {
            throw new IllegalStateException(
                    "Audit logging is NOT active: hibernate-envers is missing from the runtime classpath, "
                            + "so changes would not be recorded in the *_aud log tables. "
                            + "Start the backend with Maven (./mvnw spring-boot:run), or in Eclipse/STS "
                            + "right-click OneIntellectt > Maven > Update Project (Alt+F5) and restart.");
        }
        log.info("Audit logging active (Hibernate Envers): changes are recorded in the *_aud tables.");
    }
}
