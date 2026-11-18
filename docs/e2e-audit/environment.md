# Environment record — Influrios E2E audit

**runId:** `AUDIT_20261118170047`  
**Timezone:** UTC  
**Started (preflight):** 2026-11-18T17:00:47.472Z  
**Agent:** `bc-301bac77-2030-5804-b3d4-61d3aad72097`  
**Task:** IPS-10

## Repository / build

| Field | Value |
|-------|--------|
| Repository | `github.com/getnuevetech/Influrios` |
| Audit branch (harness/docs) | `cursor/e2e-audit-pack-2097` |
| Local checkout SHA | `e98cea9d75cc0d02fc449d45d028ecd9be8b62e8` (merge of PR #532) |
| **Deployed SHA** (`/api/health` → `revision`) | `ada9c7f5d90d4d61e78627da2765cbe14004cbc4` (merge of PR #530) |
| Base URL | `https://influrios.com` |
| Alias | `https://www.influrios.com` |
| Health | `ok` · db `ok` · `secrets.authConfigured=true` |
| Migration/schema version | Not exposed via public API — **unrecorded** |
| Regression comparison | **Unverified build vs local HEAD** — deployed is an ancestor of HEAD but not identical; do not claim PR #532/#533 are fully deployed |

## Feature / provider modes (no secret values)

| Integration | Mode observed | Supported ops (from UI copy) | Test alias | Callback reachability | Ready? |
|-------------|---------------|------------------------------|------------|----------------------|--------|
| Stripe billing | **Sandbox** (Admin → Billing activity: “Stripe · Sandbox”) | Checkout / portal (portal On) | AUDIT business + influencer billing accounts | Webhook URL mounted: `/api/billing/webhook` | **Partial** — sandbox labeled; live checkout not exercised pending isolation |
| Marketplace / Airwallex | Providers section lists Stripe + Airwallex | Hold/release per staging runbook | — | `/api/marketplace/webhook` mounted | **Unverified** for this run — no sandbox payout exercised |
| Signing | **In-app signing primary**; DocuSign optional | Type-name + drawn signature on contract page | — | `/api/signing/webhook` mounted | **App-level** path available; DocuSign not proven |
| SMTP / notifications | SMTP **Ready (admin)** | Templates + jobs; SMS explicitly not sent | AUDIT_* domains only (not a dedicated sink) | Jobs UI present | **Blocked** — no mail-sink interception proof yet |
| SMS | Not sent (Twilio not provider) | — | — | — | N/A |

## Isolation status

| Check | Result |
|-------|--------|
| Dedicated staging hostname | **No** — production-looking `influrios.com` |
| `AUDIT_ISOLATION_CONFIRMED=1` | **Absent** |
| Customer-data isolation proven | **Not proven** this run |
| Test-provider routing | Stripe UI shows Sandbox; no live key strings observed in admin excerpts |
| Notification allowlist / sink | **Not configured** (`MAIL_SINK_TO` unset) |
| AUDIT account domains (pattern only) | influencer `gmail.com` · business `kwiktech.net` · admin `influrios.com` |

**Policy this run:** Mutations that create invitations, billing charges, withdrawals, deletions of shared data, or outbound customer-visible notices are **stopped** until isolation + sink are confirmed. Independent read-only / visual / permission-denial work continues.

## Auth secrets present (names only)

`AUDIT_INFLUENCER_EMAIL/PASSWORD`, `AUDIT_BUSINESS_EMAIL/PASSWORD`, `AUDIT_ADMIN_EMAIL/PASSWORD`. Agency secrets present but **deferred**. No credentials written to pack artifacts.

## Security preflight

| Check | Result |
|-------|--------|
| Default admin credential exposure on `/admin/login` | **P0 — concrete email still rendered** beside default-password hint (values not recorded; exposed password **not** attempted against live admin) |
| Isolated auth regression | Pending local unit/source check in pack issues |

## Reference baselines (not assumed deployed)

- PR #532 — historical visual audit evidence  
- PR #533 — draft centered-popup design spec  
- Prior pack: `docs/staging-visual-audit/` (method replaced by this brief)

## Executable vs blocked (preflight checkpoint)

| Area | Executable now? |
|------|-----------------|
| Public + role login smoke | Yes |
| Route/action inventory + visual popup geometry | Yes (read-only) |
| Permission denial / cross-account deep links | Yes (read-only assertions) |
| In-app UI navigation of existing AUDIT fixtures | Yes (no new invites/payments) |
| Signup verify / password reset email | **Blocked** (mail sink) |
| Invite / withdrawal notices | **Blocked** (mail sink + isolation) |
| Sandbox checkout / payout | **Blocked** until isolation confirmed (Stripe sandbox labeled) |
| Request create/delete/withdraw mutations | **Blocked** (isolation) |
| Agency journeys | Deferred (Not applicable) |
| Payment Standard v2 | Paused — audit implemented behavior only |

Raw probe: [preflight-raw.json](./preflight-raw.json) · Media: `/cursor/stores/self/media/e2e-audit/preflight/`
