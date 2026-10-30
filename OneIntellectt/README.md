# One Intellectt — Backend

REST API for **One Intellectt**, the candidate onboarding & approval portal. A placed
candidate moves from the recruiter's submission, through the Sales Lead or Sales Manager
(either one can approve), then HR and Contracts in parallel, then Payroll and Accounts in
parallel, to the Date of Joining and the project end date. There's an email at every stage,
a full approval trail and audit history, and a Super Admin who can override anything.

The web frontend is a separate project: [`../onboarding-portal`](../onboarding-portal).

![Architecture](docs/architecture.png)

(The same diagram as a vector file: [docs/architecture.svg](docs/architecture.svg).)

## Documentation

| Document | What's in it |
|---|---|
| [docs/TDD.md](docs/TDD.md) · [docs/One-Intellectt-TDD.docx](docs/One-Intellectt-TDD.docx) | **Technical design document** (Markdown, and the same as a Word file): goals, design decisions, workflow, security, NFRs |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [architecture.png](docs/architecture.png) | Context, container, component, sequence and deployment diagrams; the one-page architecture picture |
| [docs/API.md](docs/API.md) | Every endpoint, who may call it, request/response shapes, errors |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | ER diagram, tables, indexes, audit tables, migrations (`docs/*-migration.sql`) |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production setup: configuration, nginx, service, backups, go-live checklist |
| [SECURITY.md](SECURITY.md) | Protections against attacks, with test evidence |
| [COMPLIANCE.md](COMPLIANCE.md) | ISO/IEC 27001 Annex A mapping |
| [load-test/README.md](load-test/README.md) · [RESULTS.md](load-test/RESULTS.md) | Automated tests and the 1000-user load test |
| [CLAUDE.md](CLAUDE.md) | Working notes for developers and AI assistants: conventions, gotchas |

## Tech stack

Java 17 · Spring Boot 4.1.1 (Web MVC, Security 7, Data JPA / Hibernate 7, Envers,
Mail, Validation) · PostgreSQL 16 · jjwt 0.12 · Maven wrapper · packaged as an
executable WAR.

## Roles

| Role | Does | Sees |
|---|---|---|
| Recruiter | Submits placed candidates | Own submissions |
| Sales Lead | Approves, declines or re-routes their team's candidates, approves the DOJ (HR must too) and the project end date (HR must too), records drop outs, gets a "joins today" card, changes bill/pay rates, manages their team's recruiters | Own team's candidates |
| Sales Manager | Same as a Sales Lead, over several teams. Either the Lead or the Manager is enough, both are never required | Candidates of every team under them |
| HR · Contracts | Review in parallel: approve or decline (comment required). **HR can also edit a candidate's details at any time**, **approves the DOJ and the project end date together with the Sales Lead / Manager**, and gets a "joins today" card | Candidates past Sales Lead / Manager approval |
| Payroll · Accounts | Review in parallel after HR **and** Contracts approve: approve or decline (comment required on decline); can record a drop out after the DOJ | Only candidates HR and Contracts have both approved |
| Admin | Manages users (except Super Admin) and teams | No candidates |
| Super Admin | Oversight, override at any stage, change rates, audit log; dashboard cards incl. Exited and Drop outs / Back outs | Everything |

## Quick start (development)

**Prerequisites:** JDK 17, PostgreSQL 16 running on `localhost:5432`, and a database
named `Intellectt` (`CREATE DATABASE "Intellectt";`).

1. **Secrets.** Create `secrets.properties` in this folder. It's git-ignored, so never
   commit or share it:
   ```properties
   spring.datasource.password=<postgres password>
   app.jwt.secret=<64+ random characters>
   app.crypto.key=<base64 of 32 random bytes>
   app.superadmin.password=<first Super Admin password>
   spring.mail.username=<smtp user>
   spring.mail.password=<smtp password>
   ```
   Generate the keys with:
   ```bash
   python -c "import secrets;print(secrets.token_urlsafe(64))"
   python -c "import os,base64;print(base64.b64encode(os.urandom(32)).decode())"
   ```
2. **Run** from this folder (so `secrets.properties` is found):
   ```bash
   ./mvnw spring-boot:run
   ```
   On Windows, if `JAVA_HOME` doesn't point at a JDK 17 root:
   `JAVA_HOME="C:\Program Files\Java\jdk-17" ./mvnw spring-boot:run`.
   In Eclipse/STS, after pulling changes, run **Maven → Update Project** (Alt+F5).
3. The API listens on **http://localhost:5000**. Start the frontend
   (`../onboarding-portal`, `npm run dev`) and open http://localhost:5173. Sign in as
   the Super Admin email (`app.superadmin.email`, currently `yatish@emscale.com`) with the password you set, then create teams and users.

Startup fails on purpose if the JWT key or SSN encryption key is missing or weak.

**Database changes are SQL scripts.** The app runs with `spring.jpa.hibernate.ddl-auto=validate` (`DDL_AUTO`): it checks the
schema at startup and **will not start** if a column is missing; it never changes the schema itself. Run the SQL files in `docs/`
once per database, in this order, BEFORE deploying the matching version: `sales-manager-migration.sql`, `payroll-accounts-migration.sql`,
`project-end-migration.sql`, `rate-change-migration.sql`, `candidate-edit-migration.sql`, `project-end-approval-migration.sql`,
`dropout-doj-migration.sql` (the last one adds columns). For a brand-new local database run once with `DDL_AUTO=update`. Back the database up first.
`docs/sample-candidates.sql` adds two sample candidates (no emails are sent).

## Tests

```bash
./mvnw test        # 127 API and unit tests, about 1-2 minutes
```

The tests need a separate database, `CREATE DATABASE intellectt_test;`. They start the
real backend on a random port against it and can't send email. They cover sessions,
the whole workflow, role access, privilege escalation, injection/XSS attempts,
rate limits, SSN encryption and the audit log. Details and the load test:
[load-test/README.md](load-test/README.md).

## Configuration

Non-secret settings are in `src/main/resources/application.properties`. Each can be
overridden with an environment variable; the full list is in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#42-configuration-environment-variables). Settings you're most likely to change:

| Property (env var) | Default | |
|---|---|---|
| `server.port` | `5000` | |
| `app.cors.allowed-origins` (`CORS_ALLOWED_ORIGINS`) | `http://localhost:5173,http://localhost:4173` | Frontend origins |
| `app.frontend.base-url` (`APP_FRONTEND_BASE_URL`) | `http://localhost:5173` | For reset-password links |
| `app.session.idle-timeout-minutes` | `30` | |
| `app.allowed-email-domains` | the 11 company domains | Only these email domains can have an account or sign in |
| `app.entity-mail.domains.<entity>` | 10 entities | Placement Entity → email domain |
| `app.entity-mail.mailboxes.<role>` | `hr`, `payroll`, `accounts`, `contracts`, `superadmin` | Mailbox names |

## Project layout

```
src/main/java/com/intellectt
├── audit/        Envers revision entity + listener (who/when for every change)
├── config/       SecurityConfig, AsyncConfig (mail pool), EntityMailProperties,
│                 DataInitializer (first Super Admin), AuditLoggingGuard, SsnEncryptionMigration
├── controller/   Auth, User, Team, Candidate, Audit REST controllers
├── exception/    400/403/404/429 exceptions + GlobalExceptionHandler
├── model/        JPA entities (also the JSON bodies) + enums + SsnConverter
├── repository/   Spring Data JPA repositories
├── security/     JWT, auth filter, rate limiter, field encryption, security event log
└── service/      interface + *Impl: workflow, auth, sessions, users, teams, email, audit
src/main/resources  application.properties, logback-spring.xml
src/test/java       API tests (real HTTP + PostgreSQL) and unit tests
docs/               technical documentation, architecture diagram, SQL migrations, sample data
load-test/          1000-user load generator and results
```
