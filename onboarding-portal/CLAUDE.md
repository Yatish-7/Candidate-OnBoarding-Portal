# One Intellectt — Frontend (onboarding-portal)

> **The full-system guide is `../OneIntellectt/CLAUDE.md`. Read it first.** It covers
> the workflow, roles, backend, security rules, environment gotchas and the docs map.
> This file covers what's specific to the React app.

## About the developer
New to frontend development. When working here:
- Explain what you're doing in simple terms.
- Keep code simple and readable over clever; add short comments for non-obvious parts.
- Build in small steps and say how to run and check each one.

## Stack
React 19 · Vite 8 · **Tailwind CSS 4** (via `@tailwindcss/vite`) · `@ant-design/icons` 6 (icons only) ·
React Router 7 · axios · dayjs · oxlint. JavaScript (not TypeScript). **No component library** — the UI is a
small hand-built kit in `src/ui/` (Button, Input/Select, Card, Table+Pagination, Modal/Drawer, Steps, Timeline,
DescriptionList, Stat, Result, Alert, Badge, Tooltip, Spinner, and a toast + confirm provider in `ui/feedback.jsx`).
Design tokens live in `src/index.css` `@theme` (indigo `#6366f1` → violet `#8b5cf6` brand, dark `#0b1020` sidebar,
Plus Jakarta Sans). Prefer the `src/ui/` kit and Tailwind utilities over custom CSS; global animations + the sidebar
styles are in `src/index.css` (base element styles live in `@layer base` so utilities win; `prefers-reduced-motion`
guarded).

## How it connects to the backend
- `.env`: `VITE_USE_MOCKS=false`, `VITE_API_BASE_URL=http://localhost:5000`.
  The `src/mocks/` MSW backend is **legacy and dormant**: it models an old sequential
  workflow, so don't extend it.
- **All HTTP goes through `src/api/*.js`**, which translate backend shapes into the shapes
  components use. Keep it that way, so pages don't change when the API does:
  - `auth.js`: `normalizeUser` (`fullName`→`name`, nested `team`→`teamId`/`teamName`,
    `mustChangePassword`, `lastLoginAt`), login/logout/me, forgot/reset/change password.
  - `candidates.js`: backend `status` + the four branch decisions (`hrDecision`, `contractsDecision`, `payrollDecision`,
    `accountsDecision`) + `dojStatus` → `stages {salesLead, hr, contracts, payroll, accounts, superAdmin, doj}` + `override`.
    Also the project end date (`projectEndDate`, `projectEndStatus`), HR edit (`updateCandidate` = PUT), rate change, Payroll/Accounts,
    Sales Lead decline and project-end approve/decline calls.
    Field mapping: `jobRole`→`role`, **`ssnMasked`→`ssn`** (the full SSN is never
    received), `leadOrTeamName`→`leadName`. Paged `getCandidates({page,size,search,status})`.
  - `dashboard.js` (`/candidates/summary`), `users.js`, `teams.js`, `audit.js`.
  - `client.js`: adds the Bearer token. On 401 it stores the server's reason and goes to
    `/login`. On 403 `PASSWORD_CHANGE_REQUIRED` it goes to `/change-password`.
- Workflow actions send the comment as a **query param** (`?comment=`), not a body.

## Key files
| File | Role |
|---|---|
| `App.jsx` | Routes; `ProtectedRoute roles={[…]}` per page |
| `ui/` | Hand-built Tailwind UI kit (no antd): `Button`, `Input`/`PasswordInput`/`Textarea`, `Select`/`RadioGroup`, `Card`, `Table`+`Pagination`, `Modal`/`Drawer`, `Field`, `Steps`, `Timeline`, `DescriptionList`, `Stat`, `Result`, `Alert`, `Badge`, `Tooltip`, `Spinner`; `feedback.jsx` = `UIProvider` + `useToast` (toast) + `useConfirm` (confirm dialog). Import from `ui/index.js`. |
| `index.css` | Tailwind import, `@theme` design tokens, `@layer base` element resets, sidebar + animation classes |
| `components/BrandMark.jsx` | `BrandBadge` (gradient atom badge) used in the sidebar; `AtomMark` svg |
| `components/AuthShell.jsx` | Shared frame for the public auth screens (forgot/reset/change password) |
| `components/ProtectedRoute.jsx` | Signed in? Password change required? Role allowed? |
| `context/AuthProvider.jsx` | User from `/api/auth/me`; `login`, `logout`, `refreshUser`; multi-tab sync |
| `components/AppLayout.jsx` | Dark sidebar (menu by role, responsive drawer), header user menu (change password, log out), per-route page transition |
| `components/SessionTimeout.jsx` + `utils/session.js` | Idle warning and auto sign-out, shared across tabs |
| `components/CandidateFilters.jsx` | Super Admin filter bar (date field + quick/custom range, recruiter, team, intake fields); `AdminDashboard` holds the filters and passes them to the counters (`getDashboardSummary`) and `CandidateList` (`filters` prop); `filterParams` in `api/candidates.js` |
| `components/ApprovalTimeline.jsx` | The trail, and `ChangeHistory` (edits / rate changes with who, when, old → new) |
| `components/ActionButtons.jsx` + `ActionModal.jsx` | Workflow actions (decline requires a comment) |
| `utils/permissions.js` | Which buttons show; mirrors the backend rules (HR may revise until DOJ approved and edits details at any time; Lead/Manager decline; Payroll/Accounts approve/decline; rates; project end raise/approve/decline) |
| `utils/status.js` | `getStatusKey` (incl. `PENDING_PAYROLL_ACCOUNTS`, `EXITED`), `STATUS_OPTIONS`, `SUMMARY_GROUPS`; **must match `CandidateQueries`** |
| `utils/options.js` | Placement Entity list (**must match `app.entity-mail.domains.*`**), recruiter locations, employment types, placement companies, payroll company |
| `utils/emailDomains.js` | The allowed company email domains (**must match `app.allowed-email-domains`**); used by the sign-in and user forms |
| `utils/passwordRules.js` | Same rule as the backend `CredentialRules` (8–72, letter + digit) |
| `pages/ChangePassword.jsx` | Forced at first sign-in, and from the user menu |
| `vite.config.js` | Production-only CSP `<meta>` (connect-src from `VITE_API_BASE_URL`) |

## Rules
- **Never** use `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or build URLs from user
  data for `href`/`window.location`. Navigation stays internal (`navigate('/…')`).
- Don't trust anything in browser storage for authorization: only the token, idle-timer
  data and a sign-out message are stored. The user and role come from the server.
- Test helpers (sample data, mock users) must not ship in production: gate them with
  `import.meta.env.DEV || USE_MOCKS` and load them with dynamic `import()`.
- Inline styles are fine (Tailwind's stylesheet plus a few inline `style` objects need `'unsafe-inline'` for
  styles); inline **scripts** are not (the CSP blocks them in production).
- After a change: `npm run lint` and `npm run build` must pass.

## Known gaps
- The comment box (`CommentBox`) is hidden: no standalone comments endpoint.
- `h1TransferDetails` is collected but not stored by the backend.
- The status tag says "Pending Contracts" while HR and Contracts are both pending.
- Only HR edits a candidate's details (`CandidateEdit`); a recruiter can't fix a typo after submitting.
- The mock backend in `src/mocks` is dormant and models an old workflow: don't extend it.
