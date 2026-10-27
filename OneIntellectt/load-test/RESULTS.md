# Load test results — 1000 concurrent users

**Bottom line:** with the fixes below, 1000 people using the portal at once got
**68,296 responses with zero failures**: half answered in **10 ms**, 95% in **71 ms**,
99% in **126 ms**. Before the fixes the same test was technically error-free but slow,
with 95% of requests taking up to **7 seconds**.

Test date: 26 Oct 2026, **before** the Sales Manager role, the Payroll/Accounts approval step and the newer intake fields were added (the load script still models the earlier flow). Re-run it before go-live. How to rerun it: [README.md](README.md). Raw numbers: `results/`.

## Setup

- **Machine:** one laptop (Intel i5-1235U, 7.7 GB RAM) running the backend, PostgreSQL
  **and** the load generator together. A real server running only the backend will do
  better, so treat these numbers as a pessimistic floor.
- **Data:** a throwaway database seeded with 50 teams, 1000 accounts and 1500 candidates
  at every stage. During a run, users submitted about 7,700 more, ending near 9,300.
- **Load:** 1000 users, each with their own account, brought online over 60 s, then 3
  minutes at full load. Each repeats a role-appropriate action every 2–6 s: recruiters
  browse and submit, Sales Leads/HR/Contracts approve, Admins manage users, the Super
  Admin checks the dashboard and audit log. Email was disabled (nothing was sent).

## Before and after

| Run | Requests | Failures | Throughput | Median | 95th % | 99th % |
|---|---:|---:|---:|---:|---:|---:|
| 1. Baseline (code as it was) | 45,466 | 0 | 184 req/s | 821 ms | 6,988 ms | 10,388 ms |
| 2. Fewer queries, no SQL logging, bigger pool | 43,231 | 156 | 161 req/s | 200 ms | 8,435 ms | 16,431 ms |
| 3. + release DB connections early, 503 handling | 65,938 | 169\* | 263 req/s | 15 ms | 193 ms | 3,853 ms\* |
| **4. Same as 3, load generator split in two** | **68,296** | **0** | **278 req/s** | **10 ms** | **71 ms** | **126 ms** |

\* Run 3's failures and its 3.9 s tail came from the **load generator**, not the server.
It was one Python process playing 1000 users and parsing megabyte-sized lists, so it
starved its own network handling (the failures were all client-side
`ClientConnectorError`, and the server log was clean). Run 4 fixed the measurement, not
the server: the same server code, with the load split across two processes and an
independent probe timing the server once a second.

**Independent probe** (one HR user, one request at a time, during run 4):

| Request | Median | 95th % | Max |
|---|---:|---:|---:|
| `/auth/me` (smallest request) | 4 ms | 11 ms | 28 ms |
| HR candidate list (1.7 MB) | 62 ms | 130 ms | 181 ms |

## Final run, per request (run 4)

| Request | Count | Failures | Median | 95th % | 99th % | Max | Avg size |
|---|---:|---:|---:|---:|---:|---:|---:|
| `GET /candidates (list)` | 21,167 | 0 | 13 ms | 101 ms | 168 ms | 702 ms | 286 KB |
| `GET /candidates/{id}` | 15,285 | 0 | 8 ms | 24 ms | 56 ms | 295 ms | 1.3 KB |
| `GET /candidates/{id}/trail` | 15,285 | 0 | 10 ms | 27 ms | 47 ms | 314 ms | 0.8 KB |
| `POST /candidates (submit)` | 7,767 | 0 | 12 ms | 33 ms | 60 ms | 216 ms | 1.3 KB |
| `GET /auth/me` | 5,217 | 0 | 5 ms | 18 ms | 45 ms | 238 ms | 0.2 KB |
| `POST /auth/login` | 1,000 | 0 | 99 ms | 112 ms | 126 ms | 191 ms | 0.4 KB |
| `GET /users` | 565 | 0 | 25 ms | 58 ms | 84 ms | 331 ms | 216 KB |
| `POST sales-lead/approve` | 512 | 0 | 12 ms | 33 ms | 53 ms | 339 ms | 1.3 KB |
| `POST hr/approve` | 511 | 0 | 12 ms | 31 ms | 42 ms | 113 ms | 1.3 KB |
| `POST contracts/approve` | 507 | 0 | 12 ms | 37 ms | 58 ms | 173 ms | 1.3 KB |
| `GET /teams` | 425 | 0 | 25 ms | 54 ms | 126 ms | 353 ms | 135 KB |
| `GET /candidates (all)` — Super Admin | 33 | 0 | 319 ms | 845 ms | 870 ms | 870 ms | **6.2 MB** |
| `GET /audit` | 22 | 0 | 60 ms | 153 ms | 160 ms | 160 ms | 3.2 KB |

Also checked after the run: no errors in the server log, exactly **one live session per
user** (1000 + the probe), and 22 expected workflow conflicts (two Contracts users
approving the same candidate at the same moment; the second correctly got "not awaiting
Contracts review").

Login is deliberately the slowest small request (~100 ms): passwords are checked with
bcrypt, which is designed to be slow to resist password guessing.

## What was found and fixed

| # | Problem found | Effect | Fix |
|---|---|---|---|
| 1 | Candidate, user and team lists loaded each recruiter/team **one query at a time** | ~43 DB queries per request; ~800 for one HR list | Load related rows in the same query (`@EntityGraph` on the list/detail queries) |
| 2 | **Every SQL statement printed** to the console | 2 million log lines (462 MB) in 4 minutes | Off by default (`SHOW_SQL=true` to turn it on when debugging) |
| 3 | DB connection held until the **whole response was sent** (`open-in-view`) | With fast queries, the pool ran out: requests queued, 500 errors | `spring.jpa.open-in-view=false`: connection released when the query work is done |
| 4 | A busy database made the auth check answer **401** | Real users would have been **signed out** at busy moments | Database errors answer **503 "busy, try again"**; regression test added |
| 5 | Unexpected errors sent the **raw exception text** to the browser | Leaked SQL/internals (the Audit-log error you saw earlier) | Generic message to the browser; details logged on the server |
| 6 | Email queue: 100 slots, and a full queue **failed the approval itself** | Under real SMTP at busy times, approvals could be lost | 5000 slots, 4–10 senders; a full queue logs and drops the email, never the approval |
| 7 | Default connection pool (10) | — | 30 connections (`DB_POOL_SIZE`), 10 s wait limit |

All 45 automated tests pass after these changes.

## Follow-up: server-side pagination (added after the runs above)

The candidate list used to send *every* visible candidate on each request (6.2 MB for
the Super Admin after one test run, and growing forever). Now the server searches,
filters and pages, and sends only the page on screen. The dashboard counters come from
a small summary call.

| Response | Before | After |
|---|---:|---:|
| Candidate list, average | 286 KB | **8.5 KB** |
| Super Admin dashboard | 6.2 MB list | **13.4 KB** page + **0.1 KB** counts |
| HR list (probe) | 1.7 MB | **13.4 KB** |

On ~4,900 candidates, the database answers HR's page query in **13 ms** and its count in
**5 ms**. Indexes were added for the list's filters and sort, a candidate's trail, and a
user's sessions, so this stays fast as the tables grow.

**Load run with pagination (1000 users):** 60,956 requests, **0 failures**, clean server
log. Its response times (95th % 1.9 s) are *not* comparable with run 4: this time the
laptop had only ~0.6 GB of RAM free (other apps were open). Every request type slowed
by the same amount, including ones pagination doesn't touch (`/auth/me`, opening one
candidate), while queries stayed at milliseconds and garbage collection took under 2% of
the time. That pattern means the machine was the limit, not the code. An earlier
attempt with the dev server and browser also running had **0.4 GB free** and timed out
outright. For clean timings, rerun on a machine with spare memory.

**Also fixed while doing this:** the status label logic dated from the old one-step-
at-a-time workflow. A candidate submitted with a Date of Joining showed as "Approved —
awaiting DOJ" (and counted as *approved* on the dashboard) before anyone had approved it,
and a fully approved candidate without a DOJ showed as "Pending Sales Lead". The labels,
the status filter and the dashboard counts now share one definition. It's checked
against all 83 possible workflow states, with zero mismatches.

## Still to address before go-live (not fixed here)

1. **Gmail can't send this volume.** A consumer Gmail account allows roughly 500
   recipients a day (Google Workspace about 2,000). One Sales Lead approval alone emails 5
   addresses. For 1000 users, use a transactional email service (e.g. Amazon SES,
   SendGrid, or Microsoft 365 SMTP).
2. **Housekeeping tables grow without limit.** Every sign-in adds a `user_sessions` row,
   and every change adds audit rows. Fine for a long time, but plan an archive/retention
   policy (e.g. ended sessions older than 90 days).
3. **Production hosting.** Run the backend on its own machine, behind a reverse proxy
   (e.g. nginx) with HTTPS. Sessions are stored in the database, so a second backend
   instance can be added for availability. Keep *pool size × instances* below
   PostgreSQL's `max_connections` (100 by default).
