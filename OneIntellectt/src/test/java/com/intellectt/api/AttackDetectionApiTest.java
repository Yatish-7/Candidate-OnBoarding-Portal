package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Attack-shaped input is detected and logged (SUSPICIOUS_INPUT / SUSPICIOUS_REPEAT in logs/security.log) without
 * being blocked, without the attacker's text in the log, and without false alarms on ordinary text.
 */
class AttackDetectionApiTest extends ApiTestSupport {

    /** The security log, once the line we are waiting for appears (the file appender may lag a moment). */
    private static String securityLog(String mustContain) throws Exception {
        Path log = Path.of("logs", "security.log");
        String text = "";
        for (int i = 0; i < 30 && !text.contains(mustContain); i++) {
            Thread.sleep(100);
            text = Files.exists(log) ? Files.readString(log, StandardCharsets.UTF_8) : "";
        }
        return text;
    }

    @Test
    @DisplayName("An XSS payload is logged by rule and user, still handled as plain text, and never written to the log")
    void xssIsLogged() throws Exception {
        TeamSetup ts = newTeam(admin());
        String rec = login(ts.recruiter());
        String payload = "<script>alert('stolen')</script>";

        Res r = post("/api/candidates", rec, Map.of("candidateName", payload));
        assertEquals(200, r.status()); // detection only: the request is not blocked
        assertEquals(payload, r.text("candidateName")); // stored as plain text, shown escaped by the UI

        String log = securityLog("SUSPICIOUS_INPUT user=" + ts.recruiter().email());
        assertTrue(log.contains("SUSPICIOUS_INPUT user=" + ts.recruiter().email() + " rule=script-tag POST /api/candidates"),
                "missing the SUSPICIOUS_INPUT line");
        assertFalse(log.contains("alert('stolen')"), "the attacker's text was written to the log");
        assertFalse(log.matches("(?s).*\\b127\\.0\\.0\\.1\\b.*"), "an IP address was logged");
    }

    @Test
    @DisplayName("SQL injection shapes in the query string and in a body are logged (without the query values)")
    void sqlInjectionIsLogged() throws Exception {
        TeamSetup ts = newTeam(admin());
        String lead = login(ts.lead());
        String probe = "zzprobe" + System.nanoTime();

        assertEquals(200, get("/api/candidates?search=" + java.net.URLEncoder.encode("' OR '1'='1 " + probe,
                StandardCharsets.UTF_8), lead).status());
        post("/api/candidates", login(ts.recruiter()), Map.of("candidateName", "x'; DROP TABLE candidates;--"));
        post("/api/candidates", login(ts.recruiter()), Map.of("candidateName", "a UNION SELECT password FROM users"));

        String log = securityLog("rule=sql-union-select");
        assertTrue(log.contains("SUSPICIOUS_INPUT user=" + ts.lead().email() + " rule=sql-tautology GET /api/candidates"));
        assertTrue(log.contains("rule=sql-stacked-statement POST /api/candidates"));
        assertTrue(log.contains("rule=sql-union-select POST /api/candidates"));
        assertFalse(log.contains(probe), "query values must not be logged");
        assertFalse(log.contains("DROP TABLE"), "the attacker's text was written to the log");
    }

    @Test
    @DisplayName("A user who keeps trying raises a SUSPICIOUS_REPEAT alert")
    void repeatedAttemptsRaiseAnAlert() throws Exception {
        TeamSetup ts = newTeam(admin());
        String rec = login(ts.recruiter());
        for (int i = 0; i < 5; i++) {
            post("/api/candidates", rec, Map.of("candidateName", "<script>" + i + "</script>"));
        }
        String log = securityLog("SUSPICIOUS_REPEAT user=" + ts.recruiter().email());
        assertTrue(log.contains("SUSPICIOUS_REPEAT user=" + ts.recruiter().email() + " 5 suspicious requests in 15 minutes"));
    }

    @Test
    @DisplayName("Ordinary text does not raise an alarm")
    void ordinaryTextIsQuiet() throws Exception {
        TeamSetup ts = newTeam(admin());
        String rec = login(ts.recruiter());
        Res r = post("/api/candidates", rec, Map.of("candidateName", "Asha O'Neil",
                "jobDescription", "Java & Spring developer. Rate is 85/hr -- negotiable; uses Oracle 19c, \"remote\" first.",
                "clientName", "Smith & Sons (UK) Ltd"));
        assertEquals(200, r.status());
        Thread.sleep(500);
        Path log = Path.of("logs", "security.log");
        String text = Files.exists(log) ? Files.readString(log, StandardCharsets.UTF_8) : "";
        assertFalse(text.contains("SUSPICIOUS_INPUT user=" + ts.recruiter().email()), "a false alarm on ordinary text");
    }
}
