#!/usr/bin/env python3
"""
Load test for the One Intellectt API — simulates many people using the portal at once.

  python load_test.py seed --base http://localhost:5001        # one-time: create 1000 accounts + candidates
  python load_test.py run  --base http://localhost:5001 --users 1000 --ramp 60 --duration 180

ALWAYS point it at a throwaway database (e.g. run the backend with
--spring.datasource.url=jdbc:postgresql://localhost:5432/intellectt_load) and with mail
disabled (--spring.mail.host=localhost --spring.mail.port=1): it creates ~1000 users and
thousands of candidates, and every change is permanently written to the audit log.

Needs: Python 3.9+ and aiohttp (pip install aiohttp).
"""
import argparse
import asyncio
import json
import os
import random
import statistics
import sys
import time
from collections import defaultdict

import aiohttp

PASSWORD = "Load@1234"
TEMP_PASSWORD = "Temp@1234"  # what the admin sets; each account then changes it to PASSWORD
SA_EMAIL, SA_PASSWORD = "admin@intellectt.com", "Admin@123"
ACCOUNTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "accounts.json")
ENTITIES = ["novozen", "revereit", "premierlifesciences", "unitedpharmatechnologies", "kennedysoft",
            "shoolin-inc", "lumininc", "lumin-innovation", "kkrconsulting", "ubitz"]

# 1000 accounts: 50 teams x (1 Sales Lead + 15 recruiters) = 800, plus org-wide roles + the Super Admin
TEAMS, RECRUITERS_PER_TEAM = 50, 15
ORG_ROLES = {"HR": 50, "CONTRACTS": 50, "PAYROLL": 40, "ACCOUNTS": 40, "ADMIN": 19}
CANDIDATES_PER_RECRUITER = 2


# --------------------------------------------------------------------------- stats

class Stats:
    """Latency (ms) and outcome per named request."""

    def __init__(self):
        self.ms = defaultdict(list)
        self.ok = defaultdict(int)
        self.conflict = defaultdict(int)   # expected business 4xx (e.g. someone else approved first)
        self.fail = defaultdict(int)       # 5xx, timeouts, 401/403, connection errors
        self.fail_kinds = defaultdict(lambda: defaultdict(int))
        self.bytes = defaultdict(list)

    def record(self, name, ms, status, size, conflict_ok):
        self.ms[name].append(ms)
        if isinstance(status, int) and 200 <= status < 300:
            self.ok[name] += 1
            self.bytes[name].append(size)
        elif conflict_ok and status in (400, 409):
            self.conflict[name] += 1
        else:
            self.fail[name] += 1
            self.fail_kinds[name][str(status)] += 1


def pct(values, p):
    if not values:
        return 0.0
    s = sorted(values)
    k = max(0, min(len(s) - 1, int(round(p / 100.0 * len(s) + 0.5)) - 1))
    return s[k]


async def call(http, stats, name, method, url, token=None, body=None, conflict_ok=False, parse=False):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    t0 = time.perf_counter()
    status, data, size = None, None, 0
    try:
        async with http.request(method, url, headers=headers, json=body) as r:
            raw = await r.read()
            status, size = r.status, len(raw)
            if parse and raw and 200 <= status < 300:
                data = json.loads(raw)
    except asyncio.TimeoutError:
        status = "TIMEOUT"
    except Exception as e:  # connection refused/reset, etc.
        status = "EXC:" + type(e).__name__
    if stats is not None:
        stats.record(name, (time.perf_counter() - t0) * 1000, status, size, conflict_ok)
    return status, data


async def login(http, base, stats, email, password):
    status, data = await call(http, stats, "POST /auth/login", "POST", f"{base}/api/auth/login",
                              body={"email": email, "password": password}, parse=True)
    if status != 200:
        raise RuntimeError(f"login failed for {email}: {status}")
    return data["token"]


def new_http(timeout_s=60):
    # limit=0: no client-side cap on connections, so the SERVER is what we measure
    return aiohttp.ClientSession(connector=aiohttp.TCPConnector(limit=0, force_close=False),
                                 timeout=aiohttp.ClientTimeout(total=timeout_s))


async def bounded(n, coros):
    sem = asyncio.Semaphore(n)

    async def one(c):
        async with sem:
            return await c

    return await asyncio.gather(*(one(c) for c in coros))


def candidate_body(i):
    return {
        "candidateName": f"Load Candidate {i}-{random.randint(1000, 9999)}",
        "candidatePersonalEmail": f"cand{i}@example.com",
        "candidateDirectNumber": "(555) 010-1234",
        "clientName": random.choice(["Northwind Health", "Contoso Pharma", "Fabrikam Labs"]),
        "jobRole": random.choice(["Java Developer", "QA Engineer", "Data Analyst"]),
        "location": "Austin, TX",
        "billRate": "85", "payRate": "60",
        "internalEntity": random.choice(ENTITIES),
        "visaStatus": "H1 Ext",
        "dojDate": "2026-12-01",
        "jobDescription": "Load-test candidate. " * 10,
    }


# --------------------------------------------------------------------------- seed

async def fetch_all(http, base, tok, query=""):
    """Every candidate this user can see, page by page (the list endpoint is paged)."""
    items, page = [], 0
    while True:
        _, data = await call(http, None, "", "GET", f"{base}/api/candidates?size=100&page={page}{query}", tok, parse=True)
        items += (data or {}).get("content", [])
        page += 1
        if not data or page >= data.get("totalPages", 0):
            return items


async def seed(args):
    base = args.base.rstrip("/")
    async with new_http() as http:
        sa = await login(http, base, None, SA_EMAIL, SA_PASSWORD)
        accounts = []

        async def create_user(role, idx, team_id=None):
            email = f"load-{role.lower().replace('_', '-')}-{idx}@load.test"
            body = {"fullName": f"Load {role.title()} {idx}", "email": email, "password": TEMP_PASSWORD, "role": role}
            if team_id:
                body["team"] = {"id": team_id}
            status, data = await call(http, None, "", "POST", f"{base}/api/users", sa, body, parse=True)
            if status != 200:
                raise RuntimeError(f"create {email} failed: {status}")
            # New accounts must replace the admin-set password at first sign-in, like a real user
            tok = await login(http, base, None, email, TEMP_PASSWORD)
            status, _ = await call(http, None, "", "POST", f"{base}/api/auth/change-password", tok,
                                   {"currentPassword": TEMP_PASSWORD, "newPassword": PASSWORD})
            if status != 200:
                raise RuntimeError(f"password change for {email} failed: {status}")
            accounts.append({"email": email, "password": PASSWORD, "role": role, "id": data["id"], "teamId": team_id})

        print("Creating teams ...", flush=True)
        team_ids = []
        for t in range(TEAMS):
            status, data = await call(http, None, "", "POST", f"{base}/api/teams", sa,
                                      {"name": f"Load Team {t + 1}"}, parse=True)
            if status != 200:
                raise RuntimeError(f"create team failed: {status}")
            team_ids.append(data["id"])

        print("Creating 999 users (Sales Leads first, so each becomes its team's lead) ...", flush=True)
        await bounded(16, [create_user("SALES_LEAD", t + 1, tid) for t, tid in enumerate(team_ids)])
        jobs, n = [], 0
        for tid in team_ids:
            for _ in range(RECRUITERS_PER_TEAM):
                n += 1
                jobs.append(create_user("RECRUITER", n, tid))
        for role, count in ORG_ROLES.items():
            jobs += [create_user(role, i + 1) for i in range(count)]
        await bounded(16, jobs)
        accounts.append({"email": SA_EMAIL, "password": SA_PASSWORD, "role": "SUPER_ADMIN", "id": 1, "teamId": None})
        print(f"  {len(accounts)} accounts", flush=True)

        print(f"Submitting {CANDIDATES_PER_RECRUITER} candidates per recruiter ...", flush=True)
        counter = iter(range(1, 10 ** 6))

        async def recruiter_submits(acct):
            tok = await login(http, base, None, acct["email"], acct["password"])
            for _ in range(CANDIDATES_PER_RECRUITER):
                await call(http, None, "", "POST", f"{base}/api/candidates", tok, candidate_body(next(counter)))

        await bounded(24, [recruiter_submits(a) for a in accounts if a["role"] == "RECRUITER"])

        print("Moving candidates through the workflow (Sales Lead ~70%, HR ~45%, Contracts ~35%) ...", flush=True)

        async def lead_approves(acct):
            tok = await login(http, base, None, acct["email"], acct["password"])
            items = await fetch_all(http, base, tok, "&status=PENDING_SALES_LEAD")
            for c in items:
                if random.random() < 0.7:
                    await call(http, None, "", "POST", f"{base}/api/candidates/{c['id']}/sales-lead/approve", tok)

        await bounded(16, [lead_approves(a) for a in accounts if a["role"] == "SALES_LEAD"])

        async def reviewer(role, share, decision_field, path):
            acct = next(a for a in accounts if a["role"] == role)
            tok = await login(http, base, None, acct["email"], acct["password"])
            items = await fetch_all(http, base, tok)
            todo = [c for c in items if c.get(decision_field) == "PENDING"
                    and c["status"] == "IN_HR_CONTRACTS_REVIEW" and random.random() < share]
            await bounded(8, [call(http, None, "", "POST", f"{base}/api/candidates/{c['id']}/{path}", tok)
                              for c in todo])

        await reviewer("HR", 0.65, "hrDecision", "hr/approve")
        await reviewer("CONTRACTS", 0.5, "contractsDecision", "contracts/approve")

        with open(ACCOUNTS_FILE, "w") as f:
            json.dump(accounts, f, indent=1)
        print(f"Seed done. Accounts saved to {ACCOUNTS_FILE}", flush=True)


# --------------------------------------------------------------------------- run

async def user_journey(http, base, stats, acct, start_delay, stop_at, think):
    await asyncio.sleep(start_delay)
    if time.monotonic() >= stop_at:
        return
    try:
        tok = await login(http, base, stats, acct["email"], acct["password"])
    except RuntimeError:
        return
    role, cache = acct["role"], []
    while time.monotonic() < stop_at:
        r = random.random()
        if role == "ADMIN":
            if r < 0.6:
                await call(http, stats, "GET /users", "GET", f"{base}/api/users", tok)
            else:
                await call(http, stats, "GET /teams", "GET", f"{base}/api/teams", tok)
        elif role == "SUPER_ADMIN":
            if r < 0.5:  # the dashboard: counters + the first page of all candidates
                await call(http, stats, "GET /candidates/summary", "GET", f"{base}/api/candidates/summary", tok)
                await call(http, stats, "GET /candidates (all, page)", "GET",
                           f"{base}/api/candidates?page=0&size=10", tok)
            else:
                await call(http, stats, "GET /audit", "GET", f"{base}/api/audit?page=0&size=20", tok)
        else:
            name = "GET /candidates (list)"
            if r < 0.10:
                await call(http, stats, "GET /auth/me", "GET", f"{base}/api/auth/me", tok)
            elif r < 0.50 or not cache:
                # Parsing a 1 MB list costs the load generator CPU; only do it when this user
                # will act on the list (or has no ids yet), so the CLIENT doesn't become the bottleneck.
                need = not cache or role in ("SALES_LEAD", "HR", "CONTRACTS")
                query = "page=0&size=10"
                if role == "SALES_LEAD" and random.random() < 0.5:
                    query += "&status=PENDING_SALES_LEAD"
                elif random.random() < 0.15:
                    query = f"page={random.randint(1, 3)}&size=10"  # sometimes go to a later page
                _, data = await call(http, stats, name, "GET", f"{base}/api/candidates?{query}", tok, parse=need)
                cache = (data or {}).get("content") or cache
            elif r < 0.80:
                c = random.choice(cache)
                await call(http, stats, "GET /candidates/{id}", "GET", f"{base}/api/candidates/{c['id']}", tok)
                await call(http, stats, "GET /candidates/{id}/trail", "GET",
                           f"{base}/api/candidates/{c['id']}/trail", tok)
            else:
                await act(http, base, stats, role, tok, cache)
        await asyncio.sleep(random.uniform(*think))


async def act(http, base, stats, role, tok, cache):
    """A write appropriate to the role (submit / approve)."""
    if role == "RECRUITER":
        await call(http, stats, "POST /candidates (submit)", "POST", f"{base}/api/candidates", tok,
                   candidate_body(random.randint(1, 10 ** 6)))
        return
    pick = None
    if role == "SALES_LEAD":
        pending = [c for c in cache if c["status"] == "PENDING_SALES_LEAD_APPROVAL"]
        path = "sales-lead/approve"
    elif role == "HR":
        pending = [c for c in cache if c.get("hrDecision") == "PENDING" and c["status"] == "IN_HR_CONTRACTS_REVIEW"]
        path = "hr/approve"
    elif role == "CONTRACTS":
        pending = [c for c in cache if c.get("contractsDecision") == "PENDING" and c["status"] == "IN_HR_CONTRACTS_REVIEW"]
        path = "contracts/approve"
    else:  # Payroll / Accounts are view-only
        return
    if pending:
        pick = random.choice(pending)
        pick["status"] = "_acted"  # don't pick it again from the cached list
        await call(http, stats, f"POST {path}", "POST", f"{base}/api/candidates/{pick['id']}/{path}", tok,
                   conflict_ok=True)


async def run(args):
    base = args.base.rstrip("/")
    with open(ACCOUNTS_FILE) as f:
        accounts = json.load(f)
    random.Random(42).shuffle(accounts)  # same order in every process
    sa = [a for a in accounts if a["role"] == "SUPER_ADMIN"]
    others = [a for a in accounts if a["role"] != "SUPER_ADMIN"]
    users = (sa + others)[: args.users]
    # --shard i --shards n: this process runs every n-th user, so processes never share an account
    users = users[args.shard::args.shards]
    stats = Stats()
    think = (args.think_min, args.think_max)
    print(f"Running {len(users)} concurrent users: ramp {args.ramp}s, then {args.duration}s steady, "
          f"think time {think[0]}-{think[1]}s ...", flush=True)
    roles = defaultdict(int)
    for u in users:
        roles[u["role"]] += 1
    print("  by role: " + ", ".join(f"{k} {v}" for k, v in sorted(roles.items())), flush=True)

    t_start = time.monotonic()
    stop_at = t_start + args.ramp + args.duration
    async with new_http(args.timeout) as http:
        tasks = [user_journey(http, base, stats, a, i * args.ramp / max(1, len(users)), stop_at, think)
                 for i, a in enumerate(users)]

        async def progress():
            while time.monotonic() < stop_at:
                await asyncio.sleep(15)
                done = sum(len(v) for v in stats.ms.values())
                fails = sum(stats.fail.values())
                print(f"  t={int(time.monotonic() - t_start):>4}s  requests={done:>7}  failures={fails}", flush=True)

        prog = asyncio.create_task(progress())
        await asyncio.gather(*tasks)
        prog.cancel()
    elapsed = time.monotonic() - t_start
    report(stats, elapsed, args, len(users))


def report(stats, elapsed, args, n_users):
    total = sum(len(v) for v in stats.ms.values())
    fails = sum(stats.fail.values())
    conflicts = sum(stats.conflict.values())
    all_ms = [m for v in stats.ms.values() for m in v]
    rows = []
    print()
    print(f"{'endpoint':<30}{'count':>8}{'fail':>6}{'confl':>7}{'p50':>8}{'p95':>8}{'p99':>8}{'max':>9}{'avg KB':>8}")
    print("-" * 92)
    for name in sorted(stats.ms, key=lambda k: -len(stats.ms[k])):
        v = stats.ms[name]
        kb = statistics.mean(stats.bytes[name]) / 1024 if stats.bytes[name] else 0
        row = {"endpoint": name, "count": len(v), "fail": stats.fail[name], "conflict": stats.conflict[name],
               "p50": pct(v, 50), "p95": pct(v, 95), "p99": pct(v, 99), "max": max(v), "avg_kb": kb,
               "fail_kinds": dict(stats.fail_kinds[name])}
        rows.append(row)
        print(f"{name:<30}{len(v):>8}{row['fail']:>6}{row['conflict']:>7}{row['p50']:>8.0f}{row['p95']:>8.0f}"
              f"{row['p99']:>8.0f}{row['max']:>9.0f}{kb:>8.1f}")
    print("-" * 92)
    print(f"{'ALL':<30}{total:>8}{fails:>6}{conflicts:>7}{pct(all_ms, 50):>8.0f}{pct(all_ms, 95):>8.0f}"
          f"{pct(all_ms, 99):>8.0f}{max(all_ms) if all_ms else 0:>9.0f}")
    print(f"\n{n_users} users, {elapsed:.0f}s, throughput {total / elapsed:.1f} req/s, "
          f"failure rate {100.0 * fails / max(1, total):.2f}%  (latencies in ms)")
    for r in rows:
        if r["fail_kinds"]:
            print(f"  failures in {r['endpoint']}: {r['fail_kinds']}")
    if args.out:
        with open(args.out, "w") as f:
            json.dump({"users": n_users, "elapsed_s": elapsed, "requests": total, "failures": fails,
                       "conflicts": conflicts, "throughput_rps": total / elapsed,
                       "p50": pct(all_ms, 50), "p95": pct(all_ms, 95), "p99": pct(all_ms, 99),
                       "endpoints": rows}, f, indent=1)
        print(f"Results saved to {args.out}")


async def probe(args):
    """One user, one request at a time: measures how fast the SERVER answers, unaffected
    by the load generator's own CPU use."""
    base = args.base.rstrip("/")
    stats = Stats()
    async with new_http(60) as http:
        tok = await login(http, base, None, args.email, args.password)
        stop = time.monotonic() + args.duration
        while time.monotonic() < stop:
            await call(http, stats, "probe GET /auth/me", "GET", f"{base}/api/auth/me", tok)
            await call(http, stats, "probe GET /candidates", "GET", f"{base}/api/candidates?page=0&size=10", tok)
            await asyncio.sleep(1)
    print(f"{'probe endpoint':<26}{'count':>7}{'fail':>6}{'p50':>8}{'p95':>8}{'p99':>8}{'max':>9}{'avg KB':>8}")
    for name, v in stats.ms.items():
        kb = statistics.mean(stats.bytes[name]) / 1024 if stats.bytes[name] else 0
        print(f"{name:<26}{len(v):>7}{stats.fail[name]:>6}{pct(v, 50):>8.0f}{pct(v, 95):>8.0f}"
              f"{pct(v, 99):>8.0f}{max(v):>9.0f}{kb:>8.1f}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("seed", help="create the 1000 test accounts and candidates")
    s.add_argument("--base", default="http://localhost:5001")
    r = sub.add_parser("run", help="run the concurrent-user test")
    r.add_argument("--base", default="http://localhost:5001")
    r.add_argument("--users", type=int, default=1000)
    r.add_argument("--ramp", type=int, default=60, help="seconds to bring all users online")
    r.add_argument("--duration", type=int, default=180, help="seconds at full load after the ramp")
    r.add_argument("--think-min", type=float, default=2.0, help="min pause between a user's actions (s)")
    r.add_argument("--think-max", type=float, default=6.0, help="max pause between a user's actions (s)")
    r.add_argument("--timeout", type=int, default=60, help="per-request timeout (s)")
    r.add_argument("--out", help="write the results as JSON to this file")
    r.add_argument("--shard", type=int, default=0, help="this process's shard (0-based)")
    r.add_argument("--shards", type=int, default=1, help="total processes sharing the users")
    pr = sub.add_parser("probe", help="independently time the server once a second during a run")
    pr.add_argument("--base", default="http://localhost:5001")
    pr.add_argument("--email", required=True)
    pr.add_argument("--password", default=PASSWORD)
    pr.add_argument("--duration", type=int, default=240)
    args = p.parse_args()
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run({"seed": seed, "run": run, "probe": probe}[args.cmd](args))


if __name__ == "__main__":
    main()
