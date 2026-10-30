package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** The list and the dashboard counters can be narrowed by date, recruiter, team and intake fields. */
class CandidateFilterApiTest extends ApiTestSupport {

    private int total(String query, String token) {
        Res r = get("/api/candidates?size=100" + query, token);
        assertEquals(200, r.status(), () -> r.body().toString());
        return r.body().path("totalElements").asInt();
    }

    @Test
    @DisplayName("Filter by team, recruiter, employment type and date; counters follow the same filters")
    void filters() {
        String sa = admin();
        TeamSetup a = newTeam(sa);
        TeamSetup b = newTeam(sa);
        String recA = login(a.recruiter());
        String recB = login(b.recruiter());
        submitCandidate(recA, Map.of("employmentType", "W2", "dojDate", "2027-01-10"));
        submitCandidate(recA, Map.of("employmentType", "C2C", "dojDate", "2027-02-10"));
        submitCandidate(recB, Map.of("employmentType", "W2", "dojDate", "2027-03-10"));

        assertEquals(2, total("&teamId=" + a.teamId(), sa));
        assertEquals(1, total("&teamId=" + b.teamId(), sa));
        assertEquals(2, total("&recruiterId=" + a.recruiter().id(), sa));
        assertEquals(1, total("&teamId=" + a.teamId() + "&employmentType=c2c", sa)); // not case-sensitive
        assertEquals(0, total("&teamId=" + a.teamId() + "&recruiterId=" + b.recruiter().id(), sa));

        // date of joining range
        assertEquals(1, total("&teamId=" + a.teamId() + "&dateField=doj&from=2027-02-01&to=2027-02-28", sa));
        assertEquals(2, total("&teamId=" + a.teamId() + "&dateField=doj&from=2027-01-01&to=2027-02-10", sa));
        // submitted today (the default date) includes all of them; a past range includes none
        String today = LocalDate.now().toString();
        assertEquals(2, total("&teamId=" + a.teamId() + "&from=" + today + "&to=" + today, sa));
        assertEquals(0, total("&teamId=" + a.teamId() + "&from=2020-01-01&to=2020-01-07", sa));

        // the counters honour the same filters
        Res summary = get("/api/candidates/summary?teamId=" + b.teamId(), sa);
        assertEquals(200, summary.status());
        assertEquals(1, summary.body().path("pending").asInt());
    }

    @Test
    @DisplayName("Bad filter values are rejected, and a filter never widens what a user may see")
    void badValuesAndVisibility() {
        String sa = admin();
        TeamSetup a = newTeam(sa);
        TeamSetup b = newTeam(sa);
        submitCandidate(login(a.recruiter()));
        submitCandidate(login(b.recruiter()));
        String leadA = login(a.lead());

        assertEquals(400, get("/api/candidates?dateField=password", sa).status());
        assertEquals(400, get("/api/candidates?from=2027-02-01&to=2027-01-01", sa).status());
        assertEquals(400, get("/api/candidates?from=not-a-date", sa).status());
        // injection text is just a value that matches nothing
        assertEquals(0, total("&employmentType=" + java.net.URLEncoder.encode("' OR '1'='1", java.nio.charset.StandardCharsets.UTF_8), sa));

        // team A's lead asking for team B's candidates gets nothing
        assertEquals(0, total("&teamId=" + b.teamId(), leadA));
        assertTrue(total("&teamId=" + a.teamId(), leadA) >= 1);
    }

    @Test
    @DisplayName("Employment types: the six allowed values are accepted, anything else is refused")
    void employmentTypes() {
        String rec = login(newTeam(admin()).recruiter());
        for (String type : new String[] { "W2", "C2C", "Full-time", "Self", "1099 Individual", "Other" }) {
            submitCandidate(rec, Map.of("employmentType", type));
        }
        Res bad = post("/api/candidates", rec, Map.of("candidateName", "x", "employmentType", "Contractor"));
        assertEquals(400, bad.status());
    }
}
