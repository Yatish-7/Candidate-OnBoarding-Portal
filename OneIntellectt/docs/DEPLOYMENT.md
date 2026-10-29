# Deployment Guide — One Intellectt

How to run One Intellectt in production on one Linux or Windows server, with nginx in
front of the backend and the built frontend. The security background is in
[SECURITY.md](../SECURITY.md); the go-live checklist below follows from it.

## 1. Target layout

```
https://portal.example.com          (nginx, port 443)
├── /            → frontend static files   (onboarding-portal/dist)
└── /api/...     → backend at http://127.0.0.1:5000   (not reachable from outside)
PostgreSQL 16    → private network only (port 5432 closed to the internet)
SMTP             → transactional email provider (TLS)
```

Serving frontend and API from **one origin** means no CORS setup in the browser and a
simple Content-Security-Policy.

## 2. Prerequisites

| Item | Version |
|---|---|
| JDK | 17 (Temurin / Oracle) |
| PostgreSQL | 16 |
| Node.js | 20+ (build machine only) |
| nginx | any current version, with a TLS certificate (e.g. Let's Encrypt) |

## 3. Database

```sql
CREATE DATABASE "Intellectt";
CREATE USER oneintellectt WITH PASSWORD '<strong password>';
GRANT ALL PRIVILEGES ON DATABASE "Intellectt" TO oneintellectt;
\c "Intellectt"
GRANT ALL ON SCHEMA public TO oneintellectt;
```

Tables are created on first start. Use a dedicated database user, not `postgres`.

## 4. Backend

### 4.1 Build
```bash
cd OneIntellectt
./mvnw -DskipTests package          # → target/OneIntellectt-0.0.1-SNAPSHOT.war
```
The WAR runs on its own (`java -jar`) or can be deployed to an external Tomcat.

### 4.2 Configuration (environment variables)

| Variable | Required | Example / default | Purpose |
|---|---|---|---|
| `SPRING_DATASOURCE_URL` | yes | `jdbc:postgresql://db-host:5432/Intellectt` | Database |
| `SPRING_DATASOURCE_USERNAME` | yes | `oneintellectt` | |
| `DB_PASSWORD` | yes | | |
| `APP_JWT_SECRET` | yes | 64+ random chars | Signs sign-in tokens; startup fails if missing or weak |
| `APP_CRYPTO_KEY` | yes | base64 of 32 random bytes | Encrypts SSNs. **Back it up separately; never change it once data exists** |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | first start | | Creates the first Super Admin if none exists |
| `MAIL_HOST` / `MAIL_PORT` | yes | `smtp.sendgrid.net` / `587` | |
| `MAIL_USERNAME` / `MAIL_PASSWORD` / `MAIL_FROM` | yes | | |
| `APP_FRONTEND_BASE_URL` | yes | `https://portal.example.com` | Used in reset-password links |
| `CORS_ALLOWED_ORIGINS` | yes | `https://portal.example.com` | |
| `SESSION_IDLE_TIMEOUT_MINUTES` | no | `30` | |
| `DB_POOL_SIZE` | no | `30` | Keep pool × instances below PostgreSQL `max_connections` |
| `LOG_DIR` | no | `logs` | Where `oneintellectt.log` and `security.log` go |
| `SHOW_SQL` | no | `false` | Debug only |

Generate keys:
```bash
python -c "import secrets;print(secrets.token_urlsafe(64))"                 # APP_JWT_SECRET
python -c "import os,base64;print(base64.b64encode(os.urandom(32)).decode())" # APP_CRYPTO_KEY
```

As an alternative to environment variables, put the same settings (Spring property
names) in a `secrets.properties` file in the working directory, readable only by the
service account. See the development copy in the backend folder.

### 4.3 Run as a service (Linux, systemd)

```ini
# /etc/systemd/system/oneintellectt.service
[Unit]
Description=One Intellectt backend
After=network.target

[Service]
User=oneintellectt
WorkingDirectory=/opt/oneintellectt
EnvironmentFile=/etc/oneintellectt/env        # the variables above, chmod 600
ExecStart=/usr/bin/java -Xms512m -Xmx1g -jar /opt/oneintellectt/OneIntellectt.war --server.address=127.0.0.1
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

On Windows, use a service wrapper (e.g. WinSW or NSSM) with the same command and variables.

## 5. Frontend

```bash
cd onboarding-portal
npm ci
# Same origin as the API → leave the base URL empty so calls go to /api on this host
VITE_USE_MOCKS=false VITE_API_BASE_URL= npm run build      # → dist/
```

Copy `dist/` to the web root, e.g. `/var/www/oneintellectt`. The build adds a
Content-Security-Policy `<meta>` tag automatically.

## 6. nginx

```nginx
server {
    listen 80;
    server_name portal.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name portal.example.com;

    ssl_certificate     /etc/letsencrypt/live/portal.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "frame-ancestors 'none'" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;

    client_max_body_size 1m;

    root /var/www/oneintellectt;

    # React routes: unknown paths serve index.html
    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

`X-Forwarded-For` is required: sign-in lock-outs are counted per client IP. The backend
uses it as configured by `server.forward-headers-strategy` (currently `framework`, which believes the header from any caller, so the
proxy must overwrite it; with `native` it is trusted only from private/local addresses, and if nginx then runs on a public IP also set
`server.tomcat.remoteip.internal-proxies`).

## 7. After the first start

1. Sign in as the Super Admin and **change the password** (menu under your name → Change password).
2. Create teams, then users. Each new user gets a temporary password and must choose their own at first sign-in.
3. Send a test password-reset email to confirm SMTP works.
4. Check `logs/security.log` shows your sign-in.

## 8. Operations

| Task | How |
|---|---|
| Backups | Nightly `pg_dump -Fc "Intellectt"`, encrypted, kept off-server. Include the `*_aud` tables (they're in the same DB). Test a restore regularly. Back up `APP_CRYPTO_KEY` separately from the data |
| Logs | `logs/oneintellectt.log` (30 days), `logs/security.log` (365 days); rotated daily. Review or forward to a SIEM; alert on `LOGIN_BLOCKED` / `ACCESS_DENIED` bursts |
| Updates | Build, stop the service, replace the WAR, start. Schema additions apply automatically. Read DATA_MODEL.md §5 for changes that need SQL |
| Access reviews | Quarterly: Users page → deactivate leavers and accounts with an old "Last sign-in" |
| Scaling | Add a second backend instance behind nginx (`upstream`); sessions are in the DB. Move the rate-limit counters to shared storage first |
| Health check | `GET /api/auth/me` without a token returns 401 when the app is up |

## 9. Go-live checklist

- [ ] HTTPS only; HTTP redirects; certificate auto-renews
- [ ] New `APP_JWT_SECRET` and `APP_CRYPTO_KEY` generated for production; crypto key backed up
- [ ] Dedicated DB user; port 5432 and 5000 not reachable from the internet
- [ ] Transactional email provider with SPF/DKIM; `MAIL_FROM` on your domain
- [ ] nginx passes `X-Forwarded-For`
- [ ] `app.entity-mail.mailbox-routing=true` and `app.entity-mail.super-admin-address` blank (the testing switches are in the normal position)
- [ ] The frontend host serves `index.html` for every path (nginx `try_files`; Netlify / Cloudflare `_redirects`; Vercel `vercel.json`; Render Static Site: add a Rewrite rule `/*` → `/index.html`), so email links to `/login` never show "page not found"
- [ ] Backups scheduled and a restore tested
- [ ] SQL migrations from `docs/` applied, in order, on the production database (after a backup): `sales-manager-migration.sql`, `payroll-accounts-migration.sql`, `project-end-migration.sql`, `rate-change-migration.sql`, `candidate-edit-migration.sql`, `project-end-approval-migration.sql`, `dropout-doj-migration.sql` (this one adds columns: the app validates the schema and will not start without them)
- [ ] Super Admin password changed; MFA plan agreed (not built yet)
- [ ] `./mvnw test` green and `npm audit` clean on the release build
- [ ] Organisational items in [COMPLIANCE.md](../COMPLIANCE.md) §3 assigned an owner
