# Testing One Intellectt

Two kinds of tests live in this project:

| | What | Where | How long |
|---|---|---|---|
| **Automated tests** | 127 checks of the API: login & sessions, roles & permissions, users & teams, the full candidate workflow, paging/search/filter, the audit log, email routing, attack checks | `src/test/java` | ~1 minute |
| **Load test** | 1000 people using the portal at the same time | `load-test/load_test.py` | ~5 minutes |

Results of the load test: see [RESULTS.md](RESULTS.md).

> Both run against **separate throwaway databases**, never the real `Intellectt` one.
> Every change is permanently recorded in the audit log, and audit entries can't be
> deleted, so testing against real data would leave permanent test records behind.

---

## 1. Automated tests

One-time setup (tables are created automatically on the first run):

```sql
CREATE DATABASE intellectt_test;
```

Run all tests:

```bash
cd D:\Intellectt\OneIntellectt
JAVA_HOME="C:\Program Files\Java\jdk-17" ./mvnw test
```

Expected: `Tests run: 127, Failures: 0, Errors: 0`.

The tests start the real backend on a random port with the `test` profile
(`src/test/resources/application-test.properties`), which points at `intellectt_test`
and makes it impossible to send real email. Each test creates its own users with unique
emails, so they can run repeatedly without cleanup.

| Test class | Covers |
|---|---|
| `api/AuthSessionApiTest` | login, wrong password, 401 handling, one session per user, logout, idle timeout, deactivation, password reset |
| `api/UserAndTeamApiTest` | creating every role, duplicate emails, the Admin role's limits, editing users, permanent delete, one team per recruiter |
| `api/CandidateWorkflowApiTest` | submit → Sales Lead → HR & Contracts → Payroll & Accounts → completed, declines & re-routing (incl. Payroll/Accounts), HR revise-until-DOJ, visibility per role, Super Admin override, placement entity |
| `api/AttackDetectionApiTest` | attack-shaped input is logged (SUSPICIOUS_INPUT / SUSPICIOUS_REPEAT) without blocking, without the attacker's text, without false alarms on ordinary text |
| `api/DojAndDropOutApiTest` | the two-approval DOJ, the Sales Manager in the approval emails, joining today, drop out / back out |
| `api/EmailDomainApiTest`, `api/NewFeatureSecurityApiTest`, `api/WorkflowEmailApiTest` | company-email-only rule; the newer endpoints against every role; injection / XSS / mass-assignment attempts; who each workflow email is addressed to (email service mocked, nothing sent) |
| `api/CandidateFilterApiTest` | the Super Admin dashboard filters (team, recruiter, employment type, date ranges on four dates), counters follow the filters, bad values → 400, filters never widen visibility |
| `api/SalesManagerApiTest` | Sales Manager visibility and approval (either one is enough), Sales Lead/Manager decline, who can assign managers, recruiter location, Lead/Manager names, employment type, placement and shared team, payroll company, project end date, rate change |
| `api/CandidateListApiTest` | server-side paging (newest first, totals), page-size cap, search, status filter for every workflow state, dashboard counts |
| `api/AuditApiTest` | Super-Admin-only access, before/after history, SSN masking, no passwords/tokens/IPs stored |
| `service/EntityEmailRoutingTest` | emails go to `hr@`, `payroll@`, ... `superadmin@<entity domain>` (sends nothing) |
| `api/SecurityApiTest` | SQL injection, stored XSS, security headers, password-guessing lockout, reset rate limit, access to other teams/roles, forged tokens, password/email rules, bad input |
| `api/RoleAccessApiTest` | every role against every kind of endpoint; privilege escalation (account takeover, self-promotion, smuggled fields, other teams) |
| `api/ComplianceApiTest` | SSN encrypted at rest and masked in responses, temporary passwords replaced at first sign-in, last sign-in recorded, security event log |
| `security/JwtAuthFilterTest` | a busy database answers 503, never signs the user out |

---

## 2. Load test

Needs Python 3.9+ with `aiohttp` (`pip install aiohttp`).

**1. Create a throwaway database** (it fills up with ~1000 users and thousands of candidates):

```sql
CREATE DATABASE intellectt_load;
```

**2. Start the backend on it, on port 5001, with email disabled:**

```bash
cd D:\Intellectt\OneIntellectt
JAVA_HOME="C:\Program Files\Java\jdk-17" ./mvnw -q -DskipTests spring-boot:run -Dspring-boot.run.arguments="--server.port=5001 --spring.datasource.url=jdbc:postgresql://localhost:5432/intellectt_load --spring.mail.host=localhost --spring.mail.port=1"
```

**3. Seed it** (50 teams, 1000 accounts, 1500 candidates at various stages — about 30 s):

```bash
cd D:\Intellectt\OneIntellectt\load-test
python load_test.py seed --base http://localhost:5001
```

**4. Run 1000 concurrent users.** Use two processes so the load generator itself isn't the
bottleneck (one Python process can't drive 1000 users on a laptop without distorting the
timings — see RESULTS.md):

```bash
python load_test.py run --users 1000 --ramp 60 --duration 180 --shard 0 --shards 2 --out results/run-a.json
python load_test.py run --users 1000 --ramp 60 --duration 180 --shard 1 --shards 2 --out results/run-b.json
```

Optionally, in a third window, an independent latency probe (create an HR user
`probe@load.test`, sign in as it once and change its password to `Load@1234`):

```bash
python load_test.py probe --email probe@load.test --duration 245
```

**5. Clean up:** stop the backend and `DROP DATABASE intellectt_load;`.

### What each simulated user does

Each of the 1000 users signs in once, then repeats a role-appropriate action every 2–6 s:

| Role (count) | Actions |
|---|---|
| Recruiter (750) | list a page of own candidates (sometimes a later page), open one + its trail, submit a new candidate |
| Sales Lead (50) | list a page (often filtered to "Pending Sales Lead"), open one, approve a pending one |
| HR (50) / Contracts (50) | list everything in review, open one, approve one |
| Payroll (40) / Accounts (40) | list and open candidates (the script predates the Payroll/Accounts approval step and still only views) |
| Admin (19) | Users page, Teams page |
| Super Admin (1) | dashboard (counts + first page), audit log |

### Reading the results

- **fail** = real failures: 5xx, timeouts, unexpected 401/403, connection errors. Should be 0.
- **confl** = expected workflow conflicts, e.g. two Contracts users approving the same
  candidate at once — the second correctly gets "not awaiting Contracts review". Not errors.
- **p50 / p95 / p99** = half / 95% / 99% of requests finished within this many milliseconds.
