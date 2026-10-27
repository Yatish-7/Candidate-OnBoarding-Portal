package com.intellectt.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.intellectt.exception.BadRequestException;
import com.intellectt.exception.ForbiddenException;
import com.intellectt.exception.ResourceNotFoundException;
import com.intellectt.model.User;
import com.intellectt.security.FieldCipher;
import com.intellectt.model.enums.Role;

/**
 * Reads the Envers audit tables with plain SQL so every table's history can be
 * shown as one timeline. Table names come only from the fixed {@link #TABLES}
 * list below — request input is never put into SQL text, only bound as values.
 */
@Service
public class AuditServiceImpl implements AuditService {

    /** entity key → { audit table, SQL for a human-readable label of the record } */
    private static final Map<String, String[]> TABLES = new LinkedHashMap<>();
    static {
        TABLES.put("USER", new String[] { "users_aud", "a.email" });
        TABLES.put("TEAM", new String[] { "teams_aud", "a.name" });
        TABLES.put("CANDIDATE", new String[] { "candidates_aud", "a.candidate_name" });
        TABLES.put("APPROVAL_ACTION", new String[] { "approval_actions_aud", "a.action_type || ' · ' || a.stage" });
        TABLES.put("PASSWORD_RESET", new String[] { "password_reset_tokens_aud", "'User #' || a.user_id" });
        TABLES.put("SESSION", new String[] { "user_sessions_aud",
                "'User #' || a.user_id || COALESCE(' · ended: ' || a.end_reason, '')" });
    }

    private static final int MAX_PAGE_SIZE = 100;

    private final JdbcTemplate jdbc;

    private final FieldCipher cipher;

    public AuditServiceImpl(JdbcTemplate jdbc, FieldCipher cipher) {
        this.jdbc = jdbc;
        this.cipher = cipher;
    }

    @Override
    public Map<String, Object> search(User actor, String entity, Integer action, String user, String q,
            Long from, Long to, int page, int size) {
        assertSuperAdmin(actor);
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageNo = Math.max(page, 0);

        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (entity != null && !entity.isBlank()) {
            tableFor(entity); // validates the key
            where.append(" AND x.entity = ?");
            args.add(entity);
        }
        if (action != null) {
            where.append(" AND x.revtype = ?");
            args.add(action);
        }
        if (user != null && !user.isBlank()) {
            where.append(" AND x.username ILIKE ?");
            args.add(containsPattern(user));
        }
        if (q != null && !q.isBlank()) {
            where.append(" AND x.label ILIKE ?");
            args.add(containsPattern(q));
        }
        if (from != null) {
            where.append(" AND x.ts >= ?");
            args.add(from);
        }
        if (to != null) {
            where.append(" AND x.ts < ?");
            args.add(to);
        }

        String base = "FROM (" + unionSql() + ") x" + where;
        Long total = jdbc.queryForObject("SELECT count(*) " + base, Long.class, args.toArray());

        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(pageSize);
        pageArgs.add((long) pageNo * pageSize);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * " + base + " ORDER BY x.rev DESC, x.entity, x.entity_id LIMIT ? OFFSET ?",
                pageArgs.toArray());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content", rows);
        result.put("totalElements", total == null ? 0 : total);
        result.put("page", pageNo);
        result.put("size", pageSize);
        return result;
    }

    @Override
    public Map<String, Object> detail(User actor, String entity, String entityId, Long rev) {
        assertSuperAdmin(actor);
        String table = tableFor(entity)[0];
        // This revision's row and the one before it (if any), newest first.
        List<Map<String, Object>> rows = jdbc.queryForList(
                // ids are numbers in most tables but UUID text for sessions, so compare as text
                "SELECT * FROM " + table + " WHERE id::text = ? AND rev <= ? ORDER BY rev DESC LIMIT 2",
                entityId, rev);
        if (rows.isEmpty() || !rev.equals(((Number) rows.get(0).get("rev")).longValue())) {
            throw new ResourceNotFoundException("No audit entry for " + entity + " #" + entityId + " at revision " + rev);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("current", clean(rows.get(0)));
        result.put("previous", rows.size() > 1 ? clean(rows.get(1)) : null);
        return result;
    }

    private String unionSql() {
        StringJoiner union = new StringJoiner(" UNION ALL ");
        for (Map.Entry<String, String[]> e : TABLES.entrySet()) {
            union.add("SELECT r.id AS rev, r.timestamp AS ts, r.username, '"
                    + e.getKey() + "' AS entity, a.id::text AS entity_id, a.revtype, "
                    + e.getValue()[1] + " AS label FROM " + e.getValue()[0]
                    + " a JOIN audit_revisions r ON r.id = a.rev");
        }
        return union.toString();
    }

    /** Drops the bookkeeping columns and masks the SSN to its last four digits. */
    private Map<String, Object> clean(Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>(row);
        out.remove("rev");
        out.remove("revtype");
        if (out.get("ssn_no") != null) {
            // Stored encrypted (older rows may be plain); either way show only the last four digits
            String ssn = out.get("ssn_no").toString();
            String masked = FieldCipher.maskSsn(FieldCipher.isEncrypted(ssn) ? cipher.decrypt(ssn) : ssn);
            out.put("ssn_no", masked == null ? "****" : masked);
        }
        return out;
    }

    private String[] tableFor(String entity) {
        String[] table = entity == null ? null : TABLES.get(entity);
        if (table == null) {
            throw new BadRequestException("Unknown audit entity: " + entity);
        }
        return table;
    }

    private void assertSuperAdmin(User actor) {
        if (actor.getRole() != Role.SUPER_ADMIN) {
            throw new ForbiddenException("Only the Super Admin can view the audit log");
        }
    }

    /** "%text%" for ILIKE, with the user's own % _ \ treated as literal characters. */
    private static String containsPattern(String text) {
        return "%" + text.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }
}
