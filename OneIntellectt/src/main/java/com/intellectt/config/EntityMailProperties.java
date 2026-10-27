package com.intellectt.config;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import com.intellectt.model.enums.Role;

/**
 * Where workflow emails go for each Placement Entity, bound from the
 * {@code app.entity-mail.*} section of application.properties:
 * <ul>
 *   <li>{@code domains}: Placement Entity value → email domain
 *       (e.g. {@code novozen → novozen.com})</li>
 *   <li>{@code mailboxes}: role → mailbox name at that domain
 *       (e.g. {@code HR → hr}, giving {@code hr@novozen.com})</li>
 * </ul>
 */
@Component
@ConfigurationProperties(prefix = "app.entity-mail")
public class EntityMailProperties {

    private Map<String, String> domains = new LinkedHashMap<>();
    private Map<String, String> mailboxes = new LinkedHashMap<>();

    /**
     * true  = workflow emails go to the role mailboxes at the entity domain (hr@novozen.com …).
     * false = TESTING MODE: those mailboxes are ignored and each role's email goes to the active portal
     *         users who hold that role (the addresses on their user accounts).
     */
    private boolean mailboxRouting = true;

    /**
     * When set, every "copy the Super Admin" email goes to this one address instead of the
     * superadmin@ mailboxes / Super Admin users. Blank = off.
     */
    private String superAdminAddress;

    /**
     * The address for a role at an entity, e.g. ("novozen", HR) → "hr@novozen.com".
     * Returns null when the entity or the role's mailbox isn't configured.
     */
    public String addressFor(String internalEntity, Role role) {
        String domain = domainFor(internalEntity);
        String mailbox = lookup(mailboxes, role.name());
        return (domain == null || mailbox == null) ? null : mailbox + "@" + domain;
    }

    /** The email domain for a Placement Entity, or null if it isn't configured. */
    public String domainFor(String internalEntity) {
        return lookup(domains, internalEntity);
    }

    /**
     * Case- and separator-insensitive map lookup, so "SUPER_ADMIN", "super-admin"
     * and "superadmin" all match (Spring may normalise property keys).
     */
    private static String lookup(Map<String, String> map, String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        String wanted = normalise(key);
        for (Map.Entry<String, String> e : map.entrySet()) {
            if (normalise(e.getKey()).equals(wanted) && e.getValue() != null && !e.getValue().isBlank()) {
                return e.getValue().trim();
            }
        }
        return null;
    }

    private static String normalise(String key) {
        return key.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    public boolean isMailboxRouting() {
        return mailboxRouting;
    }

    public void setMailboxRouting(boolean mailboxRouting) {
        this.mailboxRouting = mailboxRouting;
    }

    public String getSuperAdminAddress() {
        return superAdminAddress;
    }

    public void setSuperAdminAddress(String superAdminAddress) {
        this.superAdminAddress = superAdminAddress;
    }

    public Map<String, String> getDomains() {
        return domains;
    }

    public void setDomains(Map<String, String> domains) {
        this.domains = domains;
    }

    public Map<String, String> getMailboxes() {
        return mailboxes;
    }

    public void setMailboxes(Map<String, String> mailboxes) {
        this.mailboxes = mailboxes;
    }
}
