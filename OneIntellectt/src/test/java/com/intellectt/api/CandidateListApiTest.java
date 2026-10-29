package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

/** Server-side paging, search, the status filter, and the dashboard counts. */
class CandidateListApiTest extends ApiTestSupport {

    private JsonNode page(String token, String query) {
        Res r = get("/api/candidates?" + query, token);
        assertEquals(200, r.status(), () -> "list failed: " + r.body());
        return r.body();
    }

    private static Set<Long> ids(JsonNode page) {
        Set<Long> ids = new LinkedHashSet<>();
        page.path("content").forEach(n -> ids.add(n.path("id").asLong()));
        return ids;
    }

    /** One team with a candidate in each workflow state, seen through its Sales Lead. */
    private record States(String lead, long pendingSl, long pendingContracts, long pendingHr,
            long pendingPayroll, long approved, long joined, long declined) {
    }

    private States candidatesInEveryState() {
        String a = admin();
        TeamSetup ts = newTeam(a);
        String hr = login(createUser(a, "HR", null));
        String contracts = login(createUser(a, "CONTRACTS", null));
        String payroll = login(createUser(a, "PAYROLL", null));
        String accounts = login(createUser(a, "ACCOUNTS", null));
        String rec = login(ts.recruiter());
        String lead = login(ts.lead());

        long pendingSl = submitCandidate(rec); // has a DOJ from intake, but nobody has approved it

        long pendingContracts = submitCandidate(rec);
        act(pendingContracts, "sales-lead/approve", lead, null);

        long pendingHr = submitCandidate(rec);
        act(pendingHr, "sales-lead/approve", lead, null);
        act(pendingHr, "contracts/approve", contracts, null);

        long pendingPayroll = submitCandidate(rec);
        act(pendingPayroll, "sales-lead/approve", lead, null);
        act(pendingPayroll, "hr/approve", hr, null);
        act(pendingPayroll, "contracts/approve", contracts, null);

        long approved = submitCandidate(rec);
        act(approved, "sales-lead/approve", lead, null);
        act(approved, "hr/approve", hr, null);
        act(approved, "contracts/approve", contracts, null);
        act(approved, "payroll/approve", payroll, null);
        act(approved, "accounts/approve", accounts, null);

        long joined = submitCandidate(rec);
        act(joined, "sales-lead/approve", lead, null);
        act(joined, "hr/approve", hr, null);
        act(joined, "contracts/approve", contracts, null);
        approveDojBoth(joined, lead, hr);

        long declined = submitCandidate(rec);
        act(declined, "sales-lead/approve", lead, null);
        act(declined, "hr/decline", hr, "missing papers");

        return new States(lead, pendingSl, pendingContracts, pendingHr, pendingPayroll, approved, joined, declined);
    }

    @Test
    @DisplayName("The server returns one page at a time, newest first, with correct totals")
    void serverSidePaging() {
        TeamSetup ts = newTeam(admin());
        String rec = login(ts.recruiter());
        List<Long> submitted = new ArrayList<>();
        for (int i = 0; i < 25; i++) {
            submitted.add(submitCandidate(rec));
        }

        JsonNode first = page(rec, "page=0&size=10");
        assertEquals(25, first.path("totalElements").asInt());
        assertEquals(3, first.path("totalPages").asInt());
        assertEquals(0, first.path("number").asInt());
        assertEquals(10, first.path("content").size());
        assertEquals(submitted.get(24), first.path("content").get(0).path("id").asLong()); // newest first

        Set<Long> all = new LinkedHashSet<>(ids(first));
        all.addAll(ids(page(rec, "page=1&size=10")));
        JsonNode last = page(rec, "page=2&size=10");
        assertEquals(5, last.path("content").size());
        all.addAll(ids(last));
        assertEquals(Set.copyOf(submitted), all); // every candidate exactly once across pages
    }

    @Test
    @DisplayName("Page size is capped at 100")
    void pageSizeCapped() {
        assertEquals(100, page(admin(), "page=0&size=5000").path("size").asInt());
    }

    @Test
    @DisplayName("Search is server-side, case-insensitive, and treats % literally")
    void search() {
        TeamSetup ts = newTeam(admin());
        String rec = login(ts.recruiter());
        String unique = uniq("Zelda Quantum");
        long match = submitCandidate(rec, Map.of("candidateName", unique));
        submitCandidate(rec, Map.of("candidateName", uniq("Someone Else")));

        JsonNode found = page(rec, "search=" + unique.toLowerCase().replace(" ", "%20"));
        assertEquals(Set.of(match), ids(found));
        assertEquals(0, page(rec, "search=%25").path("totalElements").asInt()); // "%" is not a wildcard
        assertEquals(1, page(rec, "search=" + unique.substring(0, 12).toUpperCase().replace(" ", "%20") + "&size=100")
                .path("content").size());
    }

    @Test
    @DisplayName("Status filter matches the workflow — a DOJ given at intake isn't 'approved'")
    void statusFilter() {
        States s = candidatesInEveryState();
        assertEquals(Set.of(s.pendingSl()), ids(page(s.lead(), "status=PENDING_SALES_LEAD")));
        assertEquals(Set.of(s.pendingContracts()), ids(page(s.lead(), "status=PENDING_CONTRACTS")));
        assertEquals(Set.of(s.pendingHr()), ids(page(s.lead(), "status=PENDING_HR")));
        assertEquals(Set.of(s.pendingPayroll()), ids(page(s.lead(), "status=PENDING_PAYROLL_ACCOUNTS")));
        assertEquals(Set.of(s.approved()), ids(page(s.lead(), "status=AWAITING_DOJ")));
        assertEquals(Set.of(s.joined()), ids(page(s.lead(), "status=JOINED")));
        assertEquals(Set.of(s.declined()), ids(page(s.lead(), "status=DECLINED")));
        assertEquals(400, get("/api/candidates?status=NOT_A_STATUS", s.lead()).status());
    }

    @Test
    @DisplayName("Dashboard counts are computed on the server")
    void summaryCounts() {
        States s = candidatesInEveryState();
        Res r = get("/api/candidates/summary", s.lead());
        assertEquals(200, r.status());
        assertEquals(4, r.body().path("pending").asInt()); // Sales Lead, Contracts, HR, Payroll and Accounts
        assertEquals(1, r.body().path("approved").asInt());
        assertEquals(1, r.body().path("declined").asInt());
        assertEquals(1, r.body().path("joined").asInt());
    }

    @Test
    @DisplayName("Admin gets an empty page and zero counts")
    void adminSeesNothing() {
        String t = login(createUser(admin(), "ADMIN", null));
        assertEquals(0, page(t, "page=0&size=10").path("totalElements").asInt());
        Res sum = get("/api/candidates/summary", t);
        assertEquals(0, sum.body().path("pending").asInt() + sum.body().path("approved").asInt()
                + sum.body().path("declined").asInt() + sum.body().path("joined").asInt());
    }
}
