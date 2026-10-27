package com.intellectt.service;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.intellectt.exception.BadRequestException;

/**
 * The portal is for company email ids only. Accounts can be created, and people can sign in, only with
 * an address at one of the domains in {@code app.allowed-email-domains} (comma separated, no "@").
 */
@Component
public class AllowedEmailDomains {

    private final List<String> domains;

    public AllowedEmailDomains(@Value("${app.allowed-email-domains:intellectt.com}") String configured) {
        this.domains = Arrays.stream(configured.split(","))
                .map(d -> d.trim().toLowerCase(Locale.ROOT).replaceFirst("^@", ""))
                .filter(d -> !d.isEmpty())
                .toList();
    }

    /** True when the address ends with "@" + one of the allowed domains (sub-domains don't count). */
    public boolean isAllowed(String email) {
        if (email == null) {
            return false;
        }
        int at = email.lastIndexOf('@');
        return at > 0 && domains.contains(email.substring(at + 1).trim().toLowerCase(Locale.ROOT));
    }

    /** For creating or changing an account. */
    public void requireAllowed(String email) {
        if (!isAllowed(email)) {
            throw new BadRequestException("Use a company email id. Allowed: "
                    + String.join(", ", domains.stream().map(d -> "@" + d).toList()));
        }
    }

    /** For the sign-in page. */
    public void requireAllowedForLogin(String email) {
        if (!isAllowed(email)) {
            throw new BadRequestException("Please use your correct company email id (for example name@intellectt.com).");
        }
    }
}
