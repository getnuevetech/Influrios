# Influrios — Implementation Plan

**Date:** 2026-10-06 (revised after admin review)  
**Baseline:** `main` at `1d54987`  
**Rule:** every slice below is finished only when its exit tests pass and the surface no longer describes itself as a demo, shell, stub, or “until later.” A switch that hides an unfinished path is not a finished feature. Operator evidence in Slice E is part of done, not a follow-up.

Feature-status history stays in `FULL_IMPLEMENTATION_PLAN.md`. This document is the work that still has to be built.

**Code on main:** A through D, F through L, and INFLR.me Phase 4. Slice L stores Twilio credentials and sends `sms_send` jobs, opens the billing portal and Connect from stored Stripe ids, charges Flutterwave and M-Pesa only after a verified webhook, runs the three remaining AI functions through the assigned provider with a rules label on failure, and checks out paid mentorship without writing collaboration holding. Phase 4 adds campaign links at `inflr.me/c/{code}`, NFC tags at `inflr.me/n/{token}`, and scheduled destinations applied by `short_link_schedule_sweep`. Still open: Slice E staging evidence, which needs a live staging host.

---

## 1. Verdict

The directory, claim, card, hubs, fee matrix, and ledger state machine are in Postgres and unit-tested. Admin still ships demo and shell consoles beside that engine, and five product areas that were left unfinished have to be built through to a working path: recurring funding cycles, the Airwallex adapter, multi-creator team proposals, Meilisearch-backed Discover, and e-sign.

---

## 2. Admin inventory

Reviewed every card on `/admin` and the pages behind them.

| Admin route | What is finished | What this plan completes |
|---|---|---|
| Access, accounts, banners, cards, taxonomy, plans, guests, legal, stats, value-prop, homepage, both landings, influencer-identity, short-links, corridors, collaboration-ops, marketplace-listings, fees, collaborations | Postgres CRUD and the guards around them | No new product scope. Slice C still removes the dev signing-secret fallback these consoles rely on. |
| Marketplace ledger | Prefund, milestones, disputes, FX, jurisdiction flags, recurring *settings* | Slice B runs the sweeps from a clock. Slice G makes recurring cycles a product. Slice K sends hold and release through Airwallex. |
| Jobs | Retry of failed rows | Slice B shows the last sweep tick and drains due rows without an admin click. |
| Payments | Phase 9 JSON demo, off unless `legacy_demo_payments` is on | Slice F deletes the demo console and the JSON store. Marketplace is the only payments admin. |
| Trust | Ledger disputes | Slice F deletes the Phase 10 demo mediation queue. |
| Billing | Checkout attempts, Stripe session creation, portal and Connect switches | Slice F deletes `demo_checkout`. Slice L stores the Stripe customer and Connect account and opens those flows from the member, not from a pasted id. |
| Gateways | Stripe credentials and country groups. Flutterwave and M-Pesa are named shells. | Slice K is Airwallex for collaboration money. Slice L makes Flutterwave and M-Pesa execute a charge and mark paid only on their webhook. |
| Signing | Credential form. Copy says the shell does not prove execution. `SignatureRequest` can sit at `queued` forever. | Slice J sends a real envelope and completes it only on the provider webhook. |
| Agency | One workspace id `agency_demo_1`. Public `/agency` still calls the portfolios “case-study stubs.” | Slice F gives each agency account its own workspace. Roster, campaigns, and joint portfolios are rows on that workspace. |
| Intelligence | Settings row in Postgres. Audience gender and age can be synthetic (`demo_seed`). Default note is “Phase 5 demo intelligence.” Export and the public page read the demo Business Pro workspace. | Slice A binds the viewer. Slice F drops synthetic demographics. Trends come from directory counts and real collaboration events only. |
| Mail | SMTP settings, templates, test send | Slice L adds an SMS provider with credentials, a send job, and delivery status. The note field goes away. |
| Invitations, social | Real queues. Delivery waits on credentials. | Slice E is the staging proof. The code must not mark an invite delivered or a social metric stored unless the provider accepted it. That rule already holds; Slice E proves it. |
| Matching | Intros, opt-in, intro-fee quote | `confirmIntroFeeSettlement` marks an intro paid from a typed provider reference. Slice K marks it paid only from a signed provider webhook. |
| AI | Four functions can be assigned to OpenAI or Anthropic. Unassigned functions use keyword or rule fallbacks. | Slice L runs all four functions through the assigned provider. Unassigned stays a labeled rules result, and the UI does not call that result AI. |

---

## 3. Slice A — Entitlement identity

**Done when** a Starter account cannot open Business Pro intelligence or the export, and `/billing` shows that account’s plan.

1. `GET /api/intelligence/export` and `/business/intelligence` call `getWorkspace(account.id)`. Logged-out visitors see the locked intelligence page.
2. `/billing` loads the signed-in user’s owned workspace. Logged-out visitors see the catalog without a plan badge.
3. `resolveAgencyAccess` uses `getWorkspace(account.id)` in plan mode.
4. Tests: Starter export returns 403; the handler never reads `demo-business`.

---

## 4. Slice B — Sweep clock

Today `processDueJobs` runs only after some other request enqueues or retries a job, and it takes at most 8 rows. These sweeps are enqueued only from admin buttons:

| Kind | Enqueued from | What a tick must do |
|---|---|---|
| `milestone_auto_approval` | Marketplace actions | Approve a submitted milestone whose frozen review window has elapsed, once. |
| `review_deadline_sweep` | Marketplace actions | Notify parties when a review deadline is inside the warning window. |
| `dispute_sla_sweep` | Marketplace actions | Notify ops when a dispute is past the SLA (default 72h). |
| `provider_hold_warn_sweep` | Marketplace actions | Notify when a hold is still unreleased inside the warning window (default 7d). |
| `failed_payout_retry_sweep` | Marketplace actions | Re-queue a failed payout under the backoff cap. Skip it if a release ledger row already exists. |
| `funding_recon_sweep` | Marketplace actions | Flag a held funding whose ledger does not match the provider record. |
| `scheduled_release_sweep` | Marketplace actions | Move an authorized `release_scheduled` milestone to `release_requested` and queue the provider release instruction. |
| `marketplace_application_expire_sweep` | Collaboration-ops actions | Expire applications when admin mode is Auto. No-op when mode is Manual. |
| `recurring_cycle_sweep` | Does not exist as its own job. `sweepDueRecurrences` is folded into other ledger calls. | Slice G adds this kind. The clock enqueues it with the others. |

### B1. One idempotent enqueue

`enqueueDueSweeps()` in `src/lib/jobs.ts` inserts one `queued` row per kind when that kind has no `queued` or `running` row. A second tick does not insert a duplicate. Payload is `{ enqueuedAt }` only. No verification codes, no secrets.

### B2. Authenticated tick

`POST /api/cron/sweeps` checks `Authorization: Bearer ${CRON_SECRET}` with a timing-safe compare. Missing or wrong secret returns 401 and writes nothing. The handler calls `enqueueDueSweeps()` then `processDueJobs(32)`.

`GET /api/cron/sweeps` is not accepted.

### B3. Host schedule

`deploy/scripts/sweep-cron.sh` curls the tick. `docs/deploy/FRESH_SERVER_SETUP.md` installs a crontab entry every 5 minutes. Compose documents `CRON_SECRET` next to `AUTH_SECRET`. The web container does not run its own `setInterval`.

### B4. Admin jobs page

`/admin/jobs` shows the last tick time, the count processed, and the last error per sweep kind, read from the job rows. The manual enqueue buttons on Marketplace and Collaboration ops stay as an operator override. They call the same enqueue functions.

### B5. Failure behavior

A thrown sweep records `lastError`, increments attempts, and sets `runAfter` 60 seconds ahead until `MAX_ATTEMPTS` (3), then `failed`. The next tick still enqueues a new row for that kind only after the failed row is no longer `queued` or `running`. Failed rows stay visible for Retry.

### B6. Tests

- One tick queues each kind once.
- A second tick while the first row is `queued` does not add another.
- A due `milestone_auto_approval` row moves to `succeeded` with no admin session.
- Wrong `CRON_SECRET` returns 401 and leaves the job table unchanged.
- A sweep that throws becomes `failed` after 3 attempts.

**Exit:** a staging process with the crontab and no admin session log still shows `succeeded` sweep rows.

---

## 5. Slice C — Secrets and image host lock

**Done when** production refuses to sign cookies or encrypt provider secrets without `AUTH_SECRET`, and the image optimizer has an explicit host list.

1. `sessionSecret()`, the account cookie secret, and `secretKey()` throw when `NODE_ENV === "production"` and `AUTH_SECRET` is unset. The current hardcoded fallbacks stay for `NODE_ENV !== "production"` and tests.
2. `/api/health` does not print the secret. It adds `secrets.authConfigured: boolean`.
3. `images.remotePatterns` drops `hostname: "**"`. Local uploads do not need a remote pattern. Any remaining remote host is listed by name.
4. A succeeded `verification_email` or `claim_verification_email` job clears `code` from `payload`.

---

## 6. Slice D — Typecheck in CI

CI runs `npx tsc --noEmit` after `npm ci`. Docker may keep `ignoreBuildErrors` so the small Lightsail builder does not run out of memory. A type error fails the pull request.

---

## 7. Slice F — Remove demo and shell data

**Done when** a fresh database has no demo workspace, no synthetic audience, and no JSON payment store, and the admin copy that points at those is gone.

1. Delete `legacy_demo_payments`, `src/lib/protected-payments.ts`, `src/lib/trust.ts` JSON store, and `/admin/payments` demo UI. `/admin/trust` is the ledger dispute queue only.
2. Delete `demo_checkout`. A plan tier changes only in the Stripe webhook handler. Checkout without a Stripe secret returns an error and does not change `User.planTier`.
3. Replace `agency_demo_1` and `demo-business` as the write target. `getWorkspace()` without a user id is removed. Marketing pages that need sample creators read the directory, not a shared Business Pro workspace.
4. Public `/agency` loads the signed-in agency workspace. Roster, campaigns, and joint portfolios are Prisma rows. The “case-study stubs” and “Phase 11 demo agency” strings are removed.
5. Intelligence snapshots omit gender and age unless those figures were stored from a provider sync. `source: "demo_seed"` is removed. The default settings note is an empty operator note. Trend demand is a count of briefs, searches, and collaborations for that specialty.

---

## 8. Slice G — Recurring funding, complete

Settings and the first-tranche math already exist (`planSchedule`, `sweepDueRecurrences`, the Recurring option on `/payments` when the jurisdiction allows it). The cycle is not a product until the clock creates the next tranche and both sides can see and stop the series.

1. Add job kind `recurring_cycle_sweep` that calls `sweepDueRecurrences`. Slice B enqueues it.
2. The next tranche is a new `CollaborationFunding` in `awaiting_provider` with the same `scheduleId`, the next `trancheIndex`, a new fee snapshot priced at creation time, and its own milestones. It becomes `held` only after that tranche’s signed webhook.
3. Creating tranche N+1 before `intervalDays` have passed after tranche N’s hold is rejected.
4. Contract and payments UI show the series: index, interval, remaining count, next due date, and a Stop control. Stop sets the schedule so later tranches are not created. A tranche already held or released stays in the ledger.
5. Ambassador conversion: from a completed one-off funding, the business can start a recurring series with the same parties, a chosen interval, and an occurrence count inside the jurisdiction max. The one-off row is `repeatOf` linked. The new series uses the fee rules in force at conversion, stored on the first tranche snapshot.
6. Disabling recurring on the jurisdiction blocks a new series and a new tranche. It does not delete tranches already held.
7. Tests cover early sweep, on-time sweep, webhook isolation between tranches, stop, ambassador conversion, and the jurisdiction gate.

**Exit:** with cron running and no admin click, tranche 2 appears as `awaiting_provider` only after the interval, and a webhook for tranche 1 does not hold tranche 2.

---

## 9. Slice H — Multi-creator team proposals, complete

Collab OS §3.3 and the contract wizard parties line require a suggestion to become a team proposal. That object does not exist. Guest suggestions and single-creator apply/invite stay as they are and gain the team path beside them.

1. Prisma `TeamProposal`: owner workspace, campaign intent, status `draft | sent | partial | accepted | declined | expired`, and `TeamProposalMember` rows (creator id, role, status `invited | accepted | declined`).
2. Match records can use `CREATOR_TEAM` and `BUSINESS_CREATOR_TEAM` with the same reason fields the single match already stores.
3. Business hub: from suggestions, select two or more creators and send one proposal. Each creator sees it on the influencer hub and accepts or declines.
4. All members `accepted` moves the proposal to `accepted` and opens the contract wizard with every creator as a party. Any decline moves it to `declined` and does not open the wizard.
5. Wizard milestone amounts split across creators using the share snapshot. Funding is blocked until every creator has a payout route in `ROUTE_READY`.
6. One funding instruction, one fee snapshot, and one release per milestone that pays each creator’s share through the provider adapter. A declined member after send cannot be silently dropped. Removing a member is a new proposal.
7. Tests: two-creator accept opens the wizard; one decline does not; funding with one payout route missing is rejected; guest suggestions stay anonymized and do not include a team send action.

**Exit:** a business can send a two-creator proposal, both accept, the wizard lists both, and funding waits until both payout routes are ready.

---

## 10. Slice I — Meilisearch, complete

Discover currently loads the directory and filters it in process (`searchDirectory` → `filterCreators`), and `getDirectory` can fall back to the seed array when Postgres throws.

1. Add Meilisearch to Docker Compose and document `MEILI_HOST` and `MEILI_API_KEY` in `.env.example`.
2. Index `creators`. Searchable: name, specialties, bio, languages, location. Filterable: specialty, country, platform, language, plan tier, verification. Synonyms come from the taxonomy table and are pushed when taxonomy changes.
3. Claim publish, profile save, and admin creator edits upsert the document. A `reindex_creators` job rebuilds from Postgres.
4. `searchDirectory` queries Meilisearch and maps hits back to the public creator DTO. Specialty synonyms and the role synonyms (creator / content creator / influencer) are index synonyms, so those queries return the same set.
5. Delete the seed-array fallback in `getDirectory`. If Postgres is down, Discover returns an error page. If the index is empty and Postgres has creators, the reindex job fills it before search returns.
6. `/admin` gains an index card: Postgres creator count, index count, last reindex time, and a Reindex action.
7. Tests: a filter query hits the index client with the expected filter string; a taxonomy synonym change is pushed; a creator deleted in Postgres disappears from the next search after upsert.

**Exit:** Discover results for a specialty query come from Meilisearch, and removing the creator row removes them after reindex.

---

## 11. Slice J — E-sign, complete

`/admin/signing` stores a provider row and lists `SignatureRequest` rows. Nothing calls a signing API. The contract wizard must not treat a local accept click as execution.

1. DocuSign is the first provider, matching the admin form’s `docusign` code. The adapter lives in `src/lib/signing/docusign.ts`. Domain code calls `createEnvelope`, `voidEnvelope`, and `parseWebhook`.
2. After the wizard’s contract preview, each party receives the envelope. `SignatureRequest.status` moves `queued → sent → completed | declined | voided`. `completed` is written only by the verified DocuSign Connect webhook.
3. The collaboration becomes executable only when every required party’s request is `completed`. An admin cannot set `completed` from a form.
4. `/admin/signing` shows provider health, the request, the external envelope id, the last error, and Resend. The “shell” and “non-goal” copy is removed.
5. Webhook route verifies the HMAC and is idempotent on the envelope event id.
6. Tests use recorded DocuSign HTTP fixtures: create envelope, duplicate webhook, declined party blocks execution, forged signature is rejected.

**Exit:** a wizard acceptance leaves the collaboration unsigned until the fixture webhook marks every party completed, and a forged webhook does not.

---

## 12. Slice K — Airwallex adapter, complete

`PaymentProviderAdapter` queues an instruction job and waits for a webhook. There is no Airwallex client. Collaboration domain rules stay free of Airwallex types. The adapter is the only place that speaks the Airwallex API.

1. `src/lib/providers/airwallex.ts` implements the adapter: funding intent, funding status, cancel, release, partial refund, full refund, payout status, webhook verify, webhook parse, reconcile.
2. Admin marketplace provider `airwallex` stores API base URL, client id, API key, webhook secret, holding-account id, and operations-account id. Secrets use the existing encrypt helper.
3. A funding intent creates the provider payment and one manual-release FundsSplit per milestone, each aimed at that creator’s connected account. The ledger still books Holding versus Operations on our side. Release calls the provider release for that split. The ledger moves to released only on the signed webhook, through the existing idempotent marketplace webhook path.
4. Creator payout onboarding, when the jurisdiction lists `airwallex` in `approvedProviderIds`, creates or links the connected account and stores the provider reference on the payout profile.
5. Intro-fee settlement uses the same webhook rule. `confirmIntroFeeSettlement` no longer accepts a typed reference as proof of payment.
6. Tests with recorded HTTP fixtures cover: two splits to the same connected account, duplicate webhook does not double-release, fee stays in the holding snapshot until milestone approval, a jurisdiction without `airwallex` cannot create the intent, and a grep test fails if `airwallex` appears under `src/lib` outside the adapter, admin config, and tests.
7. Corridor capability rows (account type, currencies, payout method) are filled by `scripts/airwallex-sandbox-sync.ts`, which calls the sandbox API and writes only the fields the API returns. The script is part of this slice. Slice E runs it against the sandbox account.

**Exit:** a fixture funding goes intent → held webhook → release call → released webhook, the ledger matches, and a second delivery of the same event id does not pay again.

---

## 13. Slice L — Remaining admin paths that are still shells

These are the admin surfaces that would still be incomplete after F, J, and K.

### SMS

`/admin/mail` has an SMS checkbox and a free-text note. Templates already have an SMS mode and never send.

1. Twilio is the provider: account SID, auth token, from-number, stored encrypted.
2. A `sms_send` job renders the template and calls Twilio. Success is the provider’s accepted message id. Failure lands on `/admin/jobs` and can be retried.
3. Members with preferred channel SMS receive the same triggers email uses (invite, verify, collab notification) when SMS is enabled and the member has a phone. The note field is removed.

### Stripe customer portal and Connect

`openCustomerPortal` and `openConnectLink` require an operator to paste `cus_` or `acct_`.

1. Checkout webhook stores `stripeCustomerId` on the user. `/billing` opens the portal for that id when `customer_portal` is on.
2. Creator payout setup opens a Connect account link, stores `acct_` on the payout profile, and `ROUTE_READY` for a Stripe corridor requires that id. The paste-an-id form is removed.

### Flutterwave and M-Pesa

Both are seeded gateway shells. A country routed to them must not report a paid plan or a held funding without a webhook.

1. Each gets an adapter with create-charge and webhook verify.
2. Admin gateways shows enabled, secret saved, and last webhook time.
3. Tests: a fixture webhook holds or marks the checkout paid; a missing signature does not.

### AI functions

`profile_topic_classification` can call OpenAI or Anthropic. The other three functions are described as fallbacks.

1. `collaboration_match_explanation`, `business_creator_match`, and `profile_draft_extraction` call the assigned provider with a fixed JSON schema and validate the response.
2. When the function is unassigned or the call fails, the product shows the existing rules result and labels it as rules. It does not label it as model output.
3. Tests: provider mode parses a fixture completion; failure mode returns the rules result and writes an `ai_provider` failed job.

### Paid mentorship

`paid_mentoring` can be switched on, and the module still refuses to charge.

1. A mentorship request with paid sessions creates a Checkout (Stripe) or Airwallex intent that is not a collaboration funding and does not write collaboration holding accounts.
2. The session is confirmed only by that webhook.
3. Tests: a paid request with the switch off is rejected; a paid request with the switch on does not create a `CollaborationFunding` row.

---

## 14. Slice E — Phase M evidence, complete

This slice is the staging proof of A–L. CI does not mark it done. It is done when the tables in `docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md` are filled with the ids below and the new rows in E8–E12. A blank checkbox is not done.

### E0. Environment

Staging host, HTTPS, `NEXT_PUBLIC_APP_URL`, `AUTH_SECRET`, `CRON_SECRET`, `MEILI_HOST`, `MEILI_API_KEY`, `ADMIN_SUPER_EMAIL`, Compose Postgres healthy, TLS valid in a browser. Probe: `npm run staging:evidence-probe` against the URL. Health returns `secrets.authConfigured: true`.

### E1. Sweep clock

Confirm crontab is installed. Wait one interval with no admin session. Record a `succeeded` job id for `milestone_auto_approval` and for `recurring_cycle_sweep`.

### E2. SMTP

Admin → Mail: host, from, secret, enabled. Send the test invite. Complete a claim verify. Record the message id. Break the password, confirm `/admin/jobs` shows `failed`, restore, Retry, confirm `succeeded`.

### E3. SMS

Save Twilio credentials, enable SMS, send a verify template to the operator phone. Record the Twilio message SID.

### E4. Stripe sandbox

`sk_test_` only. Webhook secret on `{APP}/api/billing/webhook`. Member checkout with card `4242`. Record `cs_test_…`, `CheckoutAttempt` id, and the resulting `planTier`. Resend the same `checkout.session.completed`. Record the `ProcessedWebhook` id and confirm the plan did not change a second time. `demo_checkout` is gone, so there is no demo switch to turn off. Open the billing portal from `/billing` and record the portal URL host `billing.stripe.com`. Finish Connect onboarding for a test creator and record the `acct_` stored on the payout profile.

### E5. One social network

YouTube or Instagram. Redirect `{APP}/api/social/callback`. Consent from a creator dashboard. Record that followers and likes were stored together, or that a payload missing one of them wrote nothing.

### E6. Meilisearch

Record index count equal to published creator count. Search Discover for a specialty and for “content creator”. Record that both return the indexed set. Delete a test creator in admin and record that the next search omits them.

### E7. Marketplace hold and release on Airwallex sandbox

Run `scripts/airwallex-sandbox-sync.ts` and record the capability rows written. Create a funding in a jurisdiction whose `approvedProviderIds` includes `airwallex`. Record the provider payment id and one FundsSplit id per milestone. Post the sandbox held webhook, then approve a milestone, then the release webhook. Record funding status `held` then `released`, and a replay of the same event id with no second ledger release.

### E8. Recurring series

Create a 2-occurrence series with a one-day interval on sandbox. Record tranche 1 held. Advance the clock via the sweep tick. Record tranche 2 `awaiting_provider` and its own payment id. Stop the series and record that tranche 3 was not created.

### E9. Team proposal

On the business hub, send a two-creator proposal. Record both accepts, the wizard party list, and a blocked funding while one creator has no payout route. Add the route and record the funding id.

### E10. E-sign

Send the wizard envelope in the DocuSign sandbox. Record the envelope id. Complete both parties in the sandbox. Record `SignatureRequest.status = completed` and the collaboration moving to executable only after the second webhook. Replay the webhook and record a single completion.

### E11. Flutterwave or M-Pesa sandbox

One of the two, for the country routed to it. Record the charge id and the webhook that marks the attempt paid. A request with a bad signature leaves the attempt unpaid.

### E12. Intro fee and paid mentorship

Record an intro moving to `paid` from the Airwallex webhook, with no typed reference. Record a paid mentorship Checkout id and confirm no `CollaborationFunding` row shares that id.

### E13. Sign-off

| Area | Evidence id | Date | Operator |
|---|---|---|---|
| Env, HTTPS, auth secret, cron | | | |
| SMTP + SMS | | | |
| Stripe checkout, duplicate skip, portal, Connect | | | |
| Social OAuth | | | |
| Meilisearch counts | | | |
| Airwallex hold and release | | | |
| Recurring tranche 2 | | | |
| Team proposal | | | |
| DocuSign completed | | | |
| Flutterwave or M-Pesa | | | |
| Intro fee + paid mentorship | | | |

**Exit:** every cell in E13 has an evidence id. The program is not complete while any cell is empty.

---

## 15. Order

A and C land first so later slices do not grant the demo workspace or encrypt new provider secrets with the fallback key. D is independent and can merge beside them. Then F, B, G, H, I, J, K, L. E is last and runs on staging against the merged result.

Each slice is its own pull request. A slice that leaves a demo path “for now” is not ready to merge.
