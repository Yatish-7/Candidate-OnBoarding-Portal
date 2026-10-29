# One Intellectt — Candidate Onboarding & Approval Portal

> Read this first. It is written so a fresh session with **no prior context** can
> understand the whole system (backend **and** frontend) and continue the work from
> this file alone. Deeper detail lives in `docs/` (see §2).

---

## 1. What this is

**One Intellectt** processes a *placed candidate* through an approval workflow, from
recruiter submission to Date of Joining, emailing the right department mailboxes at
every stage, with a Super Admin who oversees everything.

Two sibling folders, one system:

| Part | Folder | What it is |
|---|---|---|
| **Backend** (this folder) | `D:\Intellectt\OneIntellectt` | Java 17 + Spring Boot 4.1.1 REST API + PostgreSQL 16. **Source of truth** for rules and data. |
| **Frontend** | `D:\Intellectt\onboarding-portal` | React 19 + Vite 8 + Ant Design 6 SPA. Has its own `CLAUDE.md` for UI conventions. |

```
Browser ──(axios, Bearer JWT)──► Spring Boot API :5000 ──(JPA/Hibernate, HikariCP 30)──► PostgreSQL "Intellectt" :5432
React :5173 (dev)                   └─(async SMTP, mailExecutor)──► Gmail (dev)
```

### Workflow (authoritative)
```
Recruiter submits ─► Sales Lead (own team) approves ─► HR ┐ in PARALLEL
                                                      Contracts ┘
   both approve → IN_PAYROLL_ACCOUNTS_REVIEW ─► Payroll ┐ in PARALLEL (they see it only now)
                                                  Accounts ┘ each approves or declines
   all four approve → COMPLETED ("Awaiting DOJ") ─► Sales Lead/Manager approves DOJ → "Joined"
   HR/Contracts/Payroll/Accounts decline (comment required) → RETURNED_TO_SALES_LEAD → Sales Lead
     re-routes (only the declined team redoes it). An HR decline also resets Payroll/Accounts.
   HR may revise its decision until the DOJ is approved
   Super Admin: override approve/reject at any stage (final)
   Sales Lead or Sales Manager (either one is enough) can also DECLINE with a comment → SALES_LEAD_DECLINED (ends it)
```
Recruiter enters the DOJ at intake; the Sales Lead approves it after approving the candidate.

### Roles & visibility
Recruiter → own submissions · Sales Lead → own team · **Sales Manager → every team under them** · HR/Contracts → past Sales Lead
approval · Payroll and Accounts → only after HR **and** Contracts both approved · **Admin → no
candidates** (users & teams only, can't touch a Super Admin) · Super Admin → everything.
**Only Super Admin and Admin manage users and teams**; a Sales Lead only adds/removes
recruiters in their own team.

---

## 2. Documentation map

| File | Use it for |
|---|---|
| `README.md` | Quick start, tests, config overview |
| `docs/TDD.md` (+ `docs/One-Intellectt-TDD.docx`, generated from it) | Design decisions (D1–D15), state machine, rules tables, intake form, NFRs, risks |
| `docs/ARCHITECTURE.md` + `docs/architecture.svg` / `architecture.png`, `docs/workflow.svg` / `workflow.png` | Diagrams: context, containers, components, sequences, deployment, workflow |
| `docs/API.md` | Every endpoint, permissions, shapes, error codes |
| `docs/DATA_MODEL.md` | Tables, ER diagram, indexes, audit tables, manual migrations |
| `docs/DEPLOYMENT.md` | Production setup, nginx, env vars, backups, go-live checklist |
| `SECURITY.md` / `COMPLIANCE.md` | Attack protections / ISO 27001 mapping |
| `load-test/README.md`, `RESULTS.md` | Test suite table, 1000-user load test |

**Word TDD / PNGs:** after changing `docs/TDD.md` or the SVGs, regenerate `One-Intellectt-TDD.docx` and the PNGs (PNG = Edge headless screenshot of the SVG; docx = python-docx script that reads TDD.md).

**Keep docs in step with code:** a new endpoint → `docs/API.md` + a row in
`RoleAccessApiTest`; a new column/table → `docs/DATA_MODEL.md`; a new design choice →
`docs/TDD.md` §3.1.

---

## 3. Where things are (backend `src/main/java/com/intellectt`)

- `controller/` — `Auth`, `User`, `Team`, `Candidate`, `Audit` controllers (thin).
- `service/` — **interface + `*Impl` in the same package**.
  - `CandidateServiceImpl`: workflow state machine, visibility (`canView`), the HTML email builder (`emailHtml`, `esc`).
  - `CandidateQueries`: Specifications for visibility/search/status filter, `statusKey`, `SUMMARY_GROUPS`.
  - `AuthServiceImpl`: login, rate limits, reset, change-password.
  - `SessionServiceImpl`, `UserServiceImpl` (`assertCanManage`), `TeamServiceImpl`.
  - `EmailServiceImpl`: entity routing; `notifyStage` and `notifyUserOnly`.
  - `AuditServiceImpl`: SQL over the `*_aud` tables, using the `TABLES` whitelist.
  - `CredentialRules`: password/email rules.
- `security/` — `JwtService`, `JwtAuthFilter` (session check + forced password change), `RestAuthenticationEntryPoint` (401 + reason), `AttemptLimiter`, `FieldCipher` (AES-GCM), `SecurityEvents` (security.log), `AppUserPrincipal`, `CustomUserDetailsService`.
- `config/` — `SecurityConfig` (public endpoints, CORS, headers), `AsyncConfig` (mail pool), `EntityMailProperties`, `DataInitializer`, `AuditLoggingGuard`, `SsnEncryptionMigration`.
- `model/` + `model/enums/` — entities (also the JSON bodies) and `SsnConverter`. `audit/` — Envers revision entity/listener. `exception/` — 400/403/404/429 + `GlobalExceptionHandler`.
- `src/main/resources/application.properties` (no secrets), `logback-spring.xml`.
- `secrets.properties` (this folder, **git-ignored, never print or share it**): DB password, `app.jwt.secret`, `app.crypto.key`, mail credentials, first admin password.

Frontend highlights (details in `onboarding-portal/CLAUDE.md`):
- `src/api/*.js` is the **only** translation layer between backend JSON and UI shapes.
- `utils/status.js#getStatusKey` must match `CandidateQueries.statusKey`.
- `utils/options.js` entity list must match `app.entity-mail.domains.*`.

---

## 4. Run, build, test

> ⚠️ **Environment gotchas (this machine):** `JAVA_HOME` is mis-set and the PATH `java`
> is a JRE → always run Maven as `JAVA_HOME="C:\Program Files\Java\jdk-17" ./mvnw …`.
> Never pipe `mvnw` output (it hides the exit code): redirect to a file and check `$?`.
> Don't run parallel shell calls that `cd`. `gh` CLI is not installed. In
> Eclipse/STS, pom changes need **Maven → Update Project (Alt+F5)**.
> DB: user `postgres` (password in secrets.properties); `psql` at
> `C:\Program Files\PostgreSQL\16\bin\psql`.

```bash
# backend (from this folder, so secrets.properties is found)
JAVA_HOME="C:\Program Files\Java\jdk-17" ./mvnw -q -DskipTests spring-boot:run   # :5000
JAVA_HOME="C:\Program Files\Java\jdk-17" ./mvnw test > /tmp/t.log 2>&1; echo EXIT=$?  # 108 tests
# frontend (../onboarding-portal)
npm run dev    # :5173      npm run build · npm run lint
```

- The user often has their **own backend running on :5000 from Eclipse**. For ad-hoc
  checks start a separate instance on **:5001** against a throwaway DB with mail disabled:
  `--server.port=5001 --spring.datasource.url=jdbc:postgresql://localhost:5432/intellectt_test --spring.mail.host=localhost --spring.mail.port=1`.
  Only stop processes you started.
- **Tests** use DB `intellectt_test` (profile `test`) and can't send mail. Each test
  creates its own users. `ApiTestSupport.createUser` clears `must_change_password`. One
  session per user: a login ends that user's earlier token, so fetch each token once.
  Tests that trip rate limits send a fake `X-Forwarded-For` (`SecurityApiTest.raw`).
- **Load test:** `load-test/load_test.py`, against `intellectt_load` only.
- **Never delete audit rows** (`*_aud`, `audit_revisions`), not even test data in a real
  DB. That's audit tampering and is blocked. Use the throwaway DBs instead.

---

## 5. Rules that must not regress

**Security** (evidence: `SecurityApiTest`, `RoleAccessApiTest`, `ComplianceApiTest`)
- SQL: bound parameters only; escape LIKE wildcards; table names only from whitelists.
- XSS: never `dangerouslySetInnerHTML`/`innerHTML`; escape user text in email HTML (`esc()`).
- Authorization lives in services (role **and** team/ownership). The role is loaded from
  the DB each request. Server-set fields (status, decisions, `submittedBy`, `team`,
  `mustChangePassword`, `lastLoginAt`) must never be taken from a request.
- SSN: `@Convert(SsnConverter)` + `WRITE_ONLY`; responses expose only `ssnMasked`.
  **Never change `app.crypto.key` on a database that holds data.**
- Passwords through `CredentialRules` (8–72 chars, letter + digit). Admin-set passwords
  set `mustChangePassword = true`; `JwtAuthFilter` then allows only `/auth/me`,
  `/auth/change-password`, `/auth/logout` (403 `PASSWORD_CHANGE_REQUIRED`).
- Errors: generic messages, never exception text; don't log email bodies or passwords.
  **Never record IP addresses** (the user explicitly asked for this); IPs exist only in
  memory for rate limiting.
- Security events go through `SecurityEvents` (→ `logs/security.log`).

**Audit (Hibernate Envers)**
- Every entity is `@Audited`; a new entity needs `@Audited`, and an entry in
  `AuditServiceImpl.TABLES` to appear in the Audit Log page. Secrets/noisy fields get
  `@NotAudited`. `AuditLoggingGuard` fails startup if Envers is missing from the classpath.

**Performance** (see `load-test/RESULTS.md`)
- `open-in-view=false`: anything a response serializes must be fetched in the query
  (`@EntityGraph`), or you get `LazyInitializationException`.
- Lists are paged in the DB (max size 100). `show-sql` off. Pool 30. DB errors → 503,
  never 401 (`JwtAuthFilterTest`).

**Email**
- Recruiter submit → Sales Lead only. Later stages → one email to
  `<mailbox>@<entity domain>` for the relevant roles, **always copying `superadmin@<domain>`**
  (the user chose `superadmin@`, not `admin@`). Reset emails → the user only.
- Unknown entity → fall back to the portal users holding those roles.

**Schema**
- `ddl-auto=update` won't alter CHECK constraints or drop columns. Enum additions need
  manual SQL (example in `docs/DATA_MODEL.md` §5).

---

## 6. Conventions

- **No Lombok** (the IDE doesn't run the processor): hand-written accessors.
- **No DTO layer**: entities are the JSON bodies, shaped with Jackson annotations
  (`WRITE_ONLY`, `READ_ONLY`, `@JsonIgnoreProperties` to break cycles).
- Services: interface + `*Impl` in `com.intellectt.service`.
- Comments explain *why*, briefly; code reads like the surrounding code.
- User-facing messages are short, plain sentences (they're shown as-is in the UI).

---

## 6d. Company email ids only (27 Oct 2026)
`app.allowed-email-domains` (application.properties; the test profile uses `test.local,intellectt.com`) lists the only domains an account can
have. Enforced in `UserServiceImpl` (create/edit) and `AuthServiceImpl.login` (message: "Please use your correct company email id…");
the frontend repeats it in `utils/emailDomains.js` (keep both lists in step). The seeded Super Admin is `admin@intellectt.com`
(`app.superadmin.email`).

## 6a. Sales Manager (added 26 Oct 2026)
- Role `SALES_MANAGER`; `teams.sales_manager_id` points a team at its manager (one manager, many teams).
  Only Super Admin / Admin assign it. A manager has no team of their own.
- A manager sees, approves, declines and approves the DOJ of candidates from the teams under them,
  same as the team's Sales Lead. Whoever acts first wins; the other gets a 400 ("not awaiting").
- Sales Lead / Manager decline = `POST /{id}/sales-lead/decline`, comment required, status
  `SALES_LEAD_DECLINED` (terminal; shows as Declined; Super Admin override still works).
- Deactivating, deleting or re-roling a manager releases their teams (`releaseManagedTeams`).
- **Existing databases need `docs/sales-manager-migration.sql`** (CHECK constraints). Not yet run on `Intellectt`.
- Tests: `SalesManagerApiTest`.

## 6c. Email flow (26 Oct 2026)
Every candidate email ends with a "View candidate" button → `<app.frontend.base-url>/candidates/{id}` (login returns to it).
Submit → team's Sales Lead + Sales Manager only · Sales Lead/Manager approve → HR, Contracts, Payroll AND Accounts mailboxes (+ Super Admin)
the *other* approver and the recruiter (Payroll/Accounts get the email but only see the candidate after HR and Contracts both approve) ·
each HR approval and each Contracts approval → all four mailboxes (+ Super Admin) · all four approved → Sales Lead,
Manager and recruiter ("DOJ can be approved") · any decline → Sales Lead + Manager (+ Super Admin) · DOJ approved →
Payroll + Accounts + recruiter · override → HR/Contracts/Accounts/Payroll + Lead/Manager · reset → the user only.
Migration for this flow: `docs/payroll-accounts-migration.sql`.
Rate change (`POST /{id}/rates`): only the team's Lead/Manager and the Super Admin, comment required, emails everyone in the loop;
after submit only **HR** can edit the other details (`PUT /api/candidates/{id}`, full replace, trail `EDIT`, emails everyone in the loop;
migration `docs/candidate-edit-migration.sql`). Migration for rates: `docs/rate-change-migration.sql`.
Project end date (only after the DOJ is approved, like the DOJ): the **recruiter raises** it (`POST /{id}/project-end?date=`, status RAISED),
the Lead / Manager / Super Admin **approve or decline** it (`/project-end/approve|decline`, decline needs a comment); approved = **Exited**
(status key `EXITED`, dashboard card). An approver entering the date directly is the approval. Migrations: `docs/project-end-migration.sql`,
`docs/project-end-approval-migration.sql`.
Payroll company: if it is a different one of the ten entities than the Placement Entity, every stage email also goes to that
entity's mailboxes (hr@novozen.com **and** hr@kennedysoft.com, Super Admin copied at both) in the same email. Same entity, or
"Other", = Placement Entity only (`CandidateServiceImpl.emailEntities`).

**Email testing switches** (`application.properties`): `app.entity-mail.mailbox-routing=true` (normal: entity mailboxes, and the payroll
company's too when different) / `false` (testing: portal users who hold the roles) and `app.entity-mail.super-admin-address` (blank = normal
superadmin@<domain>). Both are in the normal position now.

## 6b. Candidate intake form rules (26 Oct 2026)
- Mandatory in the **form** (not the API): everything except CC company, Date of joining, SSN,
  Client reporting manager, Manager email, Manager contact and Sourcing recruiter. Work authorization expiry is
  waived for US Citizen / Green Card; "which company" / "which team" are required when their Yes/No is Yes.
- The API only validates choices (employment type, team type, placement company, shared team, referral amount).
- **Recruiter location** is not typed: an admin sets `users.location` for each recruiter (Users page) and the server copies it
  onto every candidate (`recruiterLocation` in a request is ignored). A recruiter without one can't submit from the form.
- Client state is a dropdown of the 50 US states + DC (full names; `US_STATES` in `CandidateServiceImpl` and `US_STATE_OPTIONS` in `options.js`).
  Work authorization expiry is optional (HR can add it later via Edit details).
- CC company is mandatory when the employment type is C2C (form rule). "Internal Entity" was renamed **Placement Entity** (UI, emails,
  docs); the field is still `internalEntity` in code and the database.
- Placement companies = the placement entities + Intellectt + NewMEK Software Solutions (`PLACEMENT_COMPANIES` / `options.js`).
- Sharing a placement with a team does **not** change who can see the candidate (undecided).

## 7. Known gaps / backlog

1. **MFA** for Super Admin and Admin: not built (user said "not now", 26 Oct 2026).
2. **Candidate edit** after submission: HR only (`PUT /api/candidates/{id}`, frontend `CandidateEdit`), plus rates by Lead/Manager/Super Admin
   (`POST /{id}/rates`). Recruiters can't edit; a decline is fixed by the Sales Lead/Manager re-routing.
3. **Standalone comments**: comments only ride along with an action's `?comment=`.
4. **Frontend-only field** the backend ignores: `h1TransferDetails`.
5. **Status tag** shows "Pending Contracts" while both HR and Contracts are pending.
5b. Sharing a placement with a team gives that team no access to the candidate (undecided). The load test predates the new flow.
6. Reset tokens stored unhashed; JWT in `localStorage`; rate limits in memory.
7. **Data retention** policy for candidates/SSNs not decided; no Flyway/Liquibase yet.
8. Production: HTTPS, transactional email provider, backups (see `docs/DEPLOYMENT.md`).
