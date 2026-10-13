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
5. Force a failure (bad password), confirm a **failed** job appears, fix credentials, **Retry** from Admin → Jobs.

| Evidence | Result |
|----------|--------|
| Date / operator | |
| Test invite message-id or screenshot | |
| Verify email received | ☐ yes ☐ no |
| Failed job visible then retried | ☐ yes ☐ no |
| Notes | |

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
| Date / operator | |
| Stripe session id (`cs_test_…`) | |
| Local `CheckoutAttempt` id | |
| Plan after first delivery | |
| Duplicate delivery skipped | ☐ yes ☐ no |
| Notes | |

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
2. Register `{APP}/api/social/callback` on the provider app.
3. From a creator dashboard / connect flow, complete consent.
4. Confirm callback lands on the app without error.
5. Confirm metrics: if either followers or likes is missing, the sync must **not** invent numbers.

| Evidence | Result |
|----------|--------|
| Date / operator | |
| Network | ☐ YouTube ☐ Instagram ☐ other: |
| Consent completed | ☐ |
| Callback OK | ☐ |
| Both metrics present → stored | ☐ / N/A |
| Missing metric → no write | ☐ / N/A |
| Notes | |

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

**Next operator evidence after recovery (E1 → E2 → E4):**

| Slice | Action | Done when |
|-------|--------|-----------|
| **E1 Sweep clock** | ~~Done~~ tick `2026-10-13T15:36:12Z` · `cmv6ufj5m000dut01g2jvu0xh` / `cmv6ufj61000lut013qd0vrgz` · crontab installed | Next: **E2 SMTP** |
| **E2 SMTP** | Admin → Mail: save host/from/secret, send test invite, complete a claim verify, break password → failed job → Retry | Job id + SMTP accept line + failed→succeeded retry |
| **E4 Stripe** | Save `whsec_…` on gateway (or `STRIPE_WEBHOOK_SECRET`), register webhook, member checkout with `4242`, resend same event | `cs_test_…`, `CheckoutAttempt` id, plan tier, duplicate skipped |

**Recovered:** probes green through **2026-10-13T15:42:14Z** (8/8 auto). E1 complete. Rotate `CRON_SECRET` if it was pasted into a transcript.

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

**Rotate `CRON_SECRET` after this evidence** (it was pasted into an operator transcript), then update `.env`, redeploy, and refresh the crontab line.

### E2 progress (SMTP)

| Check | Result |
|-------|--------|
| Admin → Mail shows Ready | ☐ |
| Test invite accepted (job id + SMTP line) | ☐ |
| Verify email received in operator inbox | ☐ |
| `verification_email` / `claim_verification_email` succeeded | ☐ |
| Failed job then Retry → succeeded | ☐ |

```bash
# After deploy of this slice + SMTP test sends:
cd /var/www/influrios
npm run staging:e2-smtp-evidence
```

Operator path:

1. Open `https://influrios.com/admin/mail` — save host/port/from/credentials, enable, confirm **Ready**.
2. Send **Test SMTP (claim invitation)** to your mailbox. Wait for Recent test sends → `succeeded` + SMTP accept line (and job id).
3. Complete an account or claim verify so `verification_email` or `claim_verification_email` succeeds.
4. Intentionally break the SMTP password, send again → failed job on `/admin/jobs` → restore password → **Retry** → succeeded.
5. `npm run staging:e2-smtp-evidence` and paste ids into the evidence table below.

### E4 Stripe progress (same day)

| Check | Result |
|-------|--------|
| API secret decrypts | ☑ earlier (no longer 501 unreadable) |
| Webhook secret saved | ☑ `POST /api/billing/webhook` without signature → `Missing Stripe-Signature header.` |
| Sandbox checkout `4242` + plan apply | ☐ |
| Duplicate `checkout.session.completed` skipped | ☐ |
| Portal / Connect | ☐ (Connect onboarding fixed in #262) |

| Area | Evidence id | Date | Operator |
|------|-------------|------|----------|
| Env, HTTPS, auth secret, cron | probe 8/8 · cron 401 · E1 tick `2026-10-13T15:36:12Z` · `milestone_auto_approval`=`cmv6ufj5m000dut01g2jvu0xh` · `recurring_cycle_sweep`=`cmv6ufj61000lut013qd0vrgz` · crontab installed | 2026-10-13 | host + cloud-agent |
| SMTP | | | |
| Stripe checkout, duplicate skip, portal, Connect | whsec present (`Missing Stripe-Signature header`). Run 4242 checkout + duplicate skip | 2026-10-13 | |
| Social OAuth | | | |
| Meilisearch counts | | | |
| Airwallex hold and release | | | |
| Recurring tranche 2 | | | |
| Team proposal | | | |
| DocuSign completed | | | |
| Flutterwave or M-Pesa | | | |
| Intro fee + paid mentorship | | | |

**Sign-off:** ______________________ date __________
