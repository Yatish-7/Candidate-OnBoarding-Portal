# API Reference — One Intellectt

Base URL: `http://localhost:5000` in development, `https://<your-domain>` in production
(nginx proxies `/api`). All bodies are JSON (UTF-8). Dates are `"2026-10-23"`;
timestamps are ISO-8601 instants (`"2026-10-23T09:30:00Z"`).

## Conventions

**Authentication.** Send `Authorization: Bearer <token>` (from `POST /api/auth/login`)
on every call except those marked *public*. Each token is tied to a server-side session,
which ends on logout, after 30 minutes idle, when the user signs in elsewhere, or on
deactivation or a password reset.

**Errors** always look like this:

```json
{ "status": 400, "error": "Bad Request", "message": "Candidate is not awaiting Contracts review", "timestamp": "…" }
```

| Status | Meaning |
|---|---|
| 400 | Invalid input or an action not allowed in the candidate's current state |
| 401 | Not signed in or session ended. Body: `{ "status": 401, "reason": "IDLE_TIMEOUT", "message": "…" }`. Reasons: `SIGNED_OUT`, `SIGNED_IN_ELSEWHERE`, `IDLE_TIMEOUT`, `ACCOUNT_DEACTIVATED`, `PASSWORD_RESET`, `EXPIRED`, `INVALID` |
| 403 | Role/team not allowed, or `reason: "PASSWORD_CHANGE_REQUIRED"` (only `/auth/me`, `/auth/change-password` and `/auth/logout` work until the password is changed) |
| 404 | Not found (also unknown URLs) |
| 429 | Rate limited; see the `Retry-After` header (seconds) |
| 503 | Database busy, try again |
| 500 | Unexpected; generic message only |

**Workflow comments** are passed as a query parameter, `?comment=…` (URL-encoded),
not in the body. They're required on declines.

**Paged lists** return `{ content: [...], totalElements, totalPages, number, size }`
(`number` is 0-based). The audit log returns `{ content, totalElements, page, size }`.

---

## Auth — `/api/auth`

### `POST /api/auth/login` — *public*
```json
{ "email": "jane@intellectt.com", "password": "Secret123" }
```
200:
```json
{
  "token": "eyJ…", "idleTimeoutMinutes": 30,
  "userId": 12, "fullName": "Jane Doe", "email": "jane@intellectt.com", "role": "HR",
  "teamId": null, "teamName": null, "mustChangePassword": false
}
```
Wrong email or password → 403 `"Invalid email or password"` (same message either way).
Deactivated → 403 `"This account has been deactivated"`, shown only if the password is
correct. Locked out → 429. Signing in ends the user's other sessions.

### `POST /api/auth/logout` — *public*
`?reason=IDLE_TIMEOUT` (optional) marks an automatic sign-out. Always 204.

### `GET /api/auth/me`
The signed-in user (see **User** below), plus `location` (recruiters), `salesLeadName` and `salesManagerName` (the people over their team; null when none). The login response carries them too.

### `POST /api/auth/change-password`
```json
{ "currentPassword": "Temp@1234", "newPassword": "Mine12345" }
```
200 `{ "message": "Your password has been changed." }`. The new password must follow
the rules (8–72 characters, a letter and a digit) and differ from the current one.
Clears `mustChangePassword`, keeps this session, and ends the user's other sessions.

### `POST /api/auth/forgot-password` — *public*
`{ "email": "…" }` → 200 with a generic message, whether or not the account exists.
Emails a single-use link (60 minutes) to active accounts. Limits: 3 per account per hour
(extras are skipped silently) and 20 per IP per hour (then 429).

### `POST /api/auth/reset-password` — *public*
`{ "token": "…", "newPassword": "…" }` → 200. Ends all of the user's sessions.

---

## Users — `/api/users`

**User** (response):
```json
{
  "id": 12, "fullName": "Jane Doe", "email": "jane@intellectt.com", "role": "RECRUITER",
  "team": { "id": 3, "name": "Team Alpha" }, "active": true, "createdAt": "…",
  "mustChangePassword": false, "lastLoginAt": "…"
}
```
`password` is write-only. `mustChangePassword` and `lastLoginAt` are read-only (ignored if sent).

| Method & path | Who | Notes |
|---|---|---|
| `GET /api/users` | Super Admin, Admin (all); Sales Lead (own team); Sales Manager (members of their teams) | |
| `GET /api/users/by-role/{role}` | Super Admin, Admin (any role); Sales Lead and Sales Manager (`RECRUITER`, `SALES_LEAD` only) | Unknown role → 400 |
| `POST /api/users` | Super Admin; Admin (any role except `SUPER_ADMIN`) | Body: `fullName`, `email`, `password` (temporary), `role`, `team: {id}` (Recruiter/Sales Lead), `location` (Recruiters only; one of the six offices, else 400). The user must change the password at first sign-in. A Sales Lead becomes their team's lead if it has none |
| `PUT /api/users/{id}` | Same as create; can't edit a Super Admin as Admin | Body: `fullName`, `email`, `role`, `team`, `active`, optional `password` (makes it temporary again and ends sessions). Nobody can change their own role or deactivate themselves |
| `DELETE /api/users/{id}` | Same | **Deactivate** (soft); ends the user's sessions |
| `DELETE /api/users/{id}/permanent` | Super Admin, Admin | Hard delete; refused if the user submitted candidates |

Roles: `RECRUITER`, `SALES_LEAD`, `HR`, `CONTRACTS`, `PAYROLL`, `ACCOUNTS`, `ADMIN`, `SUPER_ADMIN`.

---

## Teams — `/api/teams`

**Team**: `{ id, name, salesLead: User, members: [User], createdAt }`.

| Method & path | Who | Notes |
|---|---|---|
| `GET /api/teams` | Super Admin, Admin (all); Sales Lead (own team only); Sales Manager (teams under them) | Others → 403 |
| `GET /api/teams/{id}` | Same rule | |
| `POST /api/teams` | Super Admin, Admin | `{ "name": "Team Alpha" }`; names are unique |
| `PUT /api/teams/{id}` | Super Admin, Admin | Rename |
| `DELETE /api/teams/{id}` | Super Admin, Admin | |
| `GET /api/teams/options` | Any signed-in user | Team `id` + `name` only, for the candidate form's "shared with" dropdown |
| `PUT /api/teams/{id}/sales-lead/{userId}` | Super Admin, Admin | User must be a `SALES_LEAD` |
| `PUT /api/teams/{id}/sales-manager/{userId}` | Super Admin, Admin | User must be a `SALES_MANAGER`. A manager can be put over any number of teams. `POST/PUT /api/teams` also accept `salesManager: {id}` |
| `DELETE /api/teams/{id}/sales-manager` | Super Admin, Admin | Takes the manager off the team |
| `POST /api/teams/{id}/members/{userId}` | Super Admin, Admin, that team's Sales Lead or Sales Manager | Recruiters only, and only if they're in no other team |
| `DELETE /api/teams/{id}/members/{userId}` | Same | |

---

## Candidates — `/api/candidates`

**Candidate** (response; all intake fields optional except `candidateName`):

```json
{
  "id": 42,
  "candidateName": "Sam Lee", "candidatePersonalEmail": "…", "candidateDirectNumber": "…",
  "recruiterName": "…", "leadOrTeamName": "…", "internalEntity": "novozen",
  "clientName": "…", "clientReportingManager": "…", "reportingManagerEmail": "…", "reportingManagerContact": "…",
  "vendor": "…", "jobRole": "…", "location": "…", "billRate": "…", "payRate": "…",
  "startDate": "2026-11-01", "ccCompany": "…", "referral": "…",
  "ssnMasked": "***-**-6789",
  "visaStatus": "H1B", "workAuthorizationExpDate": "2028-01-01", "relocationExpenses": "…",
  "payCycle": "BI_WEEKLY", "existingEmployee": false, "jobDescription": "…",
  "dojDate": "2026-12-01",
  "sourcingRecruiter": "…", "sourcingRecruiterLead": "…", "clientState": "Texas",   // one of the 50 US states or "District of Columbia" (full name), else 400
   "clientLocation": "Dallas", "employmentType": "C2C",   // W2 | C2C | Full-time | Self (else 400)
  "payrollCompany": "kennedysoft", "payrollCompanyOther": null,   // optional: one of the ten entities, or "Other" + a name
  "internalCompanyPlacement": true, "placementCompany": "NewMEK Software Solutions",   // company required when true
  "sharedPlacement": true, "sharedWithTeam": { "id": 3 },   // team required when true
  "discountPrice": "10", "discountedBillRate": 90.00,   // optional dollars (not more than the bill rate); discountedBillRate read-only = billRate - discountPrice (null without a discount)
  "vendorPercentage": 72.78,   // read-only, computed: payRate / (discounted) billRate * 100 (null if a rate is missing or the bill rate is 0)
  "recruiterLocation": "Hyderabad",   // read-only: copied from the recruiter's profile (users.location), a value in the request is ignored
  "teamType": "BOTH", "referralAmount": "500.00",   // SALES | REQ | BOTH; referral amount optional, a non-negative number   // one of Hyderabad, Vijayawada, Banglore, Indore, Noida, USA (else 400)
  "status": "IN_HR_CONTRACTS_REVIEW", "hrDecision": "APPROVED", "contractsDecision": "PENDING",
  "dojStatus": "RAISED", "lastDeclineReason": null,
  "submittedBy": { "id": 7, "fullName": "…" }, "team": { "id": 3, "name": "…" },
  "createdAt": "…", "updatedAt": "…"
}
```

- **SSN:** send `ssnNo` (`123-45-6789`) on submit. It's stored encrypted and **never
  returned**; responses carry only `ssnMasked`.
- **Placement entity** values: `novozen`, `revereit`, `premierlifesciences`,
  `unitedpharmatechnologies`, `kennedysoft`, `shoolin-inc`, `lumininc`,
  `lumin-innovation`, `kkrconsulting`, `ubitz`.
- Workflow fields (`status`, decisions, `dojStatus`, `submittedBy`, `team`) are always
  set by the server; values sent by the client are ignored.

### Reads

| Method & path | Who | Notes |
|---|---|---|
| `GET /api/candidates?page=0&size=20&search=&status=` | All roles (each sees only its visible rows; Admin sees none) | `size` max 100. `search` matches name, client, job role or recruiter (case-insensitive, literal). `status` is a display key: `PENDING_SALES_LEAD`, `PENDING_HR`, `PENDING_CONTRACTS`, `DECLINED`, `AWAITING_DOJ`, `JOINED`, `ADMIN_APPROVED`, `ADMIN_REJECTED` (other values → 400). Sorted by last activity |
| `GET /api/candidates/summary` | All roles | `{ pending, approved, declined, joined, exited, dropouts, dojToday }` over the caller's visible rows (`dojToday` = DOJ is today) |
| `GET /api/candidates/{id}` | Those who can see it | 403 otherwise |
| `GET /api/candidates/{id}/trail` | Same | `[{ id, actor: User, actorRole, stage, actionType, comment, createdAt }]`, oldest first |

Both `GET /api/candidates` and `/summary` accept the optional filters `dateField` (`submitted` default, `updated`, `doj`, `projectEnd`), `from`, `to` (`yyyy-MM-dd`, inclusive), `recruiterId`, `teamId`, `employmentType`, `internalEntity`, `clientState`, `recruiterLocation`, `payrollCompany`; the caller's visibility rules still apply. A bad `dateField` / date, or `to` before `from`, is 400.

Visibility: Super Admin all · Recruiter own · Sales Lead own team · Sales Manager all teams under them · HR/Contracts past
Sales Lead approval · Payroll and Accounts only after HR and Contracts have both approved · Admin none.

### Actions (all `POST`, optional/required `?comment=`, return the updated candidate)

| Path | Who | Allowed when |
|---|---|---|
| `/api/candidates` (body = candidate) | Recruiter | Always. Starts at `PENDING_SALES_LEAD_APPROVAL`; DOJ given → `dojStatus RAISED` |
| `/{id}/sales-lead/approve` | Sales Lead of the candidate's team **or** the Sales Manager over that team (either one is enough, no need for both) | `PENDING_SALES_LEAD_APPROVAL` or `RETURNED_TO_SALES_LEAD` (re-route) |
| `/{id}/sales-lead/decline` | Same people | Same statuses. Comment required. Sets `SALES_LEAD_DECLINED`: nothing goes to HR/Contracts and it cannot be re-approved (only a Super Admin override changes it) |
| `/{id}/hr/approve`, `/{id}/hr/decline` | HR | After Sales Lead approval, not overridden, DOJ not yet approved. HR may revise its decision. Decline needs a comment |
| `/{id}/contracts/approve`, `/{id}/contracts/decline` | Contracts | `IN_HR_CONTRACTS_REVIEW` with Contracts pending. Decline needs a comment |
| `/{id}/payroll/approve`, `/{id}/payroll/decline` | Payroll | `IN_PAYROLL_ACCOUNTS_REVIEW` (HR and Contracts both approved) and its own decision still `PENDING`. Decline needs a comment and returns the candidate to the Sales Lead |
| `/{id}/accounts/approve`, `/{id}/accounts/decline` | Accounts | Same as Payroll; the two decide in parallel. When both approve → `COMPLETED` |
| `PUT /api/candidates/{id}` | HR only | Edits the details at any time once HR can see the candidate (past the first approval, any later status). **Full replace** of the intake fields: send every field you want to keep. SSN blank or masked = keep the stored one. Must change something (else 400 "Nothing was changed"). Does not reset approvals. Trail entry `EDIT` lists the changes; emails everyone in the loop |
| `/{id}/rates?billRate=&payRate=` | Sales Lead of the team, the Sales Manager over it, or the Super Admin | Either or both rates; **comment required**; must change something; not for declined/rejected candidates. Trail entry `RATE_CHANGE` with old → new. Emails HR/Contracts/Payroll/Accounts (+ Super Admin), Lead, Manager, recruiter |
| `/{id}/project-end/approve`, `/{id}/project-end/decline` | Sales Lead of the team or the Sales Manager over it, **and HR** (each approves once); the Super Admin settles it alone | `projectEndStatus = RAISED`. Both sides must approve (`projectEndLeadApproved`, `projectEndHrApproved`) before it is `APPROVED` and the candidate is **Exited**. Any of them can decline (comment required; the recruiter can raise again) |
| `/{id}/project-end?date=YYYY-MM-DD` | **The candidate's recruiter** (raises it, status `RAISED`, waits for approval) · or the Sales Lead / Sales Manager of the team, HR or the Super Admin (entering it counts as that side's approval; a new date restarts both approvals) | `dojStatus = APPROVED`; date not before the DOJ date. Only **after the DOJ is approved**. The candidate shows as **Exited** once the date is approved (status filter `EXITED`, counted in the `exited` dashboard counter instead of `joined`). Can be called again to change it. Emails HR/Contracts/Payroll/Accounts (+ Super Admin), the recruiter and the other approver |
| `/{id}/doj/approve` | Sales Lead of the team or the Sales Manager over it, **and HR** (each approves once) | After Sales Lead approval, `dojStatus = RAISED`. The first approval leaves `dojStatus = RAISED` (`dojLeadApproved` / `dojHrApproved` flags); the second makes it `APPROVED`. Everyone in the loop is emailed each time |
| `/{id}/drop-out` | Sales Lead / Manager of the team, HR, Contracts, Payroll, Accounts, Super Admin | `dojStatus = APPROVED`, not exited / already dropped out. **Comment required.** Status → `DROPPED_OUT` |
| `/{id}/override/approve`, `/{id}/override/decline` | Super Admin | Any time; decline needs a comment |

Enums — `status`: `PENDING_SALES_LEAD_APPROVAL`, `IN_HR_CONTRACTS_REVIEW`,
`SALES_LEAD_DECLINED`, `IN_PAYROLL_ACCOUNTS_REVIEW`, `RETURNED_TO_SALES_LEAD`, `COMPLETED`, `OVERRIDE_APPROVED`, `OVERRIDE_REJECTED` ·
decisions: `PENDING`, `APPROVED`, `DECLINED` · `dojStatus`: `NOT_RAISED`, `RAISED`,
`APPROVED` · trail `actionType`: `SUBMIT`, `APPROVE`, `DECLINE`, `APPROVE_DOJ`,
`OVERRIDE_APPROVE`, `OVERRIDE_DECLINE` · `stage`: `RECRUITER`, `SALES_LEAD`, `HR`,
`CONTRACTS`, `DOJ`, `SUPER_ADMIN`.

---

## Audit log — `/api/audit` (Super Admin only)

### `GET /api/audit`
Query: `entity` (`USER`, `TEAM`, `CANDIDATE`, `APPROVAL_ACTION`, `PASSWORD_RESET`,
`SESSION`), `action` (`0` created, `1` changed, `2` deleted), `user` (who made the
change, contains), `q` (record label, contains), `from` / `to` (epoch milliseconds),
`page`, `size` (max 100).

Each row: `{ rev, ts, username, entity, entity_id, revtype, label }`, newest first.

### `GET /api/audit/{entity}/{entityId}/{rev}`
`{ current: {...}, previous: {...} | null }`: the record's columns at that revision
and the one before, for a before/after view. SSNs are masked. Passwords and reset
tokens are never stored in the history.

---

## Response headers (every API response)

`Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` ·
`X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` ·
`Referrer-Policy: no-referrer` · `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()` ·
`Cache-Control: no-cache, no-store, …` · `Strict-Transport-Security` (on HTTPS only).

CORS: allowed origins come from `app.cors.allowed-origins` (`CORS_ALLOWED_ORIGINS`).
