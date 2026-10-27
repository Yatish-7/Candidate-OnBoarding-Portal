package com.intellectt.config;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import com.intellectt.security.FieldCipher;

/**
 * One-time upgrade, safe to run on every start: encrypts any candidate SSN still
 * stored as plain text (rows saved before SSN encryption existed). Does nothing once
 * every row is encrypted. Only the live candidates table is changed; the audit
 * history is left exactly as it was recorded.
 */
@Component
public class SsnEncryptionMigration implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SsnEncryptionMigration.class);

    private final JdbcTemplate jdbc;
    private final FieldCipher cipher;

    public SsnEncryptionMigration(JdbcTemplate jdbc, FieldCipher cipher) {
        this.jdbc = jdbc;
        this.cipher = cipher;
    }

    @Override
    public void run(String... args) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, ssn_no FROM candidates WHERE ssn_no IS NOT NULL AND ssn_no <> '' AND ssn_no NOT LIKE 'enc:%'");
        for (Map<String, Object> row : rows) {
            jdbc.update("UPDATE candidates SET ssn_no = ? WHERE id = ?",
                    cipher.encrypt(row.get("ssn_no").toString()), row.get("id"));
        }
        if (!rows.isEmpty()) {
            log.info("Encrypted the SSN of {} existing candidate(s).", rows.size());
        }
    }
}
