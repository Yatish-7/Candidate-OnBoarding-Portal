package com.intellectt.service;

import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

import com.intellectt.exception.BadRequestException;

/** Server-side rules for passwords and email addresses (the browser checks are only a convenience). */
public final class CredentialRules {

    /** BCrypt only uses the first 72 bytes of a password (longer ones are rejected by the encoder). */
    public static final int MAX_PASSWORD_BYTES = 72;

    public static final String PASSWORD_RULE =
            "Password must be 8-72 characters and contain at least one letter and one number";

    private static final Pattern LETTER = Pattern.compile("\\p{L}");
    private static final Pattern DIGIT = Pattern.compile("\\d");
    // Deliberately simple: something@domain.tld, no spaces, no angle brackets/quotes
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@<>\"'()]+@[^\\s@<>\"'()]+\\.[^\\s@<>\"'()]+$");

    private CredentialRules() {
    }

    public static void checkPassword(String password) {
        if (password == null || password.length() < 8 || !fitsBcrypt(password)
                || !LETTER.matcher(password).find() || !DIGIT.matcher(password).find()) {
            throw new BadRequestException(PASSWORD_RULE);
        }
    }

    public static boolean fitsBcrypt(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length <= MAX_PASSWORD_BYTES;
    }

    /** Trims and validates an email address; returns the trimmed value. */
    public static String checkEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new BadRequestException("Email is required");
        }
        String trimmed = email.trim();
        if (trimmed.length() > 254 || !EMAIL.matcher(trimmed).matches()) {
            throw new BadRequestException("Please enter a valid email address");
        }
        return trimmed;
    }
}
