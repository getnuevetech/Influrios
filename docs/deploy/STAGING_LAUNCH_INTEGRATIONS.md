# Staging launch integrations (Phase M)

**Purpose:** prove Spec §33 mail, billing, and social paths on a **staging** host with real sandbox credentials.  
**Does not claim green by itself.** Operators fill the evidence tables after each check. CI cannot mark Phase M complete.

Related: [AWS_LIGHTSAIL.md](./AWS_LIGHTSAIL.md) · [FRESH_SERVER_SETUP.md](./FRESH_SERVER_SETUP.md) · product switches in Admin → Marketplace / Billing.

---

## 0. Before you start

| Item | Notes |
|------|--------|
| Staging host with HTTPS | `NEXT_PUBLIC_APP_URL=https://staging.example.com` |
| Compose stack healthy | Homepage + admin login work |
| Operator mailbox | For SMTP invite / verify |
| Stripe **sandbox** account | `sk_test_` / `rkcs_test_` only — never `sk_live_` on staging |
| One social app (YouTube **or** Instagram) | Redirect URI must match the callback below |

Local helper (prints URLs + required env; does **not** call providers):

```bash
npx tsx scripts/staging-checklist.ts
# or: npm run staging:checklist
```

Remote probe (hits a live staging URL; fills auto-checkable rows only):

```bash
STAGING_URL=https://influrios.com npm run staging:evidence-probe
# or: node scripts/staging-evidence-probe.mjs https://influrios.com
```

The probe verifies `/api/health`, homepage sections, guest `/collaboration` CTAs, and admin login reachability. It **never** marks SMTP / Stripe / social / marketplace green — those stay operator evidence below.

Marketplace signed curl bodies (needs a funding id + provider webhook secret):

```bash
npx tsx scripts/marketplace-webhook-fixture.ts --fundingId=... --secret=... --amountCents=5000 --event=funding.held
npx tsx scripts/marketplace-webhook-fixture.ts --fundingId=... --secret=... --amountCents=5000 --event=payout.released
```

---

## 1. Staging environment checklist

Fill once per staging environment. A probe on 2026-10-12 of `https://influrios.com` passed HTTPS, `/api/health` with the database up, `secrets.authConfigured` true (`AUTH_SECRET` or `ADMIN_SESSION_SECRET` is set), the homepage, guest `/collaboration`, and the admin login. That probe does not check the boxes below.

| Check | Value / evidence |
|-------|------------------|
| Date | 2026-10-13 |
| Operator | host recovery + Phase M probe |
| `NEXT_PUBLIC_APP_URL` (https) | `https://influrios.com` |
| DNS A/AAAA → host | ☑ (site resolves) |
| `AUTH_SECRET` set | ☑ `secrets.authConfigured: true` |
| `ADMIN_SESSION_SECRET` set | ☐ (or covered by AUTH_SECRET) |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` stable across deploys | ☐ confirm in host `.env` |
| `ADMIN_SUPER_EMAIL` / `ADMIN_SUPER_PASSWORD` known | ☐ |
| `DATABASE_URL` / Compose Postgres healthy | ☑ health `db.ok` · host tools use `127.0.0.1` |
| TLS cert valid (browser) | ☑ HTTPS probe pass |

### Webhook & callback URLs

Replace `APP` with `NEXT_PUBLIC_APP_URL` (no trailing slash).

| Integration | URL |
|-------------|-----|
| Stripe billing webhook | `{APP}/api/billing/webhook` |
| Marketplace provider webhook | `{APP}/api/marketplace/webhook` |
| Social OAuth callback | `{APP}/api/social/callback` |

Register these in Stripe CLI/Dashboard, the marketplace provider admin, and the social app console **before** running §3–§6.

---

## 2. SMTP (invite + verify + job retry)

**Goal:** mail leaves the host; failures show in `/admin/jobs` and can be retried.

1. Admin → **Mail**: save host, port, from, credentials; enable.  
   Or set `SMTP_HOST`, `SMTP_FROM`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` in `.env` and restart web.
2. Send a **test invite** (Admin → Invitations or Mail test).
3. Complete an account / claim verify that enqueues `verification_email` or `claim_verification_email`.
4. Confirm the message arrives in the operator inbox.
5. Force a failure (bad password). Jobs **auto-requeue up to 3 attempts** (~60s apart). Wait until status is **`failed`** (not `queued`), then fix credentials and click **Retry** on Admin → Jobs (operator recovery after terminal failure — that is the E2 drill, separate from auto-retry).

| Evidence | Result |
|----------|--------|
| Date / operator | 2026-10-13 · host + cloud-agent |
| Test invite message-id or screenshot | `mail_test` `cmv6wje8100a3o6018frdtn0r` · `250 2.0.0 OK … gsmtp` |
| Verify email received | ☑ yes (`claim_verification_email` `cmv6evovt005jod0130bnxspo`) |
| Failed job visible then retried | ☑ yes (same id after Admin Retry) |
| Notes | Auto-retry (3×) + Admin Retry both exercised |

---

## 3. Stripe sandbox (checkout → webhook → plan)

**Goal:** a sandbox Checkout marks the member plan only after Stripe confirms; a duplicate event does not change the plan again.

1. Save a **sandbox** secret on Admin → Gateways (or `STRIPE_SECRET_KEY=sk_test_...`).  
   If `/api/billing/webhook` returns **501** *“could not be read”*, the stored ciphertext does not match the current `AUTH_SECRET` — paste the secret again and Save (do not only toggle Enabled).
2. Set webhook secret on the Stripe gateway row (or `STRIPE_WEBHOOK_SECRET`) and register `{APP}/api/billing/webhook` in Stripe Dashboard / CLI.
3. Optional Price IDs in Admin → Billing or env (`STRIPE_PRICE_*`).
4. Sign in as a member → `/billing` or `/pricing` → pay with Stripe test card `4242…`.
5. Confirm success page and `User.planTier` / `SubscriptionState` / `CheckoutAttempt` updated.
6. Redeploy the same `checkout.session.completed` event (Stripe CLI resend or Dashboard). Plan must **not** double-upgrade (`ProcessedWebhook` unique).

| Evidence | Result |
|----------|--------|
| Date / operator | 2026-10-13 · host + cloud-agent (script `2026-10-14T01:05:23Z`) |
| Stripe session id (`cs_test_…`) | `cs_test_a1FGJzvUkZPLgdKGXAqcZtqCuocAW00MJB8H3V8YafY21uzlTtl6VZ4GaA` |
| Local `CheckoutAttempt` id | `cs_mv6jqy02_g3n8vb` |
| Plan after first delivery | `creator_plus` · SubscriptionState `cmv6jrmgh0008rg01pc3qajh8` |
| Duplicate delivery skipped | ☑ yes (`staging:e4-stripe-duplicate` · unique blocked · 1 row · planTier `PLUS` unchanged) |
| Notes | Webhook row `cmv6jrmg50006rg01egkiiaip` · event `checkout:cs_mv6jqy02_g3n8vb` |

`demo_checkout` and `legacy_demo_payments` are removed. Checkout stays closed until a Stripe sandbox key is saved. Leave `customer_portal` and `stripe_connect` off unless those paths are the ones under test.

| Evidence | Result |
|----------|--------|
| Checkout without Stripe refused | ☐ |
| Checkout with sandbox still works | ☐ |
| Billing portal host `billing.stripe.com` | |
| Connect `acct_` on the payout profile | |

---

## 4. One social OAuth

**Goal:** consent → callback → store followers/likes **only when both metrics are present**.

1. Admin → Social: enable **one** network (prefer YouTube or Instagram).
2. Register `{APP}/api/social/callback` as the provider **OAuth redirect URI** (Meta: Facebook Login → Valid OAuth Redirect URIs — not Webhooks).
3. From a creator dashboard / connect flow, complete consent.
4. Confirm callback lands on the app without error.
5. Confirm metrics: if either followers or likes is missing, the sync must **not** invent numbers.

| Evidence | Result |
|----------|--------|
| Date / operator | 2026-10-14 · host + cloud-agent (script `2026-10-14T10:03:39Z`) |
| Network | ☑ YouTube ☐ Instagram ☐ other: |
| Consent completed | ☑ |
| Callback OK | ☑ redirect URI `https://influrios.com/api/social/callback` · readiness HTTP 307 |
| Both metrics present → stored | ☑ SocialConnection `cmv7wsjww001qs2015kbcssy4` · SocialAccount `cmv6f0ebj0065od017gutjrq5` · `@argboboy20` · followers `6` · likes/views `2531` · `PROVIDER_SYNCED` |
| Missing metric → no write | ☑ Facebook prior error (no invent) · gate: 1 complete / 0 partial |
| Host script | `npm run staging:e3-social-evidence` |
| Notes | YouTube channel viewCount stored as the second metric (API has no channel likes) |

---

## 5. Marketplace hold → release (one jurisdiction)

**Goal:** one enabled jurisdiction + provider webhook moves a funding through hold → release.

1. Confirm a jurisdiction (e.g. US) and payment provider row with webhook secret in Admin → Gateways / Marketplace.
2. Create or reuse a collaboration funding in a holdable state.
3. POST signed `funding.held` then `payout.released` (use `scripts/marketplace-webhook-fixture.ts` for body + `x-influrios-signature`).
4. Confirm ledger movements and funding status; replay the same event id → no double release.

| Evidence | Result |
|----------|--------|
| Date / operator | |
| Jurisdiction / provider | |
| Funding id | |
| Held | ☐ |
| Released | ☐ |
| Duplicate skipped | ☐ |
| Notes | |

---

## 6. Production switch policy (after staging is green)

Copy these defaults to production unless product explicitly overrides:

| Switch | Production default |
|--------|--------------------|
| `demo_checkout` | removed. Checkout stays closed without a sandbox key |
| `customer_portal` | off |
| `stripe_connect` | off |
| `legacy_demo_payments` | removed |
| `agency_seats` | off until multi-seat is intentional |
| `financial_reports` | on (ops) |

Live Stripe keys (`sk_live_`) only after staging evidence above is filled and reviewed.

---

## 7. Phase M exit sign-off

Phase M is **complete** only when every cell below has a real evidence id. A blank cell is not done. The probe does not fill these cells. SMS is not an evidence cell. Twilio is not the provider, and nothing is sent.

Probe of `https://influrios.com` on 2026-10-12: seven automatic checks passed and none failed. HTTPS, `/api/health` with the database up, `secrets.authConfigured` true, the homepage, guest `/collaboration`, and the admin login passed. SMS is not sent. SMTP, Stripe, social, Meilisearch, Airwallex, recurring, team proposals, DocuSign, Flutterwave or M-Pesa, and paid mentorship were not exercised. Those evidence ids stay blank.

Probe of `https://influrios.com` on 2026-10-13 (Phase M kickoff after #251/#252): initially **blocked** by nginx **502 Bad Gateway**. Host recovered (`curl -fsS http://127.0.0.1:3000/api/health` → `ok` / `authConfigured: true`). Re-probe at **2026-10-13T10:22:39Z**: **7/7 auto checks pass** (HTTPS, health+db, authConfigured, homepage, guest `/collaboration`, admin login, SMS not sent). Cron without `CRON_SECRET` correctly returns **401**.

**E4 Stripe (same day):**
1. API secret was unreadable (**501**) → operator re-saved `sk_test_…` on Payment gateways.
2. Re-check without a Stripe signature now returns **400** `Missing webhook signature or secret` (or, after deploy of clearer errors, `Missing Stripe-Signature header` once `whsec_…` is saved). That means the **API secret decrypts**; checkout can open.
3. Still required before plan apply evidence: save **Webhook secret** (`whsec_…`) on the Stripe gateway row (or `STRIPE_WEBHOOK_SECRET`), register `https://influrios.com/api/billing/webhook` in Stripe Dashboard (checkout.session.completed), then member checkout with card `4242`.

```bash
# After API secret is saved — expect 400, not 501:
curl -sS -X POST https://influrios.com/api/billing/webhook \
  -H 'content-type: application/json' -d '{}'
```

Host-side Prisma tools should use `DATABASE_URL` with host `127.0.0.1` (not the Compose service name). Prefer `npx prisma migrate deploy` over `db push` on the live host after recovery.

### Phase M continuation (2026-10-13T11:37Z) — host outage again

Re-probe of `https://influrios.com` at **2026-10-13T11:37:41Z** after UX PRs #257–#260: **blocked by nginx 502 Bad Gateway** again. Auto checks cannot progress past E0 while upstream is down. The evidence probe now reports a single outage reason instead of mis-labeling `authConfigured` / guest CTAs as feature failures.

**Host recovery (run on Lightsail):**

```bash
cd /var/www/influrios
bash deploy/scripts/diagnose-502.sh
git pull origin main
bash deploy/scripts/deploy.sh
curl -fsS http://127.0.0.1:3000/api/health
node scripts/staging-evidence-probe.mjs https://influrios.com
```

**Next operator evidence after recovery (E1 → E2 → E4 → E3 → E5):**

| Slice | Action | Done when |
|-------|--------|-----------|
| **E1 Sweep clock** | ~~Done~~ tick `2026-10-13T15:36:12Z` · `cmv6ufj5m000dut01g2jvu0xh` / `cmv6ufj61000lut013qd0vrgz` · crontab installed · `CRON_SECRET` rotated | Next: finish **E5** |
| **E2 SMTP** | ~~Done~~ `mail_test` `cmv6wje8100a3o6018frdtn0r` (failed → Admin Retry → `250 … gsmtp`) · `claim_verification_email` `cmv6evovt005jod0130bnxspo` | Next: finish **E5** |
| **E4 Stripe** | ~~Done~~ `cs_mv6jqy02_g3n8vb` / `cs_test_a1FGJzv…` · `creator_plus`/`PLUS` · duplicate unique blocked `checkout:cs_mv6jqy02_g3n8vb` | Next: finish **E5** |
| **E3 Social OAuth** | ~~Done~~ YouTube `cmv7wsjww001qs2015kbcssy4` · account `cmv6f0ebj0065od017gutjrq5` · `@argboboy20` · 6 / 2531 · `PROVIDER_SYNCED` | Next: finish **E5** |
| **E5 Meilisearch** | Health 200 · Reindex succeeded · postgres count ≈ index documents · Discover search OK | counts + job id |

**Recovered:** probes green through **2026-10-13T16:16:25Z** (8/8 auto). E1 + E2 + E3 + E4 complete. **Next: E5 Meilisearch.** **`CRON_SECRET` rotated** (operator confirmed).

### E1 progress (2026-10-13 afternoon) — **complete**

Tick at **2026-10-13T15:36:12Z**: `POST /api/cron/sweeps` → `{"ok":true,"enqueued":{"queued":10},"processed":{"processed":10}}`. Crontab installed (`*/5` → `deploy/scripts/sweep-cron.sh`).

| Check | Result |
|-------|--------|
| Probe auto: cron rejects missing secret | ☑ `401` / `unauthorized` |
| Admin → Jobs shows succeeded sweep **job ids** | ☑ |
| Host script to print E1 ids | ☑ `npm run staging:e1-sweep-evidence` |
| Crontab installed | ☑ `crontab -l \| grep sweep-cron` |
| Succeeded `milestone_auto_approval` id | ☑ `cmv6ufj5m000dut01g2jvu0xh` · 2026-10-13T15:36:12Z |
| Succeeded `recurring_cycle_sweep` id | ☑ `cmv6ufj61000lut013qd0vrgz` · 2026-10-13T15:36:12Z |

**`CRON_SECRET` rotated** (operator confirmed 2026-10-13) — `.env` + crontab refreshed after the E1 paste.

### E2 progress (SMTP) — **complete**

Host script `2026-10-13T16:39:59Z`. Operator confirmed the job **failed**, then they clicked Admin → Jobs **Retry** themselves. Admin Retry reuses the **same** job row (`retryFailedJob` resets attempts on that id), so after success the script no longer shows `status=failed` — the evidence id is the succeeded row.

| Kind | Job id | Status | SMTP / external | Updated |
|------|--------|--------|-----------------|---------|
| `claim_verification_email` | `cmv6evovt005jod0130bnxspo` | succeeded | — (pre–accept-line storage) | 2026-10-13T08:20:53Z |
| `mail_test` (Admin Retry) | `cmv6wje8100a3o6018frdtn0r` | succeeded | `250 2.0.0 OK … gsmtp` | 2026-10-13T16:39:31Z |
| `mail_test` (prior test) | `cmv6w73c40084o601nhpaegey` | succeeded | `250 2.0.0 OK … gsmtp` | 2026-10-13T16:26:31Z |

| Check | Result |
|-------|--------|
| Admin → Mail shows Ready | ☑ |
| Test invite accepted (job id + SMTP line) | ☑ `cmv6wje8100a3o6018frdtn0r` · `250 2.0.0 OK 1791909571 6a1803df08f44-91b97b35e23sm29545326d6.17 - gsmtp` |
| Verify email received in operator inbox | ☑ |
| `verification_email` / `claim_verification_email` succeeded | ☑ `claim_verification_email`=`cmv6evovt005jod0130bnxspo` |
| Failed job then **Admin Retry** → succeeded | ☑ same id `cmv6wje8100a3o6018frdtn0r` (operator: failed → manual Retry → `250 … gsmtp`) |

**Retry model:** auto-requeue up to 3 attempts; Admin **Retry** is operator recovery after terminal `failed` (same job id). E2 proved both paths.

```bash
cd /var/www/influrios
npm run staging:e2-smtp-evidence
```

### E4 progress (Stripe sandbox) — **complete**

Host scripts `2026-10-14T01:05:23Z` (checkout) and `2026-10-14T01:30:38Z` (duplicate proof). Success-page confirm used local event id `checkout:cs_mv6jqy02_g3n8vb` (not a Stripe Dashboard `evt_…`); duplicate skip proven via unique `ProcessedWebhook` key.

| Check | Result |
|-------|--------|
| API secret decrypts | ☑ |
| Webhook secret saved | ☑ `POST /api/billing/webhook` without signature → `Missing Stripe-Signature header.` |
| Sandbox checkout `4242` + plan apply | ☑ Attempt `cs_mv6jqy02_g3n8vb` · `cs_test_a1FGJzvUkZPLgdKGXAqcZtqCuocAW00MJB8H3V8YafY21uzlTtl6VZ4GaA` · sku `creator_plus` · user `cmv6f0eb40061od01b8jvjlpk` · `2026-10-13T10:37:42Z` · webhook `checkout:cs_mv6jqy02_g3n8vb` → `active` · SubscriptionState `cmv6jrmgh0008rg01pc3qajh8` · `planTier=PLUS` |
| Duplicate `checkout.session.completed` skipped | ☑ `staging:e4-stripe-duplicate` · unique violation on `(stripe, checkout:cs_mv6jqy02_g3n8vb)` · 1 webhook row · `planTier` stayed `PLUS` |
| Portal / Connect | ☐ optional (Connect onboarding fixed in #262; not required to close E4) |

```bash
cd /var/www/influrios
npm run staging:e4-stripe-evidence
npm run staging:e4-stripe-duplicate
```

### E3 progress (Social OAuth) — **complete**

Host script `2026-10-14T10:03:39Z`. YouTube consent → callback → `PROVIDER_SYNCED` with both metrics. Facebook earlier proved missing metrics do not invent a write.

| Check | Result |
|-------|--------|
| Admin → Social: one network Ready | ☑ YouTube (also FB/IG ready; E3 used YouTube) |
| Redirect URI `{APP}/api/social/callback` registered | ☑ `https://influrios.com/api/social/callback` |
| Creator consent + OAuth completed | ☑ SocialConnection `cmv7wsjww001qs2015kbcssy4` · status `connected` · consented `2026-10-14T10:02:39Z` |
| Callback lands on `/dashboard` without error | ☑ readiness HTTP 307 · connected sync `2026-10-14T10:03:04Z` |
| Both metrics → `PROVIDER_SYNCED` SocialAccount | ☑ `cmv6f0ebj0065od017gutjrq5` · `@argboboy20` · followers `6` · likes/views `2531` |
| Missing metric → no invent / no partial PROVIDER_SYNCED | ☑ gate 1 complete / 0 partial · FB row stayed `error` without inventing counts |

```bash
cd /var/www/influrios
npm run staging:e3-social-evidence
```

**Instagram / Meta note:** put `https://influrios.com/api/social/callback` under **Facebook Login → Valid OAuth Redirect URIs** (or Instagram product OAuth settings). Do **not** use Meta **Webhooks** for this URL — that screen expects a `hub.challenge` verifier; our callback is OAuth-only (`code`/`state`) and will fail webhook validation.

### E5 progress (Meilisearch counts) — **in progress**

**Goal:** Meilisearch healthy · creator index rebuilt · Discover search uses the index · postgres count ≈ index documents.

| Check | Result |
|-------|--------|
| `meilisearch` container running | ☐ |
| `GET /health` → 200 | ☐ |
| Admin → Meilisearch host/key Ready (or `MEILI_HOST` in `.env`) | ☐ |
| Reindex succeeded (`reindex_creators` job id) | ☐ |
| Index documents ≈ Postgres public creators | ☐ |
| `/discover?q=…` returns creators | ☐ |

```bash
cd /var/www/influrios
npm run staging:e5-meilisearch-evidence
```

Operator path:
1. `docker compose ps meilisearch` → running (Compose service on `127.0.0.1:7700`).
2. Web container uses Compose DNS `http://meilisearch:7700` (host `.env` may show `127.0.0.1:7700` for scripts only). Confirm `MEILI_API_KEY` matches.
3. Admin → **Meilisearch** → **Reindex** → wait for succeeded (prior `Search index 405` was a create-index path bug; fixed on this branch).
4. Browser: open `/discover?q=creator` (or a known specialty) and confirm cards.
5. Host: `npm run staging:e5-meilisearch-evidence` — paste health, postgres count, index count, reindex job id.

| Area | Evidence id | Date | Operator |
|------|-------------|------|----------|
| Env, HTTPS, auth secret, cron | probe 8/8 · cron 401 · E1 tick `2026-10-13T15:36:12Z` · `milestone_auto_approval`=`cmv6ufj5m000dut01g2jvu0xh` · `recurring_cycle_sweep`=`cmv6ufj61000lut013qd0vrgz` · crontab installed | 2026-10-13 | host + cloud-agent |
| SMTP | `mail_test`=`cmv6wje8100a3o6018frdtn0r` (failed→Admin Retry→`250 … gsmtp`) · `claim_verification_email`=`cmv6evovt005jod0130bnxspo` · prior `cmv6w73c40084o601nhpaegey` | 2026-10-13 | host + cloud-agent |
| Stripe checkout, duplicate skip, portal, Connect | Attempt `cs_mv6jqy02_g3n8vb` · `cs_test_a1FGJzv…` · `creator_plus`/`PLUS` · webhook `checkout:cs_mv6jqy02_g3n8vb` · duplicate unique blocked (`2026-10-14T01:30:38Z`) | 2026-10-13/14 | host + cloud-agent |
| Social OAuth | YouTube Connection `cmv7wsjww001qs2015kbcssy4` · Account `cmv6f0ebj0065od017gutjrq5` · `@argboboy20` · 6 / 2531 · `PROVIDER_SYNCED` (`2026-10-14T10:03:39Z`) | 2026-10-14 | host + cloud-agent |
| Meilisearch counts | **in progress** — run `staging:e5-meilisearch-evidence` after Reindex | | host + cloud-agent |
| Airwallex hold and release | | | |
| Recurring tranche 2 | | | |
| Team proposal | | | |
| DocuSign completed | | | |
| Flutterwave or M-Pesa | | | |
| Intro fee + paid mentorship | | | |

**Sign-off:** ______________________ date __________
