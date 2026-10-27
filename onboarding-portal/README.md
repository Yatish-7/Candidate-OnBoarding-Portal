# One Intellectt — Frontend

The web app for **One Intellectt**, the candidate onboarding & approval portal. It's
built with React 19, Vite 8 and Ant Design 6, and talks to the Spring Boot backend in
[`../OneIntellectt`](../OneIntellectt).

**Workflow:** Recruiter submits → Sales Lead **or** Sales Manager approves (or declines) → HR and Contracts
review **in parallel** → Payroll and Accounts review in parallel (they see the candidate only once HR and
Contracts have both approved) → the Sales Lead / Manager approves the Date of Joining → Joined. Any decline
(with a comment) sends the candidate back to the Sales Lead / Manager. After joining, the recruiter raises a
project end date, the Lead / Manager / Super Admin approve or decline it, and an approved date means the
candidate has **Exited**. HR can edit a candidate's details at any time; the Lead, Manager and Super Admin
can change the bill and pay rates. The Super Admin can override any candidate.

System documentation (design, architecture, API, deployment, security) is in the
backend project: [`../OneIntellectt/docs`](../OneIntellectt/docs/TDD.md).

---

## 1. Run it

You need [Node.js](https://nodejs.org) 20+ and the backend running on
`http://localhost:5000` (see its README).

```bash
npm install      # first time only
npm run dev      # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build in `dist/` (adds a Content-Security-Policy) |
| `npm run preview` | Serves `dist/` locally to check the build |
| `npm run lint` | Checks the code (oxlint) |

### Configuration (`.env`)

| Variable | Value | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:5000` | Backend address. Leave **empty** in production when nginx serves the app and `/api` from the same domain |
| `VITE_USE_MOCKS` | `false` | `true` runs a fake in-browser backend (MSW) from the original prototype. It isn't maintained and doesn't match the current backend, so keep it `false` |

Vite reads `.env` only at start-up: restart `npm run dev` after changing it. The backend
must allow this app's origin in `app.cors.allowed-origins` (it allows `:5173` and `:4173`
by default).

## 2. Signing in

Accounts are created by a Super Admin or Admin on the **Users** page, with a temporary
password. Only company email ids are accepted (the domains in `src/utils/emailDomains.js`, matching the
backend's `app.allowed-email-domains`); the sign-in page says "use your correct company email id" for any other.
Recruiters also get a **Location** there, which is copied onto every candidate they submit. At first sign-in, the user must choose their own password (8+ characters with a
letter and a number). Users can also change it later from the menu under their name.
"Forgot password?" on the login page emails a reset link.

The session ends after 30 minutes without activity (a warning appears a minute before),
when the user signs in somewhere else, or when they're deactivated. The login page says why.

## 3. Pages

| Path | Who | What |
|---|---|---|
| `/` | Everyone | Landing page |
| `/login`, `/forgot-password`, `/reset-password` | Everyone | Sign-in and password reset |
| `/change-password` | Signed in | Change password (forced at first sign-in) |
| `/candidates` | All workflow roles | Paged, searchable list with a status filter |
| `/candidates/new` | Recruiter | Intake form |
| `/candidates/:id` | Those who can see it | Details, stage progress, approval trail, action buttons (approve / decline, rates, project end date, HR's Edit details) |
| `/candidates/:id/edit` | HR | Edit a candidate's details (everyone in the loop is emailed) |
| `/admin` | Super Admin | Dashboard counters (Pending, Approved, Declined, Joined, Exited) + all candidates |
| `/admin/users` | Super Admin, Admin | Create, edit, deactivate and delete users; shows last sign-in |
| `/admin/teams` | Super Admin, Admin, Sales Lead, Sales Manager | Teams, their Sales Lead and Sales Manager, and members (a Lead sees own team only; a Manager the teams under them) |
| `/admin/audit` | Super Admin | History of every change, with before/after |

## 4. Project structure

```
src/
  api/          axios client + one module per resource. The ONLY place that knows the
                backend's JSON shapes; it translates them for the components
  context/      AuthContext / AuthProvider: the signed-in user (from /api/auth/me)
  components/   layout, forms, workflow buttons and modals, timeline, status tag,
                session-timeout warning, route guard
  pages/        one file per page (see the table above)
  utils/        status rules, permissions (which buttons show), roles, options,
                formatting, password rules, session timer
  mocks/        legacy fake backend (dormant)
  theme.js      Ant Design theme (graphite + blue, dark sidebar)
  App.jsx       routes and which roles may open each page
  main.jsx      app start-up
```

## 5. Good to know

- **Security:** the backend enforces every rule. Hiding a button here is only a
  convenience. The app never renders user text as HTML, and the SSN arrives from the
  server already masked (`***-**-1234`).
- **Status labels** come from `getStatusKey` in `src/utils/status.js`. It must match
  `CandidateQueries.statusKey` in the backend, which drives the status filter and the dashboard counters.
- **Placement Entity** options (`src/utils/options.js`) must match the backend's
  `app.entity-mail.domains.*` keys, since they decide where emails go.
- **"Some chunks are larger than 500 kB"** during the build is just a warning (Ant Design is large).
- In development, every request shows twice in the Network tab (React StrictMode). The production build doesn't do this.
