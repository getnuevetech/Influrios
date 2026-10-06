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
STAGING_URL=https://staging.example.com npm run staging:evidence-probe
# or: npx tsx scripts/staging-evidence-probe.ts http://STATIC_IP
```

The probe verifies `/api/health`, homepage sections, guest `/collaboration` CTAs, and admin login reachability. It **never** marks SMTP / Stripe / social / marketplace green — those stay operator evidence below.

Marketplace signed curl bodies (needs a funding id + provider webhook secret):

```bash
npx tsx scripts/marketplace-webhook-fixture.ts --fundingId=... --secret=... --amountCents=5000 --event=funding.held
npx tsx scripts/marketplace-webhook-fixture.ts --fundingId=... --secret=... --amountCents=5000 --event=payout.released
```

---

## 1. Staging environment checklist

Fill once per staging environment.

| Check | Value / evidence |
|-------|------------------|
| Date | |
| Operator | |
| `NEXT_PUBLIC_APP_URL` (https) | |
| DNS A/AAAA → host | ☐ |
| `AUTH_SECRET` set | ☐ |
| `ADMIN_SESSION_SECRET` set | ☐ |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` stable across deploys | ☐ |
| `ADMIN_SUPER_EMAIL` / `ADMIN_SUPER_PASSWORD` known | ☐ |
| `DATABASE_URL` / Compose Postgres healthy | ☐ |
| TLS cert valid (browser) | ☐ |

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
2. Set `STRIPE_WEBHOOK_SECRET` (CLI `stripe listen --forward-to …/api/billing/webhook` or Dashboard endpoint).
3. Optional Price IDs in Admin → Billing or env (`STRIPE_PRICE_*`).
4. Sign in as a member → `/billing` → pay with Stripe test card `4242…`.
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

### Turn off demo checkout (after Stripe is green)

On staging Admin → Billing / Marketplace product switches:

- Set **`demo_checkout` → off**.
- Leave **`customer_portal`**, **`stripe_connect`**, **`legacy_demo_payments`** **off** unless deliberately testing those paths.

| Evidence | Result |
|----------|--------|
| `demo_checkout` off | ☐ |
| Checkout without Stripe refused | ☐ |
| Checkout with sandbox still works | ☐ |

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
| `demo_checkout` | **off** once Stripe sandbox path is green on staging |
| `customer_portal` | off |
| `stripe_connect` | off |
| `legacy_demo_payments` | off |
| `agency_seats` | off until multi-seat is intentional |
| `financial_reports` | on (ops) |

Live Stripe keys (`sk_live_`) only after staging evidence above is filled and reviewed.

---

## 7. Phase M exit sign-off

Phase M is **complete** only when this table is filled with real staging evidence (not CI alone).

| Area | Green? | Date | Operator |
|------|--------|------|----------|
| Env + HTTPS + webhooks registered | ☐ | | |
| SMTP invite + verify + job retry | ☐ | | |
| Stripe sandbox + duplicate skip + `demo_checkout` off | ☐ | | |
| One social OAuth + metric gate | ☐ | | |
| Marketplace hold → release | ☐ | | |

**Sign-off:** ______________________ date __________
