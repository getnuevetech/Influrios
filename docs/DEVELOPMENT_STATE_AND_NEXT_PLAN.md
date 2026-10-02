# Influrios — Development State Review & Next Implementation Plan

**Date:** 2026-10-02  
**Repo reviewed:** `main` @ `49153de`  
**Sources:** codebase, `docs/IMPLEMENTATION_PLAN.md`, `docs/RECOMMENDATIONS_AND_EXECUTION_PLAN.md`, CI, Prisma schema, deploy scripts  
**Sequencing authority for new work:** this document (supersedes the “first coding slice” close of `IMPLEMENTATION_PLAN.md` for post–Phase-12 work)

---

## 1. Verdict

Influrios is past the branded-demo stage and into a **hybrid production platform**: Postgres-backed configuration, directory, accounts, collaborations, providers, short links, and a marketplace ledger sit beside a handful of intentional JSON demo stores and seed-array fallbacks.

| Dimension | State |
|---|---|
| Product surface | Wide: Home, Discover, profiles, cards, claim, dashboard, collaboration, business, agency, billing, payments/trust, legal, large admin |
| Data durability | Strong for Phases A–I + 12.3–12.13 (88 Prisma models, versioned migrations) |
| Dual architecture | Still real for ops/demo JSON (`cms`, billing, payments, trust, intelligence); claim + admin RBAC + directory are Postgres |
| Spec MVP (section 33) | Structurally met (unit gate + CI); not yet proven with live SMTP, Stripe, and social credentials |
| Ops / deploy | Docker Compose on Lightsail is the intended path; docs still mix older PM2 language |
| Next risk | Building more Phase 12 depth before retiring dual stores and hard-wiring launch integrations |

**Bottom line:** stop extending the transaction engine. Harden the path that creators and ops actually use: single source of truth for profiles, claim → account → Discover, live mail/billing/social, and quarantine or remove the Phase 9/10 JSON consoles.

---

## 2. What the product is

**Influrios** — Influence Discovery & Collaboration Platform  
Positioning: *Find the right influence. Build the right collaboration.*

Four engines (from strategy v2.2):

1. **Influence Discovery** — specialty / geo / platform search  
2. **Creator Collaboration Network** — complementary matching + proposals  
3. **Influencer Card** — portable identity (tier-aware QR / shortlink)  
4. **Business Matching + Managed Promotion** — briefs, shortlists, intros  

Brand in production UI must remain **Influrios** only (`check:brand` in CI).

---

## 3. Tech stack (current)

| Layer | Choice |
|---|---|
| App | Next.js 15 App Router, React 19, TypeScript, Tailwind 4 |
| DB | PostgreSQL 16 + Prisma 6 (migrate deploy on boot / CI) |
| Hosting | AWS Lightsail → Nginx → Docker Compose (`postgres` + `web` on `127.0.0.1:3000`) |
| Auth | Custom HMAC cookies: admin (`admin-auth`), end-user (`accounts`), creator claim session (`claim`) — not Auth.js/Clerk |
| Payments | Stripe adapter + sandbox rules; marketplace webhooks; Wise FX quotes; M-Pesa gateway shell |
| QR / short links | `inflr.me` resolver, opaque QR tokens, analytics events |
| Tests | 29 `tsx --test` unit files; GitHub Actions CI (lint, brand ban, migrate, test, migration drift) |
| Feature control | `FeatureFlag` / product switches + plan entitlements in Postgres |

---

## 4. Development maturity by domain

### 4.1 Done and durable (Postgres)

These modules read/write Prisma and match the implementation plan’s “Implemented” claims:

| Domain | Evidence |
|---|---|
| Entitlements | `entitlements-db.ts`, plan feature rows, admin `/admin/plans` |
| Directory / taxonomy / CMS sections & menus | `directory.ts` + `CmsSection` / `Specialty` / menus |
| Accounts + guest gates | `accounts.ts`, `guest-usage.ts`, `/register`, `/login`, `/admin/guests` |
| Invitations | `invitations.ts`, `/admin/invitations`, `/invite/[token]` |
| Collaborations | `collaborations.ts`, records + admin |
| Business briefs / managed queue | `business.ts`, `managed-matching.ts`, `/business`, `/admin/matching` |
| Providers (Stripe/AI/SMTP/jobs) | `providers.ts`, `mail.ts`, `jobs.ts`, `/admin/mail|ai|jobs|gateways` |
| Social OAuth path | `social-sync.ts`, `social-connect.ts`, `/admin/social`, callback route |
| Short links / legal | `short-link.ts`, `legal.ts` |
| Marketplace ledger 12.3–12.13 | `marketplace-ledger.ts`, disputes, FX, Wise, revisions, evidence, caps, partial refunds, change orders |
| Agency roster | `agency.ts` persists workspace via Prisma (still seeded with demo agency id) |
| Product switches | `product-switches.ts` (demo checkout, portal, Connect, reports, seats) |

### 4.2 Dual / transitional (JSON + Postgres)

| Store | Path | Role today |
|---|---|---|
| ~~Claim funnel~~ | ~~`data/claim-funnel.json`~~ | **Retired in Phase K.** `OnboardingSession` + Creator via `claim.ts` / `claim-persist.ts` are authoritative. |
| CMS banners / value prop content | `data/cms.json` via `cms.ts` | Banner uploads + strip copy; homepage *order* is Postgres sections |
| Billing sessions | `data/billing.json` via `billing.ts` | Demo checkout history; plan apply also hits Prisma `User` / subscription state |
| Fee matrix simulator | `data/collaboration-fees.json` | Admin fee rules UI (ledger fee snapshot is separate / immutable on funding) |
| Phase 9 protected payments | `data/protected-payments.json` | Explicit demo console (`/admin/payments`, parts of `/payments`) |
| Phase 10 trust | `data/trust.json` | Explicit demo queue (`/admin/trust`, “Earlier demo queue” on `/trust`) |
| Intelligence | `data/intelligence.json` | Trends / export still file-backed; uses `SEED_CREATORS` |
| Admin RBAC | Postgres `AdminUser` / `AdminRole` | HMAC cookie unchanged; one-time import from `admin-auth.json` then rename to `.migrated` |

Docker Compose mounts `influrios_data` → `/app/data` so rebuilds do not wipe these, but they are **not** first-class migrations.

### 4.3 Seed-array residual use

`SEED_CREATORS` remains for **cold-start seed** and empty-DB fallback in `directory.ts`. Product matching, collaboration, business fit, agency/payments pickers, and intelligence were rewired in Phase J to directory helpers. Do not add new product reads against the seed array.

### 4.4 Integrations: code ready, credentials optional

| Integration | Code | Live until… |
|---|---|---|
| Stripe Checkout / webhook | Ready; sandbox keys refused for live gateway row | Real `sk_live` / Price IDs + webhook endpoint |
| Stripe Customer Portal / Connect | Behind product switches (default **off**) | Switch on + secrets |
| SMTP | Admin mail settings + job enqueue | Host/from/secret saved and enabled |
| Social networks | Official OAuth hosts only; consent versioned | Client id/secret per network in admin |
| Wise FX | Quote adapter | Token + profile + enabled host |
| Marketplace provider | Webhook-signed ledger | Provider enabled + webhook secret |
| M-Pesa / e-sign | Shells | Must not report success without provider confirm |

### 4.5 Tests & CI

- **Strength:** CI on every PR; migration drift check; brand ban; broad unit coverage of ledger/entitlement/state machines; `mvp-gate` encodes Spec §33 structurally.
- **Gap:** Almost no HTTP/integration tests, no Playwright smoke of claim → Discover, no webhook contract tests against Stripe fixtures, MVP gate does not assert live DB wiring for CMS/search.

### 4.6 Deploy docs drift

- README correctly says **Docker Compose**, not PM2 for the app.
- `docs/deploy/AWS_LIGHTSAIL.md` still describes Nginx → PM2 → Next.js in places.
- Prefer aligning deploy docs to Compose + volume mounts before the next server rebuild.

---

## 5. Recommendations (priority order)

### R1 — Freeze Phase 12 feature expansion

Do not add staged-funding variants, extra providers, or new ledger product surface until dual stores and launch integrations are clean. Spec section 31 already deferred contracts/e-sign; the addendum’s deferred items (advanced change orders beyond 12.13, multi-provider complexity) stay deferred.

### R2 — Single source of truth for creators

1. Treat Postgres `Creator` as the only directory/match input.  
2. Keep `SEED_CREATORS` as **seed/fixture** only (`prisma/seed.ts`, tests).  
3. Rewire `matching.ts`, collaboration hero, business ranking, agency pickers, intelligence to query directory helpers.  
4. Remove Discover fallbacks that silently reintroduce seed-only behavior after a healthy migrate+seed.

### R3 — Finish claim dual-write retirement

1. ~~Make `OnboardingSession` / `ProfileClaim` / publish path authoritative; stop requiring `claim-funnel.json` for publish.~~ **Done (Phase K).**  
2. Link published claim to `User` (already partially present in accounts) and drop long-lived demo creator cookie as the ownership proof.  
3. Keep DEMO_CODE verify only when mail is not ready; once SMTP is ready, email challenge is the default path.

### R4 — Migrate remaining JSON ops stores (or quarantine)

| Action | Target |
|---|---|
| Move | Admin RBAC → Postgres (`AdminUser` / `AdminRole` models or equivalent) |
| Move | CMS banner/value-prop payloads into `CmsSection` content JSON or dedicated tables |
| Move or drop | Billing session log → Prisma (or Stripe Dashboard only) |
| Quarantine | Phase 9/10 JSON consoles: hide behind admin flag `legacy_demo_payments` default **off** in production; point all product CTAs at marketplace ledger |
| Move later | Intelligence store + fee simulator (after directory purification) |

### R5 — Launch-integration sprint (credentials + honesty)

Ship a short ops checklist, not more UI:

1. `AUTH_SECRET` / `ADMIN_SESSION_SECRET` / encryption key stable across deploys (already partially handled).  
2. SMTP test send for invite + verify templates.  
3. Stripe sandbox end-to-end on staging; live keys only when portal/Connect switches are intentional.  
4. One social network (Instagram or YouTube) fully configured; others stay disabled.  
5. Marketplace provider webhook secret + one jurisdiction row for the launch country.  
6. Confirm demo checkout switch policy for production (recommend **off** when Stripe is ready).

### R6 — Production hygiene

- TLS / domain on Lightsail (HTTPS).  
- Automated Postgres backups (Lightsail snapshot or `pg_dump` cron).  
- Align `AWS_LIGHTSAIL.md` with Compose.  
- Health endpoint beyond homepage curl (DB ping).  
- Rate-limit claim, register, and admin login.  
- Ensure public profile DTO never leaks email / admin notes (spot-check claim publish + API exports).

### R7 — Test the loops that matter

Add a thin integration suite (Node test or Playwright) for:

1. Seed creator visible on Discover after migrate+seed  
2. Claim → verify → publish → appears on Discover  
3. Guest soft/hard gate  
4. Stripe webhook idempotency with fixture payloads  
5. Marketplace `funding.held` → release path with signed fixture  

Keep unit tests for ledger math; do not replace them.

### R8 — Docs cleanup

- Mark §3 gap matrix in `IMPLEMENTATION_PLAN.md` as **historical (pre A–I)**.  
- Point README “current plan” at this document for sequencing.  
- Leave strategy / addendum docs as product law; do not duplicate fee rules here.

---

## 6. Implementation plan (next phases)

Phases below are **vertical slices**. Each leaves current screens working. Prefer small PRs (repo habit already established).

### Phase J — Directory purity (critical path) — DONE

**Proves:** Discover, collaboration scoring, and business fit use the same Postgres creator set.

Shipped on `main`: directory helpers, matching/collab/business/intelligence/agency/payments rewired off seed, `legacy_demo_payments` gated.

**Exit met:** removing a creator row from Postgres removes them from Discover and match lists without a code change.

### Phase K — Claim & identity consolidation — DONE

**Proves:** ownership is a User + Creator link, not a JSON draft cookie alone.

1. Publish path writes only through `claim-persist` / Prisma; `claim-funnel.json` deleted from the runtime path.  
2. After register/login, `attachClaimToUser` links the open onboarding session (`ONB-008`).  
3. Creator dashboard loads by account session → linked `OnboardingSession` / Creator slug.  
4. Verification: if `mailReady()`, enqueue SMTP challenge; else labeled demo code on the verify page.  
5. `publicClaimPayload` strips email / verifyCode / ownerName for public/audit DTOs.

**Exit met:** claim drafts survive without `data/claim-funnel.json`; published profiles and dashboard resolve from Postgres after restart.

### Phase L — Ops store migration & demo quarantine — IN PROGRESS

**Proves:** production admin survives without JSON files except uploads.

1. ~~Prisma models for admin users/roles/permissions; migrate `admin-auth.json` once; keep HMAC cookie.~~ **Done.**  
2. Fold CMS JSON fields into section payloads; keep upload volume for banners.  
3. ~~Feature flag `legacy_demo_payments` (default off): gate `/admin/payments` Phase 9 UI and trust demo forms.~~ **Done (Phase J + confirmed).**  
4. Billing: persist checkout attempts in Prisma or stop writing `billing.json` when Stripe confirms.  
5. ~~Document volume mounts: `uploads` required; `data/` optional after migration.~~ **Done for admin path.**

**Exit (partial):** fresh Compose up with empty `data/` volume boots admin via `ADMIN_SUPER_*` env. CMS/billing JSON remain until L.2 / L.4.

### Phase M — Launch integrations

**Proves:** Spec §33 items 8–10 with real providers in a staging environment.

1. Staging env checklist (secrets, DNS, webhook URLs).  
2. SMTP: invite + verify delivered; jobs retry visible.  
3. Stripe sandbox: Checkout → webhook → `User.planTier` / entitlement snapshot; duplicate webhook skipped.  
4. One social OAuth: consent → callback → followers/likes only when both present.  
5. Turn `demo_checkout` off on staging once Stripe path is green.  
6. Marketplace: one jurisdiction + provider webhook fixture through hold → release.

**Exit:** written runbook in `docs/deploy/` with “green” evidence; production switches match policy.

### Phase N — Hardening & observability

**Proves:** Lightsail instance can be rebuilt from docs alone.

1. Rewrite Lightsail guide to Compose-only; remove PM2 app path.  
2. HTTPS (Let’s Encrypt) + `NEXT_PUBLIC_APP_URL` https.  
3. Backup script + restore drill.  
4. `/api/health` (web + DB).  
5. Basic rate limits / lockout on auth endpoints.  
6. Optional: Sentry or structured logs — only if ops asks.

**Exit:** new Lightsail host reaches healthy homepage + admin login using only `FRESH_SERVER_SETUP` + `.env`.

### Phase O — Product polish (only after J–M)

Pick from product backlog once loops are honest:

- Meilisearch when Discover latency/filter load hurts  
- Customer Portal / Connect when paid volume exists  
- Intelligence persistence  
- Fee simulator → versioned Prisma rules (if still JSON)  
- Agency multi-seat auth when `agency_seats` turns on  
- E-sign / formal contracts (still non-goal until counsel + volume)

---

## 7. Suggested next coding slice

Phases J–K and L.1/L.3/L.5 (admin RBAC) are on `main` (or this PR). Next:

1. **Phase L.2** — fold CMS JSON into `CmsSection` payloads; keep uploads volume.  
2. **Phase L.4** — stop writing billing session JSON once Stripe confirms, or persist attempts in Prisma.  
3. Do **not** start another marketplace capability in the same window.

---

## 8. Out of scope / do not build next

- Another JSON demo module  
- Marking M-Pesa, Connect payouts, or signatures complete without provider confirmation  
- Redis / Meilisearch / separate AI microservice  
- Universal influencer score  
- Scraping  
- Revival of “Influence Connect” branding  
- Raster cards as the live Influencer Card  

---

## 9. Success metrics (instrument what you harden)

| Loop | Metric |
|---|---|
| Supply | Published claims / week; completeness distribution |
| Discovery | search → profile view |
| Card | `/c/{slug}` views; QR scans (Plus/Pro) |
| Collab | proposal sent → accepted |
| Revenue | Checkout completed (Stripe-confirmed only) |
| Ops | Failed jobs open; webhook duplicates skipped; SMTP test OK |

---

## 10. Appendix — quick inventory

**Public / app routes:** `/`, `/discover`, `/categories`, `/creators/[slug]`, `/c/[slug]`, `/card`, `/claim/*`, `/dashboard`, `/collaboration/*`, `/business/*`, `/agency`, `/billing`, `/payments`, `/trust`, `/pricing`, `/register`, `/login`, `/account/*`, `/invite/[token]`, `/legal/*`, `/q/[token]`

**Admin:** access, accounts, agency, ai, banners, billing, cards, collaborations, fees, gateways, guests, homepage, intelligence, invitations, jobs, legal, mail, marketplace, matching, payments, plans, short-links, signing, social, stats, taxonomy, trust, value-prop

**API:** billing webhook, marketplace webhook, social callback, short resolve, QR, places, intelligence export

**Prisma:** 88 models; migrations through admin switches / change orders (Oct 2026)

**JSON under `data/`:** `cms`, `billing`, `collaboration-fees`, `protected-payments`, `trust`, `intelligence` (claim-funnel + admin-auth retired)
