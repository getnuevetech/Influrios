# Influrios — Engineering Review & Implementation Plan

**Date:** 2026-10-06  
**Baseline:** `main` at `1d54987` (after #141)  
**Scope:** independent read of the running app, Prisma schema, auth, jobs, tenancy, CI, and deploy. Feature-status logs in `FULL_IMPLEMENTATION_PLAN.md` and `DEVELOPMENT_STATE_AND_NEXT_PLAN.md` stay the record of shipped product phases. This document is the next-work plan.

---

## 1. Verdict

Influrios is a real Postgres product: discovery, claim, Influencer Card, collaboration hubs, and a marketplace ledger are implemented and covered by a large unit suite. The feature plans correctly stop new ledger surface area.

The launch risk is no longer missing screens. It is that several money and entitlement paths still depend on an admin click, a seeded demo workspace, or a process-local secret. Fix those before Phase M evidence, and before any new product mode (recurring funding, Airwallex, team proposals, Meilisearch).

| Dimension | State |
|---|---|
| Product surface | Wide and wired: 76 pages, 10 API routes, 110 Prisma models |
| Money engine | Ledger, fees, disputes, and sweeps exist as functions and admin buttons |
| Job execution | `processDueJobs` runs only when some request already touches the queue. Nothing in deploy cron-schedules sweeps |
| Entitlements | Owned business workspaces exist. Several live routes still read the seeded `demo-business` workspace, which is created as Business Pro |
| Auth | Three HMAC cookie systems, Postgres admin RBAC, in-memory lockout |
| CI | Lint, brand ban, migrate, unit tests, migration drift. No `tsc` and no `next build` |
| Docker image | `DOCKER_BUILD=1` skips ESLint and TypeScript errors so a 768 MB Lightsail build can finish |

---

## 2. What is solid

- Directory, claim publish, CMS, billing attempts, fee rules, and admin RBAC are Postgres-backed. JSON demos for payments and trust stay behind `legacy_demo_payments` (default off) and are purged when that switch is off.
- Admin pages call `requireAdminPage`, `requireAdminSession`, or `getAdminSession`. Middleware only checks that an admin cookie exists; the Node guards check the HMAC session. That split is sound.
- Marketplace webhooks, fee snapshots, and funding state machines have unit tests. CI applies migrations against Postgres 16 and checks migration drift.
- Brand ban, health check (`/api/health` pings the database), Compose deploy, and backup/restore scripts are in place.
- Business hub mutations that pass `account.id` into `getWorkspace` use an owned workspace (`ensureOwnedBusinessWorkspace`). Keep that pattern; do not add new call sites that omit the user id.

---

## 3. Findings (priority order)

### F1 — Money sweeps run only when an admin clicks

`enqueueAutoApprovalSweep`, review-deadline, dispute SLA, provider hold warning, failed payout retry, funding reconciliation, and scheduled release are called from `src/app/admin/marketplace/actions.ts`. Marketplace application expiry is called from `src/app/admin/collaboration-ops/actions.ts`.

`processDueJobs` in `src/lib/jobs.ts` drains at most 8 queued rows, and only after another enqueue or retry. `deploy/` has no cron. A quiet instance will not auto-approve milestones, retry payouts, or expire applications.

**Impact:** protected-payment deadlines and reconciliation are manual. The job kinds are implemented; the clock is not.

### F2 — Entitlement checks use the demo Business Pro workspace

`getWorkspace()` with no user id returns `demo-business`, and `seedDemoWorkspace` creates that row as `BUSINESS_PRO`.

Call sites that omit the signed-in user:

| Surface | File | Effect |
|---|---|---|
| Intelligence page | `src/app/business/intelligence/page.tsx` | `locked` is false for every visitor, because the demo plan includes intelligence |
| Intelligence export | `src/app/api/intelligence/export/route.ts` | Any signed-in account passes the Business Pro / Agency export gate |
| Public billing page | `src/app/billing/page.tsx` | Plan chrome is the demo workspace, not the viewer’s plan |
| Agency access | `src/lib/agency-auth.ts` | Plan-mode access is evaluated against the demo workspace |

Hub actions under `src/app/collaboration/business/actions.ts` and `src/app/business/actions.ts` already pass `account.id`. The leak is the older read paths.

### F3 — Production can boot with a known signing secret

`src/lib/admin-auth.ts`, `src/lib/accounts.ts`, and `src/lib/provider-secrets.ts` fall back to hardcoded strings when `AUTH_SECRET` / `ADMIN_SESSION_SECRET` are unset. Provider secrets (Stripe, SMTP, social) are AES-GCM encrypted with that key. A missing env var in production makes sessions forgeable and stored provider secrets decryptable by anyone who has the repo.

### F4 — Image optimizer accepts every HTTPS host

`next.config.ts` sets `images.remotePatterns` to `hostname: "**"`. The Next image optimizer will fetch arbitrary URLs. That is an open proxy and an SSRF path from the web container.

### F5 — CI does not typecheck or build

GitHub Actions runs ESLint (`next/typescript`, which is not a full `tsc` pass), tests, and migrations. The Docker build sets `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`. A type error can ship in the Lightsail image.

### F6 — Lockout and verification codes are process-local and plaintext

`src/lib/auth-lockout.ts` keeps failures in a `Map`. A restart or a second web replica clears it. Verification codes are stored on `EmailChallenge.demoCode` and copied into `Job.payload` for `verification_email` and `claim_verification_email`. The job row keeps the code after send.

Acceptable on one Compose container for a demo. Insufficient once the instance is on the public internet with real mail.

### F7 — Module size will slow the next money change

Largest units: `marketplace-ledger.ts` (1,793), `collaboration/page.tsx` (1,048), `admin-auth.ts` (995), `claim.ts` (947), `jobs.ts` (920), `short-link.ts` (904), `collaboration-fees.ts` (891), `dashboard/page.tsx` (864). Behavior is tested. The cost is that the scheduler and tenancy fixes should be thin wrappers, not rewrites of these files.

### F8 — Launch evidence is still external

Phase M (SMTP, Stripe sandbox, one social OAuth, marketplace webhook) is a runbook plus probe. CI does not prove it. Airwallex stays a checklist until someone signs it. Those stay operator work. They are not a reason to skip F1–F5.

---

## 4. Recommendations

1. **Schedule the sweeps.** One authenticated tick that enqueues each sweep kind if none is already queued, then calls `processDueJobs`. Wire it to cron on the Lightsail host (or a Compose `cron` service). Do not add a second job framework.
2. **Bind every entitlement read to the viewer.** Intelligence, export, billing, and agency plan-mode must use `getWorkspace(account.id)` or the account’s `planTier`. Logged-out intelligence stays locked. The demo workspace remains a marketing seed only.
3. **Fail closed on secrets.** In production, refuse to sign sessions or encrypt provider secrets when `AUTH_SECRET` is missing. Keep the dev fallback only when `NODE_ENV !== "production"`.
4. **Close the image proxy.** Allow only hosts the product actually uses (own uploads are local). Drop `hostname: "**"`.
5. **Add `tsc --noEmit` to CI.** It is cheaper than a full `next build` and covers the hole left by `ignoreBuildErrors`.
6. **Leave feature scope frozen** until F1–F5 are in and Phase M has one signed staging pass. Recurring funding, Airwallex, team proposals, Meilisearch, e-sign, and SKU renames stay deferred.
7. **Split god files only when a change already touches them.** Extract the scheduler from `jobs.ts` and the entitlement read from `business.ts`. Do not schedule a rewrite of the ledger.

---

## 5. Implementation plan

Each slice leaves current screens working. Land them as separate PRs in this order.

### Slice A — Entitlement identity

**Proves:** a Starter account cannot see Business Pro intelligence or export it, and `/billing` reflects that account.

1. `GET /api/intelligence/export` calls `getWorkspace(account.id)` and checks that workspace’s plan.
2. `/business/intelligence` requires a session for unlocked data; logged-out visitors see the locked state.
3. `/billing` loads the signed-in user’s owned workspace when a session exists, and a public catalog (no demo plan badge) when it does not.
4. `resolveAgencyAccess` uses `getWorkspace(account.id)` for plan-mode. Seat-mode stays on the seat’s workspace id.
5. Tests: export returns 403 for a Starter user; demo workspace id is absent from that response path.

**Exit:** grep of app and API routes shows no `getWorkspace()` without a user id except the explicit logged-out marketing seed.

### Slice B — Sweep clock

**Proves:** auto-approval, dispute SLA, payout retry, reconciliation, scheduled release, and application expiry run with no admin click and no other user traffic.

1. Add `enqueueDueSweeps()` in `src/lib/jobs.ts` that inserts one queued row per sweep kind when that kind has no `queued` or `running` row.
2. Add `POST /api/cron/sweeps` (or a `node` script invoked by host cron) protected by `CRON_SECRET`. It calls `enqueueDueSweeps()` then `processDueJobs`.
3. Document the crontab line in `docs/deploy/FRESH_SERVER_SETUP.md` (every 5 minutes is enough for the current deadlines).
4. Test: with no prior admin action, one tick queues each kind once; a second tick does not duplicate a still-queued kind; `processDueJobs` moves a due row to succeeded.

**Exit:** a staging box with cron and an empty admin session log still shows succeeded sweep jobs.

### Slice C — Secret and image fail-closed

**Proves:** production cannot sign cookies or encrypt provider secrets with the repo’s fallback string, and the image optimizer cannot fetch arbitrary hosts.

1. `sessionSecret()` / account `secret()` / `secretKey()` throw in production when `AUTH_SECRET` is unset. Dev fallback stays for local and tests.
2. `/api/health` stays free of secret values. Startup log line states whether the secret is configured (boolean only).
3. Replace `images.remotePatterns` `**` with an explicit allow-list. Local uploads do not need a remote pattern.
4. After a successful mail job, clear the code from `Job.payload` (keep delivery status).

**Exit:** production boot without `AUTH_SECRET` fails the secret helper; a unit test covers the production branch; `next.config.ts` has no `**` host.

### Slice D — Typecheck in CI

**Proves:** a TypeScript error fails the pull request even though the Docker build ignores build errors.

1. CI step: `npx tsc --noEmit` after `npm ci` (Prisma client is already generated by `postinstall`).
2. Leave Docker `ignoreBuildErrors` in place so the small Lightsail builder does not OOM. CI is the gate.

**Exit:** CI workflow contains `tsc --noEmit` and is green on `main`.

### Slice E — Phase M evidence (operator, after A–D)

Use the existing runbook `docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md`.

1. Stable `AUTH_SECRET` and `CRON_SECRET` on the instance (Slice C and B).
2. SMTP test send for invite and verify.
3. Stripe sandbox checkout, webhook, plan tier update, duplicate webhook skipped.
4. One social network OAuth.
5. One marketplace webhook fixture through hold and release, with sweep cron running.
6. `demo_checkout` off once Stripe is green. `legacy_demo_payments` stays off.

**Exit:** the evidence tables in that runbook are filled. CI alone does not finish this slice.

### Explicitly later

- Durable rate limits (Postgres or Redis) if a second web replica is added. In-memory lockout is enough for one container after Slice C.
- Playwright against staging once Slice E has a URL. The HTTP smoke catalog can stay opt-in until then.
- Structured error reporting (Sentry or equivalent) only if operators want it. Job `lastError` plus the admin jobs page is the current signal, and it becomes useful once Slice B runs.
- File splits inside `marketplace-ledger.ts` and `jobs.ts` on the next behavior change, not as a standalone project.
- Recurring ambassador funding, Airwallex adapter, multi-creator team proposals, INFLR.me Phase 4, paid mentorship, Meilisearch, e-sign, Stripe Connect hard-enable.

---

## 6. Suggested first PR

Slice A. It is a small, testable authorization fix on routes users can already open. Slice B is the next PR and is the one that makes the ledger’s deadlines real.
