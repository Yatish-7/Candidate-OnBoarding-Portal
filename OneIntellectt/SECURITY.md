# Security — One Intellectt

What protects the portal against common attacks, how it's tested, and what still has to
be done when it goes live. Every protection below is checked by the tests in
`src/test/java/com/intellectt/api/` (`SecurityApiTest`, `RoleAccessApiTest`,
`ComplianceApiTest`, `EmailDomainApiTest`, `NewFeatureSecurityApiTest`), which run with `./mvnw test`. How these map to ISO/IEC 27001:
[COMPLIANCE.md](COMPLIANCE.md).

## Protections in place

| Attack | What stops it | Where |
|---|---|---|
| **SQL injection** | All database queries use bound parameters (JPA Criteria and `?` placeholders). User text is never pasted into SQL. In the audit log, table names come from a fixed list. In searches, `%` and `_` count as normal characters, not wildcards. | `CandidateQueries`, `AuditServiceImpl` |
| **Stored / reflected XSS** | The API only returns JSON. React escapes all text it displays, and the code never uses `dangerouslySetInnerHTML`, `innerHTML` or `eval`. Values inserted into email HTML are escaped (`esc()`). The production build adds a **Content-Security-Policy**: the browser runs only the portal's own scripts and talks only to the portal's own API. | `vite.config.js`, `CandidateServiceImpl`, `AuthServiceImpl` |
| **Password guessing** | Too many failed sign-ins lock out: one account from one IP after **5** failures, one account from any IP after **20**, and one IP after **50**. Each lock lasts 15 minutes and returns `429` with a `Retry-After` header. The real user can still sign in from their own device. Passwords are hashed with bcrypt. | `AuthServiceImpl`, `security/AttemptLimiter` |
| **Accounts outside the company** | Only company email ids can have an account or sign in: the domains in `app.allowed-email-domains` (intellectt.com, novozen.com, revereit.com, premierlifesciences.com, unitedpharmatechnologies.com, kennedysoft.com, shoolin-inc.com, lumininc.com, lumin-innovations.com, kkrconsulting.com, ubitz.ai). Creating or editing a user with any other address (e.g. Gmail) is refused, and the sign-in page says to use the correct company email id. Sub-domains don't count. The check is on the server; the browser repeats it only for convenience. `EmailDomainApiTest`. | `AllowedEmailDomains`, `UserServiceImpl`, `AuthServiceImpl` |
| **Account discovery** | Wrong password and unknown email return the same message. "This account has been deactivated" appears only when the password is correct. Forgot-password always returns the same reply. | `AuthServiceImpl` |
| **Reset-email flooding** | At most **3** reset emails per account per hour; extra requests are skipped silently. At most **20** reset requests per IP per hour, then `429`. | `AuthServiceImpl` |
| **Personal data (SSN)** | Encrypted in the database with AES-256-GCM, including the audit history, using a key kept in `secrets.properties`. The API never returns it: responses carry only `ssnMasked` (`***-**-1234`), and emails and the audit log show the same masked value. | `FieldCipher`, `SsnConverter`, `SsnEncryptionMigration` |
| **Temporary passwords** | A password set by an admin (new account or reset) must be replaced at first sign-in. Until then, the server refuses everything except changing it. Users can change their own password at any time from the menu under their name. | `JwtAuthFilter`, `AuthServiceImpl.changePassword`, `ChangePassword.jsx` |
| **Weak passwords** | 8–72 characters with at least one letter and one number. Enforced on the server, with the same check in the browser. | `CredentialRules`, `utils/passwordRules.js` |
| **Unauthorized role access / privilege escalation** | Only the Super Admin and Admins can create, edit, deactivate or delete accounts and teams. An Admin can never touch a Super Admin or promote anyone to Super Admin, and nobody can change their own role. A Sales Lead manages only their own team's recruiters, and a Sales Manager only the recruiters of the teams under them. Fields only the server sets (status, decisions, who submitted, "must change password", last sign-in) are ignored if a request sends them. The role always comes from the database on every request, never from the token or the browser. `RoleAccessApiTest` tries every role against every kind of endpoint. | `UserServiceImpl`, `TeamServiceImpl`, `CandidateServiceImpl`, `JwtAuthFilter` |
| **DOM manipulation in the browser** | The page holds no trusted data. The signed-in user and role are fetched from the server (`/api/auth/me`), and editing the page, its storage or its JavaScript only changes what that browser shows: every request is checked again on the server. The code has no HTML-injection points, all links and redirects are internal, and test helpers (sample data) are left out of the production build. | `AuthProvider`, `ProtectedRoute`, `CandidateForm` |
| **Seeing other people's data** | Every service checks the caller's role and team. A recruiter sees only their own candidates, a Sales Lead only their own team and a Sales Manager only the teams under them. Payroll and Accounts see a candidate only after HR and Contracts have both approved it. Admin sees no candidates. Only Super Admin, Admin, Sales Leads and Sales Managers (for their own teams) can list users by role or see teams; the team-name list used by the intake form (`/api/teams/options`) returns names only, never members. Only the Super Admin can see the audit log. | services |
| **Unauthorised changes to money fields** | Bill and pay rates can change after submission only through `POST /candidates/{id}/rates`, which is limited to the candidate's own Sales Lead, the Sales Manager over the team and the Super Admin, needs a comment, and is blocked for declined candidates. Every change is on the approval trail (old → new, who, why), in the audit history, and emailed to everyone in the loop. Other candidate details can be edited only by HR (`PUT /candidates/{id}`, role checked in the service, listed old → new on the trail and emailed to everyone in the loop); nobody else can change them. `RoleAccessApiTest` and `SalesManagerApiTest` check it. | `CandidateServiceImpl.changeRates` |
| **Forged sign-in tokens** | JWTs are signed (HMAC-SHA) with a long random key. Tampered, unsigned (`alg: none`) and expired tokens are rejected. Each token is also tied to a server-side session, which ends at logout, idle timeout, deactivation or password reset. | `JwtService`, `JwtAuthFilter`, `SessionService` |
| **Clickjacking, MIME sniffing, leaking URLs** | API responses send `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Cache-Control: no-store`, and HSTS on HTTPS. The web page sets `no-referrer`, so a reset link in the address bar is never sent to other sites. | `SecurityConfig`, `index.html` |
| **CSRF** | Not applicable. The token travels in the `Authorization` header, not in a cookie, so another site can't make the browser send it. CORS allows only the portal's own origins. | `SecurityConfig` |
| **Leaking internals** | Errors return a generic message. Stack traces and SQL appear only in the server log. Bad input returns `400`, unknown URLs `404`, and a busy database `503`. | `GlobalExceptionHandler` |
| **Email header injection** | Line breaks are removed from email subjects. | `EmailServiceImpl` |
| **Links in emails** | Every candidate email ends with a **View candidate** button. Its address is the configured portal address (`app.frontend.base-url`) plus the candidate's numeric id, so no user input can point it elsewhere (no open redirect). It opens the sign-in page first if needed, then the candidate; the server checks the person's role and team as usual. | `CandidateServiceImpl.emailHtml` |
| **Mail in transit** | The mail connection must use TLS (`starttls.required`) and the server's certificate name is checked, so it can't be downgraded to plain text. | `application.properties` |
| **Forcing workflow fields through a request** | An HR edit and a candidate submit copy only the intake fields. Status, the four decisions, DOJ and project end status, owner, team and recruiter location in a request are ignored; the recruiter location comes from the recruiter's profile. | `CandidateServiceImpl.applyIntake`, `NewFeatureSecurityApiTest.editCannotMassAssign` |
| **Secrets in code** | The DB password, JWT key, mail password and first-admin password are in `secrets.properties`, which is git-ignored, or in environment variables. Startup fails if the JWT key is missing or weak. There is no built-in default admin password. Email bodies, which can contain reset links, are never logged. | `application.properties`, `JwtService`, `DataInitializer` |
| **Security event log** | `logs/security.log` records successful and failed sign-ins, lock-outs, refused access, and password changes and resets, and is kept for 365 days. It never contains passwords or IP addresses, and line breaks in user input are neutralised so log entries can't be forged. `logs/oneintellectt.log` keeps the general log for 30 days. | `SecurityEvents`, `logback-spring.xml` |
| **Audit trail** | Every change to every table is recorded with who made it and when (Hibernate Envers). Passwords and reset tokens are not recorded. IP addresses are not recorded. | `audit/` |
| **Vulnerable libraries** | `npm audit` reports 0 known vulnerabilities in the frontend dependencies (checked 26 Oct 2026). | — |

## Go-live checklist

1. **HTTPS only.** Put nginx (or similar) in front of the backend and the built frontend, with a
   real certificate, and redirect HTTP to HTTPS. Set `APP_FRONTEND_BASE_URL` and
   `CORS_ALLOWED_ORIGINS` to the `https://` address.
2. **Secrets.** On the server, use environment variables (`DB_PASSWORD`, `APP_JWT_SECRET`,
   `APP_CRYPTO_KEY`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `SUPERADMIN_PASSWORD`) or a `secrets.properties` that only
   the service account can read. Generate a **new** JWT key for production:
   `python -c "import secrets;print(secrets.token_urlsafe(64))"`.
   Use a database user with access to this database only, not `postgres`.
   **Back up `app.crypto.key` separately and securely.** Without it, stored SSNs can't be
   read back. Never change it on a database that already holds encrypted SSNs.
3. **Change the Super Admin password** after the first sign-in (it currently comes from config).
4. **Web server headers for the frontend** (a `<meta>` tag can't set these):
   ```nginx
   add_header Content-Security-Policy "frame-ancestors 'none'" always;
   add_header X-Frame-Options DENY always;
   add_header X-Content-Type-Options nosniff always;
   add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
   ```
5. **Client IPs for rate limiting.** nginx must send the real client IP:
   `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`. The backend trusts that
   header only from private/local addresses (`server.forward-headers-strategy=native`).
   If the proxy is on a public IP, set `server.tomcat.remoteip.internal-proxies` to it.
   Without this, every user appears to come from the proxy's IP, and 50 failed sign-ins
   from all users together would block everyone for 15 minutes.
6. **Don't expose PostgreSQL** (port 5432) or the backend port directly to the internet;
   only nginx should be public.
7. **Email:** switch from a personal Gmail account to a transactional service (see
   `load-test/RESULTS.md`), and set up SPF/DKIM for the sending domain.
8. **Backups** of the database, including the `*_aud` audit tables.
9. Re-run `npm audit` and keep Spring Boot up to date (patch releases fix security issues).
   Last checks (27 Oct 2026): `npm audit` 0 vulnerabilities; all 108 backend tests pass (SQL injection, XSS, access control, privilege escalation, brute force, forged tokens, mass assignment, email-domain rule).
10. **Run the SQL migrations** in `docs/` (`sales-manager-`, `payroll-accounts-`, `project-end-`, `rate-change-migration.sql`)
    on the production database, after a backup. Rows inserted by hand (e.g. `docs/sample-candidates.sql`) bypass the
    application, so they are not in the audit log and send no email; don't use that for real data.

## Known limitations (acceptable for now)

- **The sign-in token is kept in the browser's `localStorage`.** If a script were ever
  injected into the page, it could read the token. The CSP, React's escaping and the absence
  of HTML rendering make that very unlikely. Moving the token to an `HttpOnly` cookie
  would also require CSRF protection, so it's a larger change.
- **Rate-limit counters are in memory.** They reset when the backend restarts, and each
  backend instance counts on its own. That's fine for a single instance. With several
  instances, move the counters to Redis or the database.
- **Older audit history rows may hold plain-text SSNs** if a candidate was changed before
  encryption existed. When this was added on 26 Oct 2026, the live database had none. On
  other copies of the database, check with
  `SELECT count(*) FROM candidates_aud WHERE ssn_no NOT LIKE 'enc:%'`.
- **Reset tokens are stored as plain text** in `password_reset_tokens`. They are single-use
  and expire after 60 minutes, but someone who could read the database could use an unexpired
  one. Hashing them (like passwords) would close that gap.
- **No two-factor sign-in.** This is worth adding for the Super Admin and Admin accounts.
- **The Super Admin password was set to a simple value for testing (27 Oct 2026)** and isn't forced to change at first sign-in. Change it to a strong one before real data is loaded.
- **Database backup files** (`db-backups/`) hold password hashes, encrypted SSNs and personal data in plain SQL. Keep them encrypted and access-controlled, or delete them when not needed.
- **Testing switches:** `app.entity-mail.mailbox-routing=false` and `app.entity-mail.super-admin-address=<address>` change where emails go. They are in their normal position (true / blank); don't leave them changed in production.
- **Request size:** the backend itself doesn't cap JSON size; nginx's `client_max_body_size 1m` (in DEPLOYMENT.md) does.
- **Audit tables keep personal data** after a candidate or user is deleted (append-only by design).
