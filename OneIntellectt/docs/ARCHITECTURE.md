# Architecture — One Intellectt

Diagrams are written in [Mermaid](https://mermaid.js.org). They render on GitHub,
GitLab and in VS Code (with a Mermaid extension). A standalone picture of the system
is in [architecture.png](architecture.png) (vector version: [architecture.svg](architecture.svg)).

![System architecture](architecture.png)

---

## 1. System context

Who uses the system, and which outside systems it talks to.

```mermaid
flowchart LR
    subgraph People
        REC[Recruiter]
        SL[Sales Lead]
        SM[Sales Manager]
        HRC[HR / Contracts]
        PA[Payroll / Accounts]
        ADM[Admin]
        SA[Super Admin]
    end
    OI["One Intellectt<br/>Candidate Onboarding Portal"]
    MAIL[("Mail server<br/>(SMTP)")]
    BOX["Entity mailboxes<br/>hr@ / payroll@ / accounts@<br/>contracts@ / superadmin@"]

    REC -- submits candidates --> OI
    SL -- approves / declines, rates, project end --> OI
    SM -- same, over several teams --> OI
    HRC -- review, approve / decline --> OI
    PA -- approve / decline after HR and Contracts --> OI
    ADM -- manages users and teams --> OI
    SA -- oversees, overrides, audits --> OI
    OI -- notification emails --> MAIL --> BOX
```

---

## 2. Containers

The deployable pieces and how they communicate.

```mermaid
flowchart LR
    B["Web browser"]
    subgraph Server["Server (production: behind nginx with HTTPS)"]
        FE["Frontend SPA<br/>React 19 + Vite 8 + Ant Design 6<br/>static files (dist/)"]
        API["Backend REST API<br/>Spring Boot 4.1 / Java 17<br/>port 5000"]
        LOG[["logs/<br/>oneintellectt.log<br/>security.log"]]
    end
    DB[("PostgreSQL 16<br/>database: Intellectt<br/>tables + *_aud history")]
    SMTP[("SMTP server")]
    SEC[["secrets.properties<br/>or environment variables"]]

    B -- "GET static files" --> FE
    B -- "JSON over HTTPS<br/>Authorization: Bearer JWT" --> API
    API -- "JDBC (HikariCP, 30 connections)" --> DB
    API -- "async, mailExecutor pool" --> SMTP
    API -- writes --> LOG
    SEC -. "DB password, JWT key,<br/>SSN key, mail password" .-> API
```

| Container | Technology | Responsibility |
|---|---|---|
| Frontend | React 19, React Router 7, Ant Design 6, axios, dayjs; built by Vite 8 | Screens, forms, client-side checks (convenience only), session idle warning |
| Backend | Spring Boot 4.1.1 (Web MVC, Security 7, Data JPA / Hibernate 7, Envers, Mail), jjwt 0.12 | All business rules, authorization, workflow, email, audit, security logging |
| Database | PostgreSQL 16 | Operational data and full change history |
| Mail | Any SMTP (Gmail in development) | Delivering notifications |

---

## 3. Backend components

Layered: controller → service → repository. Cross-cutting concerns sit in
`security`, `config`, `audit` and `exception`.

```mermaid
flowchart TB
    subgraph Web["HTTP layer"]
        F1["Spring Security filter chain<br/>CORS · security headers"]
        F2["JwtAuthFilter<br/>token → session check → principal<br/>forces password change"]
        C["Controllers<br/>Auth · User · Team · Candidate · Audit"]
        EH["GlobalExceptionHandler<br/>exception → JSON + status"]
    end
    subgraph Svc["Service layer (interface + Impl)"]
        AS[AuthService]
        US[UserService]
        TS[TeamService]
        CS["CandidateService<br/>workflow state machine, rates,<br/>project end date"]
        SS[SessionService]
        ES["EmailService<br/>entity routing, async"]
        AUS["AuditService<br/>reads *_aud tables"]
        CQ["CandidateQueries<br/>visibility, search, status keys"]
    end
    subgraph Sec["security"]
        JWT[JwtService]
        AL["AttemptLimiter<br/>rate limits"]
        FC["FieldCipher<br/>AES-256-GCM"]
        SE["SecurityEvents<br/>security.log"]
    end
    subgraph Data["Persistence"]
        R["Spring Data repositories"]
        ENT["JPA entities<br/>User · Team · Candidate · ApprovalAction<br/>UserSession · PasswordResetToken"]
        ENV["Hibernate Envers<br/>AuditRevisionListener"]
    end
    DB[(PostgreSQL)]

    F1 --> F2 --> C
    C --> AS & US & TS & CS & AUS
    C -.-> EH
    AS --> SS & JWT & AL & ES & SE
    CS --> CQ & ES & R
    US --> SS & R
    TS --> R
    SS --> R
    AUS --> DB
    R --> ENT --> DB
    ENT -. "SsnConverter" .-> FC
    ENT -. "on every write" .-> ENV --> DB
```

| Package | Contents |
|---|---|
| `controller` | `AuthController`, `UserController`, `TeamController`, `CandidateController`, `AuditController` — thin; pass the signed-in user to services |
| `service` | Interfaces + `*Impl`: auth, users, teams, candidates (workflow, HR edit, rates, project end date, email HTML), sessions, email, audit; `CandidateQueries` (Specifications), `CredentialRules` (password/email rules), `AllowedEmailDomains` (company email ids only) |
| `repository` | Spring Data JPA repositories; `@EntityGraph` on list/detail queries to avoid N+1 |
| `model`, `model.enums` | JPA entities used directly as JSON bodies; `SsnConverter` |
| `security` | `JwtService`, `JwtAuthFilter`, `RestAuthenticationEntryPoint`, `AppUserPrincipal`, `CustomUserDetailsService`, `AttemptLimiter`, `FieldCipher`, `SecurityEvents` |
| `config` | `SecurityConfig`, `AsyncConfig` (mail pool), `EntityMailProperties`, `DataInitializer` (first Super Admin), `AuditLoggingGuard`, `SsnEncryptionMigration` |
| `audit` | `AuditRevision` (`audit_revisions`), `AuditRevisionListener` (who made the change) |
| `exception` | `BadRequestException` (400), `ForbiddenException` (403), `ResourceNotFoundException` (404), `TooManyRequestsException` (429), `GlobalExceptionHandler` |

---

## 4. Frontend structure

```mermaid
flowchart TB
    MAIN["main.jsx<br/>(starts MSW only in mock mode)"] --> AP["AuthProvider<br/>user from /api/auth/me"]
    AP --> APP["App.jsx routes"]
    APP --> PUB["Public pages<br/>Landing · Login · ForgotPassword<br/>ResetPassword · ChangePassword"]
    APP --> PR["ProtectedRoute<br/>signed in? role allowed?<br/>password change needed?"]
    PR --> LAY["AppLayout<br/>sidebar · header · SessionTimeout"]
    LAY --> PAGES["CandidateList · CandidateNew · CandidateDetail<br/>AdminDashboard · UserManagement<br/>TeamManagement · AuditLog"]
    PAGES --> COMP["components/<br/>CandidateForm · ActionButtons · ActionModal<br/>ApprovalTimeline · StageProgress · StatusTag …"]
    PAGES --> API["api/*.js<br/>translation layer"]
    API --> CL["client.js (axios)<br/>adds Bearer token<br/>401 → login · 403 PASSWORD_CHANGE_REQUIRED"]
    CL --> BE[(Backend API)]
    PAGES --> UT["utils/<br/>status · permissions · roles · format<br/>passwordRules · session"]
```

- **`src/api/` is the only place that knows the backend's JSON shapes.** It maps them
  to the shapes the components use (e.g. backend `status` + branch decisions →
  `stages` + `override`; `jobRole` → `role`; `ssnMasked` → `ssn`).
- **Routes and roles:** `/candidates*` for workflow roles, `/candidates/new` for
  Recruiters, `/admin` (dashboard) and `/admin/audit` for Super Admin, `/admin/users`
  for Super Admin/Admin, `/admin/teams` for Super Admin/Admin/Sales Lead/Sales Manager.
- **State:** the signed-in user lives in React context. Only the token, idle-timer data
  and a sign-out message are in browser storage.

---

## 5. Key flows

### 5.1 Sign-in and an authenticated request

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant A as AuthController / AuthService
    participant L as AttemptLimiter
    participant S as SessionService
    participant F as JwtAuthFilter
    participant DB as PostgreSQL

    B->>A: POST /api/auth/login {email, password}
    A->>L: blocked? (account+IP, account, IP)
    alt too many failures
        A-->>B: 429 + Retry-After
    end
    A->>DB: load user, bcrypt check
    A->>S: start session (ends this user's other sessions)
    S->>DB: INSERT user_sessions
    A-->>B: {token(sid), role, mustChangePassword, idleTimeoutMinutes}
    Note over B: token kept in localStorage

    B->>F: GET /api/candidates (Bearer token)
    F->>F: verify signature and expiry
    F->>DB: load user (fresh role), check session live and not idle
    alt session ended / invalid
        F-->>B: 401 {reason}
    else must change password
        F-->>B: 403 PASSWORD_CHANGE_REQUIRED
    else ok
        F->>A: continue to controller → service (role and row checks)
        A-->>B: 200 page of results
    end
```

### 5.2 Workflow action with email and audit

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser (Sales Lead)
    participant C as CandidateController
    participant CS as CandidateServiceImpl
    participant DB as PostgreSQL
    participant EV as Envers
    participant ES as EmailService (async)
    participant M as SMTP

    B->>C: POST /api/candidates/42/sales-lead/approve?comment=…
    C->>CS: salesLeadApprove(42, user, comment)
    CS->>CS: is the user this team's Sales Lead or the Sales Manager over it? is the status awaiting approval?
    CS->>DB: UPDATE candidates (status, branch decisions)
    CS->>DB: INSERT approval_actions (trail)
    DB-->>EV: same transaction: write candidates_aud, approval_actions_aud, audit_revisions(who, when)
    CS->>ES: notifyStage([placement entity (+ payroll company)], [HR, CONTRACTS], other approver)
    ES-->>M: one email to hr@, contracts@, superadmin@<domain> (each entity) and the other approver
    C-->>B: 200 updated candidate
```

### 5.3 Password reset

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as AuthService
    participant DB as PostgreSQL
    participant M as Email
    B->>A: POST /forgot-password {email}
    A->>A: rate limits (per IP → 429, per account → silently skip)
    A->>DB: active user? → INSERT password_reset_tokens (60 min, single use)
    A-->>M: link to the user only
    A-->>B: 200 generic message (whether or not the email exists)
    B->>A: POST /reset-password {token, newPassword}
    A->>DB: token valid? → new bcrypt hash, token used, end all sessions
    A-->>B: 200
```

---

### 5.4 Project end date and exit

```mermaid
stateDiagram-v2
    [*] --> NOT_RAISED
    NOT_RAISED --> RAISED: recruiter raises a date (only after the DOJ is approved)
    DECLINED --> RAISED: recruiter raises a new date
    RAISED --> APPROVED: Sales Lead / Sales Manager / Super Admin approve
    RAISED --> DECLINED: they decline (comment required)
    NOT_RAISED --> APPROVED: an approver enters the date (the entry is the approval)
    APPROVED --> APPROVED: an approver changes the date
    APPROVED --> [*]: candidate shows as Exited
```

### 5.5 Which mailboxes an email goes to

```mermaid
flowchart LR
    EV["Workflow event<br/>(approve, decline, rates, project end …)"] --> CS["CandidateServiceImpl.emailEntities"]
    CS --> E1["Placement Entity<br/>e.g. novozen"]
    CS -- "payroll company is another<br/>of the ten entities" --> E2["Payroll company<br/>e.g. kennedysoft"]
    E1 --> R["EmailService.stageRecipients<br/>role → mailbox @ entity domain<br/>+ superadmin@"]
    E2 --> R
    PEOPLE["Individual people<br/>Lead · Manager · recruiter"] --> R
    R --> U["one de-duplicated list<br/>→ ONE email"]
```

If the payroll company is the same as the Placement Entity, is "Other", or is empty, only the
Placement Entity's mailboxes are used.

---

## 6. Deployment view (recommended production)

```mermaid
flowchart LR
    U[Users' browsers] -- HTTPS 443 --> NX
    subgraph Host["Application server"]
        NX["nginx<br/>TLS · security headers<br/>serves dist/ · proxies /api"]
        JV["java -jar / WAR<br/>Spring Boot :5000<br/>(not exposed publicly)"]
        LG[["logs/"]]
    end
    subgraph DBH["Database server (private network)"]
        PG[("PostgreSQL :5432")]
        BK[["Encrypted backups"]]
    end
    NX -- "/api → http://127.0.0.1:5000<br/>X-Forwarded-For" --> JV
    JV --> PG
    JV --> LG
    PG --> BK
    JV -- "SMTP + TLS" --> MS[("Transactional email service")]
```

Step-by-step: [DEPLOYMENT.md](DEPLOYMENT.md).

Scaling out: sessions and all state are in PostgreSQL, so a second backend instance
can be added behind nginx. Keep *pool size × instances* below PostgreSQL's
`max_connections`, and move the in-memory rate-limit counters to shared storage.

---

## 7. Cross-cutting concerns

| Concern | Where it's handled |
|---|---|
| Authentication | `JwtAuthFilter`, `JwtService`, `SessionServiceImpl`, `AuthServiceImpl` |
| Authorization | Each `*ServiceImpl` (role/team checks), `CandidateQueries.visibleTo` |
| Validation | `CredentialRules`, service checks, `GlobalExceptionHandler` (400s) |
| Auditing | Hibernate Envers (`@Audited` on every entity), `AuditRevisionListener` |
| Security logging | `SecurityEvents` → `logs/security.log` |
| Encryption | `FieldCipher` + `SsnConverter`; keys from configuration |
| Transactions | `@Transactional` on service methods; OSIV disabled |
| Async work | `AsyncConfig.mailExecutor` |
| Configuration | `application.properties` (+ `application-test.properties`), `secrets.properties`, environment variables |
