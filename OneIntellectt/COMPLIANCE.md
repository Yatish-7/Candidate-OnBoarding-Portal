# ISO/IEC 27001 compliance — One Intellectt

**What this document is.** ISO/IEC 27001 certifies an *organisation's* information
security management system (ISMS): its policies, risk assessment, people and processes,
audited by an accredited body. Software on its own can't be "ISO certified." What it can
do is meet the **technical controls** of Annex A (2022 edition) that apply to it, and
produce the **evidence** an auditor will ask for. This document maps the portal to those
controls and lists what the company still has to provide.

Status as of 29 Oct 2026 (re-checked end to end, including the later changes: HR's DOJ and project end date approval, drop out /
back out, joining-today cards, US-state dropdown, `ddl-auto=validate`). Evidence = code plus automated tests (`./mvnw test`, 127 tests,
all passing). Technical details: [SECURITY.md](SECURITY.md).

## 1. Controls the portal implements

| Annex A control | How the portal meets it | Evidence |
|---|---|---|
| **5.15 Access control / 8.3 Information access restriction** | Role-based access, enforced on the server for every request. Each role sees only what its job needs: a recruiter sees their own candidates, a Sales Lead their team's, a Sales Manager the teams under them, HR and Contracts the candidates past the first approval, Payroll and Accounts only candidates that HR and Contracts have both approved, and Admin no candidates at all. The newer actions are role-checked too: only HR edits details, only the Lead / Manager / Super Admin change rates, only the Lead / Manager and HR (or the Super Admin) approve the DOJ and the project end date, only the owner recruiter raises the date, only the Lead / Manager, HR, Contracts, Payroll, Accounts and Super Admin can record a drop out, only the Super Admin and Admin assign Sales Managers. | `RoleAccessApiTest` (every role × every endpoint type), `NewFeatureSecurityApiTest` |
| **5.3 Segregation of duties** | No single person can complete the sensitive approvals alone: the Date of Joining and the project end date need the team's Sales Lead / Sales Manager **and** HR; HR / Contracts / Payroll / Accounts decide their own stages; rates, HR edits and drop outs are role-restricted, recorded with a reason and emailed. Only the Super Admin can override. | `NewFeatureSecurityApiTest`, `DojAndDropOutApiTest`, `RoleAccessApiTest` |
| **8.2 Privileged access rights** | Only the Super Admin and Admins manage accounts and teams. An Admin can't touch or create a Super Admin. Nobody can change their own role or promote anyone above their own level. Only the Super Admin can override decisions or read the audit log. | `RoleAccessApiTest.noPromotion`, `noAccountTakeoverByNonAdmins` |
| **5.16 Identity management** | One named account per person (unique email, and only a **company email id**: the domains in `app.allowed-email-domains`; personal or other-domain addresses are refused). Accounts are deactivated, not shared. Deactivation signs the person out immediately, and history is kept. | `AuthSessionApiTest`, `UserAndTeamApiTest`, `EmailDomainApiTest` |
| **5.17 Authentication information** | Passwords are hashed with bcrypt. Minimum rules: 8–72 characters with a letter and a number. **A password an admin sets must be replaced at first sign-in.** Users can change their own password. Reset links are emailed only to the user, work once, expire after 60 minutes, and sign the user out everywhere. | `ComplianceApiTest.temporaryPasswordMustBeChanged`, `SecurityApiTest.credentialRules` |
| **5.18 Access rights (review)** | The Users page shows each person's role, team, status, **last sign-in** and whether they still have a temporary password, which is what a periodic access review needs. | `ComplianceApiTest.lastSignInRecorded` |
| **8.5 Secure authentication** | Sign-in lock-out after repeated failures (per account+IP, per account, per IP). Messages don't reveal whether an account exists. Signed tokens are tied to a server-side session. Idle timeout (30 min, with a warning), one session per user, and real logout. A usage notice is shown on the sign-in page. | `SecurityApiTest`, `AuthSessionApiTest` |
| **5.34 Privacy and protection of PII / 8.11 Data masking** | The SSN is never returned by the API: only `***-**-1234` reaches screens, emails and the audit view. Responses carry only the fields the page uses. IP addresses are not stored. Emails about a candidate contain personal details (name, contact, rates) but only the masked SSN, and all of that text is HTML-escaped. | `ComplianceApiTest.ssnEncryptedAndMasked`, `NewFeatureSecurityApiTest.xssInEmails` |
| **8.24 Use of cryptography** | The SSN is encrypted at rest with AES-256-GCM, including in the audit history. Tokens are signed with HMAC-SHA. bcrypt is used for passwords. HTTPS for data in transit is a deployment item (section 2). Email is sent with TLS required (STARTTLS cannot be downgraded) and the mail server's certificate name is checked. The keys are kept outside the code and database. | `FieldCipher`, `ComplianceApiTest` |
| **8.12 Data leakage prevention** | Error messages are generic (no SQL or stack traces). Email bodies and reset links are never logged. `Cache-Control: no-store`, `Referrer-Policy: no-referrer`. Test data is excluded from the production build. | `SecurityApiTest.badInput`, `securityHeaders` |
| **8.15 Logging / 8.16 Monitoring activities** | Attack detection: attack-shaped input (injection, script tags, path traversal) is written to the security log as `SUSPICIOUS_INPUT`, with `SUSPICIOUS_REPEAT` alerts for repeat offenders, without the attacker's text or any IP. Audit log: every change to every table, with who and when (kept indefinitely, can't be edited from the portal). The approval trail records every decision and also each HR edit (old → new), rate change (old → new + reason), project end date raise / approval / decline and Sales Lead / Manager decline. Security log: sign-ins, failures, lock-outs, refused access and password events, kept 365 days, with injection-safe entries and no passwords or IPs. | `AuditApiTest`, `ComplianceApiTest.securityEventsAreLogged`, `AttackDetectionApiTest` |
| **5.33 Protection of records** | Audit history is append-only through the application. Deleted records keep their last state. The SSN and password columns are protected as above. | `AuditApiTest` |
| **8.26 Application security requirements / 8.28 Secure coding** | Bound SQL parameters (no injection), no HTML injection points in the UI, Content-Security-Policy, security headers, input length/format validation, rate limits. Requests can't set server-owned fields (status, decisions, owner, team, project end status): an HR edit and a submit copy only the intake fields. Links in emails are built from the configured portal address and a numeric id, never from user input. | `SecurityApiTest`, `NewFeatureSecurityApiTest` (injection, XSS in emails, mass assignment) |
| **8.25 Secure development life cycle / 8.29 Security testing** | Automated tests for injection, XSS, access control, privilege escalation, brute force, forged tokens and data protection run with every build. A load test covers 1000 concurrent users. | `src/test`, `load-test/RESULTS.md` |
| **8.6 Capacity management** | Tested with 1000 concurrent users, 0 failures. The connection pool, mail queue and pagination are sized for that. | `load-test/RESULTS.md` |
| **8.32 Change management** | Application changes go through the test suite; database changes are versioned SQL scripts (`docs/*-migration.sql`, listed in DATA_MODEL.md) and the app runs with `ddl-auto=validate`, so a schema that doesn't match the code stops the app instead of being altered silently. | `docs/*-migration.sql`, `application.properties` |
| **8.9 Configuration management** | Settings are in `application.properties`. Secrets are separate (git-ignored file or environment variables). Startup fails on a missing or weak key, and there's no default admin password. Two testing switches exist (`app.entity-mail.mailbox-routing`, `app.entity-mail.super-admin-address`); they are in their normal position and listed in the go-live checklist. Database changes that Hibernate can't make are versioned SQL files in `docs/*-migration.sql`. | `JwtService`, `FieldCipher`, `DataInitializer` |
| **8.31 Separation of environments / 8.33 Test information** | Tests and load tests run on separate databases (`intellectt_test`, `intellectt_load`) with email disabled. Test data uses non-real SSNs (900-series) and is left out of the production build. | `application-test.properties`, `CandidateForm.jsx` |
| **8.8 Management of technical vulnerabilities** | `npm audit`: 0 known vulnerabilities in frontend dependencies (27 Oct 2026). | Re-run regularly; see section 2 |

## 2. To complete at go-live (technical, owned by IT)

| Control | Action |
|---|---|
| 8.20 / 8.24 (in transit) | Serve the portal and API **only over HTTPS** (nginx + certificate). Add the web-server headers listed in SECURITY.md, and pass the client IP from nginx so sign-in rate limiting works per user. |
| 8.24 Key management | Generate new production keys (`APP_JWT_SECRET`, `APP_CRYPTO_KEY`), store them in a secrets manager or restricted environment variables, and **back up the encryption key separately**. If it's lost, stored SSNs can't be recovered. |
| 8.13 Information backup | Schedule encrypted PostgreSQL backups, including the `*_aud` audit tables and `logs/`. Test a restore. |
| 8.8 Vulnerabilities | Add backend dependency scanning (e.g. OWASP Dependency-Check or GitHub Dependabot) and apply Spring Boot patch releases. Re-run `npm audit` before each release. |
| 8.2 / 8.32 | Run the app with a database account that has data rights only (no CREATE / ALTER / DROP); run migrations with a separate admin account. Run `docs/dropout-doj-migration.sql` (it adds columns) before deploying the version that needs it. |
| 8.20 Network | With `server.forward-headers-strategy=framework` the backend trusts `X-Forwarded-For` from any caller, so the reverse proxy / platform must overwrite it (Render and nginx do), or the per-IP sign-in lock-outs can be sidestepped. |
| 8.17 Clock synchronization | Keep the server clock on NTP, since log and audit timestamps depend on it. |
| 8.2 / 8.5 | **Add multi-factor sign-in for Super Admin and Admin accounts.** It isn't built yet, and it's the most valuable next addition. |
| 5.14 Information transfer | Send email through a business provider with TLS, and SPF/DKIM for the sending domain. Emails already contain only the masked SSN. |
| 5.17 / 8.5 | **Change the Super Admin password.** On 27 Oct 2026 it was set to a simple value so the team could start testing, and it does not have to be changed at first sign-in. Choose a strong one (and consider turning on "must change password" for it) before real data is loaded. |
| 8.13 / 5.33 | **Protect or delete the database backup files** (`db-backups/` next to the project). Each one holds every user's bcrypt hash, the encrypted SSNs and all personal data in plain SQL. Keep them encrypted, off the server and access-controlled, and delete the ones that aren't needed. |
| 8.9 | Before go-live set `app.entity-mail.mailbox-routing=true` and leave `app.entity-mail.super-admin-address` blank; run every `docs/*-migration.sql` on the production database (after a backup); set `app.frontend.base-url` to the real portal address (the **View candidate** button in emails uses it). |
| 8.16 Monitoring | Have someone review `logs/security.log` (or forward it to a SIEM) and alert on repeated `LOGIN_BLOCKED` or `ACCESS_DENIED` entries. |

## 3. Organisational controls (outside the software)

These are required for certification and are the company's responsibility. The portal
supports them but can't fulfil them on its own:

- **ISMS scope, information security policy and risk assessment** (clauses 4–6, 5.1).
- **Roles and responsibilities**: who owns the portal, approves access and reviews logs (5.2, 5.3).
- **Access review procedure**: e.g. quarterly, the Admin reviews the Users page and
  deactivates leavers and long-unused accounts (5.18). Leavers must be deactivated on their
  last day (5.11, 6.5).
- **Acceptable use** of candidate data, agreed by every user (5.10). The sign-in page shows a notice.
- **Data retention and deletion** (5.33, 8.10, privacy law): decide how long candidate
  records and SSNs are kept. The portal currently keeps everything. A retention or
  anonymisation feature can be added once the period is decided.
- **Privacy notice to candidates** about what is collected and why (5.34). Depending on where
  candidates live, local law (e.g. US state privacy laws, GDPR) also applies.
- **Incident management** (5.24–5.28): who to call, and who decides. The technical steps (spot, preserve evidence, contain, assess, recover, report) are the runbook "If an attack happens" in SECURITY.md; the company still has to name the people and the reporting duties.
- **Supplier security** for hosting and email providers (5.19–5.22).
- **Security awareness training** for users, especially on phishing and password reuse (6.3).
- **Business continuity** (5.29, 5.30): backup and restore plan for the portal.

## 4. Known residual risks (accepted for now)

- Sign-in tokens are kept in the browser's `localStorage`. This is mitigated by the CSP and
  the absence of HTML injection points (see SECURITY.md).
- Password-reset tokens are stored unhashed. They are single-use and expire in 60 minutes.
- Deleting a candidate or user from the database does not remove their personal data from the `*_aud` audit tables (they are append-only by design). If privacy law requires erasure, a controlled purge procedure is needed (see data retention in section 3).
- Rate-limit counters are kept in memory per server. That's fine for one server; move them
  to shared storage if the backend is scaled out.
- There is no multi-factor sign-in yet (section 2).
