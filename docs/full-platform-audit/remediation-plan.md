# Full-platform audit — consolidated remediation plan (IPS-20)

> **PROVISIONAL — Ola direction (2026-11-20; IPS-30/31 refresh 2026-11-21).**  
> This plan stays **provisional until the full audit evidence package is committed on GitHub**. It is **not** a platform-wide completion certificate, **not** authorization to open product remediations beyond already-merged #537, and **not** proof that live host already matches `main`.  
> **Live collaboration deposits remain closed.** Agency product remains Explicitly deferred.  
> **Commit coordination:** Audit package GitHub worker (`bc-cd0be808-fe9f-5151-9b07-2a30bc90b6cf`) must publish **this** store path as the plan revision in the evidence PR — see [§ Coordination](#coordination--github-evidence-package).

| Field | Value |
|-------|--------|
| **Status** | Provisional design / planning artifact |
| **Audit execution baseline** | Live host probed @ `40b6288` (#536); matrix post IPS-25 |
| **Code note** | #537 COR-SEC-01 **merged** → `5a5f4c0` on `main`; live redeploy + credential rotation **not** confirmed |
| **Matrix** | **382 Pass · 29 Fail · 80 Blocked · 1 Not tested · 10 Explicitly deferred** (502 rows, IPS-44) — +IPS-29/30/31 + IPS-40 + **IPS-42** reconcile (−1 Pass / +1 NT; View/Export + notify isolation narrowed) |
| **Authoritative matrix** | [coverage-matrix.md](./coverage-matrix.md) |
| **Coverage narrative** | [coverage-status.md](./coverage-status.md) |
| **Execution** | [execution/](./execution/) (auth, collab, billing, admin, [not-tested-chase-results.md](./execution/not-tested-chase-results.md), [dashboard-consistency-results.md](./execution/dashboard-consistency-results.md), [mail-sink-restore-results.md](./execution/mail-sink-restore-results.md)) |
| **Prior pack** | [docs/remediation-pack/](../remediation-pack/) |
| **IPS-29 patch** | [execution/dashboard-consistency-remediation-patch.md](./execution/dashboard-consistency-remediation-patch.md) (RC-DASHBOARD detail) |
| **IPS-31 mail-sink** | [execution/mail-sink-restore-results.md](./execution/mail-sink-restore-results.md) — isolated Mailpit; deposit+mail remain Blocked |

---

## What this document claims / does not claim

| Claims | Does **not** claim |
|--------|---------------------|
| 24 Fail rows are reproduced with evidence paths (incl. IPS-29 INV-DC-* + IPS-30 INV-C-014/INV-N-004) | Platform is fully audited or remediated |
| Blocked rows are dependencies / retest gates (84 after IPS-43; was 95 after IPS-31) | Blocked = Pass, or deposit+mail marked Pass without money event |
| Corrected flows + acceptance for each Fail | Product PRs are approved to start (except #537 already merged) |
| Plan is the revision for the GitHub evidence PR | Evidence pack is already on GitHub |

---

## Coordination — GitHub evidence package

| Role | Agent / path | Instruction |
|------|--------------|-------------|
| Plan author (this doc) | `bc-6b5c0158-5f8f-5732-976b-411f1252d49a` | Maintain provisional plan in store |
| **Audit package GitHub** | [#539](https://github.com/getnuevetech/Influrios/pull/539) / `cursor/full-platform-audit-package-b6cf` | Commit **this file** + matrix/status/execution/media; IPS-29 + IPS-30 + IPS-31 revisions |
| Coordinator | Project parent | Route handoff; keep plan provisional until PR lands |

**Handoff path for commit:**  
`/cursor/stores/bc-52867d75-a339-4985-81ae-823456e1a82c/docs/full-platform-audit/remediation-plan.md`  
Companion: `coverage-status.md`, `coverage-matrix.md`, `execution/*`, `media/**`.

Until that PR exists and is reviewable on GitHub, treat every remediation item below as **provisional**.

---

## Constraints (non-negotiable)

| Constraint | Status |
|------------|--------|
| Live collaboration deposits (`journey_funding`) | **Closed** — funding/payout/refund money paths stay Blocked, not “fixed” by this plan |
| Agency product | **Explicitly deferred** (10 matrix rows) |
| New product remediations from IPS-20 | **Not opened** here |
| COR-SEC-01 code | **Merged** #537 @ `5a5f4c0` — live redeploy + **authorized rotation** still open |
| Platform-wide completion language | **Forbidden** while Fail/Blocked remain |

---

## Fail inventory (24 rows → 9 root causes)

| Root cause | Defect IDs | Fail rows | Sev |
|------------|------------|-----------|-----|
| **RC-SEC** | COR-SEC-01 | INV-R-074 | P0 |
| **RC-CATALOG** | BILL-01 / COR-03–04, BILL-03 (+ BILL-02 adjacent) | INV-R-006, INV-A-070, INV-A-072, INV-A-073 | High |
| **RC-PORTAL** | BILL-05 | INV-A-074, INV-C-004 | Med |
| **RC-INVOICE** | BILL-04 / COR-24 | INV-D-006 | Med |
| **RC-DISCOVERY** | COR-13 | INV-P-001, INV-A-035, INV-C-008 | P2 |
| **RC-MAIL** | ADMIN-MAIL-FAILED | INV-R-119 | P1 |
| **RC-JOBS** | INV-J-020 / INV-J-021 | INV-J-020, INV-J-021 | P2 |
| **RC-EXPORT** | INV-D-003 | INV-D-003, INV-I-014, INV-A-102 | P2 |
| **RC-DASHBOARD** | DC-INVITE-MISMATCH, DC-PAYOUT-MISMATCH, DC-ACTIVE-MISMATCH, DC-TEAM-INVITE-DEADEND, DC-ACTION-STUCK, ACCEPT-CONDITIONAL (IPS-29/30); P1-AUD-01…09 (IPS-44) | INV-DC-001, INV-DC-002, INV-DC-006, INV-DC-015, INV-DC-012, INV-C-014, INV-N-004, INV-DC-013, INV-DC-014, INV-A-048, INV-N-015T, INV-N-017T | High |

**Non-Fail follow-ups (do not inflate Fail count):** COR-09a dual chrome; BILL-06 Manage downgrade → `/claim`; MSG-NAV; INV-J-022 `subscription_renewal_sweep` **Blocked** (adjacent cron); COR-20 soft-error path not re-mutated on waiting-review fixture.

### Suggested package order (prior R-packages)

| Order | Package | Root causes | Gate |
|------:|---------|-------------|------|
| 1 | R0 | RC-SEC | Redeploy `5a5f4c0` + authorized rotation |
| 2 | R2 (+ R3 quote) | RC-CATALOG, RC-PORTAL, RC-INVOICE | Ola-approved Stripe year/upgrade Prices — **do not invent amounts** |
| 3 | R4 discovery | RC-DISCOVERY | Live profiles / shortlist |
| 3b | R4b dashboard consistency | RC-DASHBOARD | Single invite/payout/active projection; team invite CTAs — [patch](./execution/dashboard-consistency-remediation-patch.md) |
| 4 | R5 ops | RC-MAIL, RC-JOBS, RC-EXPORT | Cron + mail triage + CSV export |
| — | R6 / Agency | — | Out of scope while deposits closed / deferred |

---

## Blocked dependency map (how Blocked interacts with Fail)

Blocked rows are **not** Fail. They **block proof** of related remediations and must be called out on each correction.

| Blocker theme (**84 Blocked** post IPS-43; NT = 6) | Blocks proof of… | Remediations still designable? |
|------------------------------------------|------------------|--------------------------------|
| Remaining mail-sink gaps (claim-draft / notification-event) | Full claim publish + live notification kind emission | Yes — fixtures; **IPS-31** proved interception (INV-I-019); do not reopen deposits |
| Live deposits closed (+ deposit+mail) | Funding, release, refund, payout notices; collab discount apply | Yes for subscription Fail; **no** live money reopen; mail portion may be proven via Send-test only |
| Cron / shared-host isolation | INV-J-022 renewal; safe live fire of INV-J-020/021; INV-DC-014 expire mutation | Prefer staging/isolation for first success |
| Fixture gaps | Pending Sign, cancel entry, deep-link ids, AI tailor off; IPS-29 INV-DC-010 invite create / INV-DC-013 withdraw | Separate fixture work — not Fail |
| OAuth / Meta | Social connect provider-confirmed | Out of Fail set |
| Agency deferred | Agency product depth | Destinations only |

Full themes: [coverage-status.md §4](./coverage-status.md) · [blocked-register.md](./blocked-register.md) · chase: [not-tested-chase-results.md](./execution/not-tested-chase-results.md) · IPS-29: [dashboard-consistency-results.md](./execution/dashboard-consistency-results.md) · IPS-31: [mail-sink-restore-results.md](./execution/mail-sink-restore-results.md).

---

## Correction template (every Fail)

Each root-cause section below includes:

1. **Current evidence** — what failed, screenshots/probes, matrix IDs  
2. **Intended / corrected flow** — user & system steps after fix  
3. **Desktop / mobile design** — requirements or link to existing boards/atlas  
4. **Implementation scope** — in / out; entry points; deps  
5. **Acceptance tests** — Pass criteria + Blocked dependencies that remain  

---

## RC-SEC — Public admin bootstrap credential exposure

| | |
|--|--|
| **Fail rows** | INV-R-074 |
| **Defect** | COR-SEC-01 |
| **Code** | #537 **merged** → `5a5f4c0` on `main` |
| **Live** | Audit evidence @ `40b6288` still showed hints; redeploy of `5a5f4c0` + rotation **unconfirmed** |

### 1) Current evidence

- Screenshot: `media/admin/01-admin-login-public.png` — Default super admin hint + email prefill.  
- Matrix: INV-R-074 Fail.  
- Pack / PR evidence: `media/cor-sec-01-r0/`; rotation note `internal/cor-sec-01-r0-rotation.md`.  
- **Blocked dependency:** live redeploy lag — Fail may remain until post-deploy retest.

### 2) Intended flow

1. Guest `/admin/login` → empty email/password; no bootstrap hints.  
2. First-time setup via env + `/admin/setup?token=…` only.  
3. Empty admin store requires `ADMIN_SUPER_*` with no hardcoded fallback.  
4. Authorized ops: rotate previously exposed secret + invalidate admin sessions.

### 3) Desktop / mobile design

- Same empty form both viewports (1440 / 390); no credential strings in HTML/help.  
- Spec: [Dev_AI_Instructions §15](../remediation-pack/Dev_AI_Instructions.md). No new atlas board.

### 4) Implementation scope

- **In:** #537 code (done on `main`); redeploy; public-output retest; authorized rotation.  
- **Out:** R1 dual chrome, billing, inventing new bootstrap UX.  
- **Entry:** `src/lib/admin-auth.ts`, admin login page, `admin-auth.test.ts`.

### 5) Acceptance tests

| # | Pass when | Blocked / open |
|---|-----------|----------------|
| S1 | Deployed `/admin/login` DOM has no bootstrap email/password help | Needs redeploy of `5a5f4c0` |
| S2 | Bootstrap without env fail-closed | Unit/CI |
| S3 | `/admin/setup?token=…` still works | — |
| S4 | Live phrase from `01-admin-login-public.png` absent | Redeploy |
| S5 | Prior secret unusable; sessions invalidated | **Ops authorization** |

**Close INV-R-074** only after **all** of S1–S5: code containment (merged), deployment verification (S1–S4), and credential/session rotation (S5). Merged #537 alone does **not** close security remediation.

---

## RC-CATALOG — Missing / unmapped Stripe prices (annual + upgrade)

| | |
|--|--|
| **Fail rows** | INV-R-006, INV-A-070, INV-A-072, INV-A-073 |
| **Defects** | BILL-01 / COR-03–04; BILL-03; adjacent BILL-02 |

### 1) Current evidence

- `media/billing/40-pricing-annual.png` — “yearly Stripe price id is missing” (×2).  
- `41d-billing-annual-ctas.png` — annual CTAs omitted / switch unavailable.  
- `44c-upgrade-dialog.png` — “Save a Stripe price before this change.”  
- Stripe API: `recurring[interval]=year` → **0** prices (`stripe-catalog-probe.json`).  
- Adjacent: business annual “not available for this plan yet” (`47b-biz-annual.png`) while Monthly/Annual toggle present.

### 2) Intended flow

1. Admin Plans → Pricing: each purchasable offer = audience + plan + interval + currency + **validated** Stripe Price ID.  
2. Guest `/pricing` Annual: approved amounts only when Price exists; else disabled CTA + “Annual billing is currently unavailable” (no customer-facing missing-price-id copy).  
3. Member `/billing`: Choose / Switch / Upgrade opens review against **existing** subscription item + target Price.  
4. Checkout / schedule / upgrade preview fails **before** session if unconfigured — never mid-flow “Save a Stripe price…”.  
5. Business annual: configured Price **or** same honest unavailable gate.

### 3) Desktop / mobile design

- **Link existing:** [Dev_AI_Instructions §4–§6, §8](../remediation-pack/Dev_AI_Instructions.md); Atlas boards 1–3 in [Influrios_Remediation_Design_Atlas.pdf](../remediation-pack/Influrios_Remediation_Design_Atlas.pdf).  
- Desktop 1440 + mobile 390: Monthly/Annual toggle; annual charge primary + monthly equivalent secondary; unavailable = disabled CTA, monthly remains.  
- Change-review dialog: current → target, due today / schedule, tax — §5.  
- Provider diagnostics **admin-only**.

### 4) Implementation scope

- **In:** Create Ola-approved year Prices; persist offer↔Price maps; validate before purchasable; upgrade uses subscription item ID; align UI amounts with `unit_amount` (COR-07 drift).  
- **Out:** Inventing atlas sample prices; live collab deposits; Agency.  
- **Entry:** `src/lib/billing.ts`, `billing-interval.ts`, plan pages, `/admin/plans`.  
- **Blocked deps:** discount redeem on upgrade still needs Price (admin discount UI Pass); billing.* email delivery Blocked without mail sink.

### 5) Acceptance tests

| # | Pass when | Blocked deps |
|---|-----------|--------------|
| C1 | Stripe year Prices exist for marketed influencer offers; IDs match admin | Needs approved amounts |
| C2 | `/pricing` Annual d+m: no missing-price-id copy; Choose **or** unavailable gate | — |
| C3 | INV-A-070 annual checkout | Session **or** pre-checkout gate |
| C4 | INV-A-072 month↔year schedule | Preview + schedule for configured offers |
| C5 | INV-A-073 Upgrade Pro | No “Save a Stripe price…” |
| C6 | BILL-02 business annual | Purchasable **or** consistent unavailable |
| C7 | Monthly Plus + INV-D-005 hosted invoice regression | — |

**Close** INV-R-006, INV-A-070, INV-A-072, INV-A-073 after C1–C5.

---

## RC-PORTAL — Customer portal On, Manage billing missing

| | |
|--|--|
| **Fail rows** | INV-A-074, INV-C-004 |
| **Defect** | BILL-05 |

### 1) Current evidence

- Admin: `32-admin-billing.png` — Customer portal **On**.  
- Member: `12-billing-member.png` — Payment method; **no Manage billing**.  
- Gate INV-C-004 Fail (switch ineffective on member path).

### 2) Intended flow

1. Portal On + Stripe customer → **Manage billing** on `/billing` (business equivalent when applicable).  
2. Click → Customer Portal session (sandbox) → return.  
3. Portal Off → CTA hidden/gated.  
4. Missing customer → “We could not load your billing details…” (admin sees diagnostic).

### 3) Desktop / mobile design

- Atlas board 2 / [§5 Member Billing](../remediation-pack/Dev_AI_Instructions.md): payment-method row + Manage button ≥44px; mobile full-width OK.  
- No provider jargon on customer surface.

### 4) Implementation scope

- **In:** Fix `hasCustomer` / customer ID resolution; create portal session only when On + customer present.  
- **Out:** Changing portal product policy; live deposits.  
- **Blocked deps:** none for CTA visibility; portal session needs sandbox Stripe.

### 5) Acceptance tests

| # | Pass when |
|---|-----------|
| P1 | Portal On + AUDIT member with customer → Manage billing d+m |
| P2 | Opens sandbox portal; return OK |
| P3 | Portal Off → CTA absent/gated |
| P4 | No customer → supportive error |

**Close** INV-A-074 + INV-C-004 after P1–P3.

---

## RC-INVOICE — In-app billing history invoice / PDF

| | |
|--|--|
| **Fail rows** | INV-D-006 |
| **Defect** | BILL-04 / COR-24 |

### 1) Current evidence

- `12-billing-member.png` — COMPLETED history; **no** View/Download.  
- INV-D-005 hosted invoice/PDF **Pass** (provider-confirmed) — do not demote.

### 2) Intended flow

1. History rows expose **View invoice** / **Download PDF**.  
2. Tenant-authorized hosted URL or streamed PDF.  
3. Missing doc → retry; COMPLETED stays if PDF delayed.  
4. Signed-out / other tenant → 401/404.

### 3) Desktop / mobile design

- [§5 History and documents](../remediation-pack/Dev_AI_Instructions.md); COR-24 in [ADDENDUM-v1.1](../remediation-pack/ADDENDUM-v1.1-deliverables.md).  
- Columns: date, plan, interval, invoice #, amount, status, actions.  
- Mobile: overflow/stacked actions; no page overflow at 390.

### 4) Implementation scope

- **In:** Wire rows to `hosted_invoice_url` / `invoice_pdf` (or stored refs) + AuthZ.  
- **Out:** Relabeling unpaid PDF as receipt; collab earnings mixed into subscription history.  
- **Blocked deps:** none for control presence; provider invoice must exist (AUDIT has `in_1UddzZ…`).

### 5) Acceptance tests

| # | Pass when |
|---|-----------|
| I1 | COMPLETED row shows View + Download |
| I2 | Own invoice PDF after fresh login |
| I3 | Cross-account / signed-out denied |
| I4 | INV-D-005 still Pass |

**Close** INV-D-006 after I1–I3.

---

## RC-DISCOVERY — Demo directory blocks cards & shortlist

| | |
|--|--|
| **Fail rows** | INV-P-001, INV-A-035, INV-C-008 |
| **Defect** | COR-13 / AUTH-DEF-01 |

### 1) Current evidence

- `media/auth/retest-P-07-discover-business.png` — Sample directory banner; no Shortlist; no `/c/` card hrefs.  
- Revalidated Fail on IPS-21.

### 2) Intended flow

1. When live discovery intended: Discover shows **live eligible** profiles (not sample-as-verified).  
2. Business opens full Influencer Card (modal or `/c/`).  
3. Shortlist add/remove persists tenant-scoped.  
4. Demo mode (if kept): explicitly sample; no false shortlist/booking as live.

### 3) Desktop / mobile design

- [Dev_AI_Instructions §13](../remediation-pack/Dev_AI_Instructions.md) (R4 discovery).  
- Full original card; QR usable when enlarged; Shortlist on card/directory.  
- Both viewports: open card + shortlist without clipping.

### 4) Implementation scope

- **In:** Product switch / data source for signed-in business live directory; card hrefs/modal; shortlist APIs + tenant isolation.  
- **Out:** Agency roster; inventing profile fields.  
- **Blocked deps:** INV-C-013 unpublished check Blocked by demo Discover until live mode fixed — related retest after RC-DISCOVERY.

### 5) Acceptance tests

| # | Pass when |
|---|-----------|
| D1 | INV-C-008: no misleading Sample-as-live when live On |
| D2 | INV-P-001: card/modal or `/c/` opens d+m |
| D3 | INV-A-035: shortlist persists; tenant-scoped |
| D4 | Guest demo (if any): explicit sample |

**Close** INV-P-001, INV-A-035, INV-C-008 after D1–D3.

---

## RC-MAIL — Failed mail jobs backlog

| | |
|--|--|
| **Fail rows** | INV-R-119 |
| **Defect** | ADMIN-MAIL-FAILED |

### 1) Current evidence

- `06-admin-mail-health.png` / `60-mail-health-detail.png` — **Failed mail jobs: 32**; SMTP ready.  
- `mail_test` SUCCEEDED (INV-J-005 / INV-E-010 Pass) — SMTP accept ≠ sink-confirmed delivery.

### 2) Intended flow

1. Mail health shows failed count + categories.  
2. `/admin/jobs` → Retry **one** retryable job (review popup).  
3. Actionable backlog cleared or classified (bad address / suppressed / template).  
4. New sends do not grow unexplained failures.  
5. Template delivery proof remains Blocked on live without Mailpit.

### 3) Desktop / mobile design

- Existing admin mail health + jobs (admin-only).  
- Failed count readable; retry reachable at 390 (nav collapse / COR-18 pattern).  
- No customer-facing change.

### 4) Implementation scope

- **In:** Triage 32 failures; retry/discard/fix; coordinate cron with **RC-JOBS**.  
- **Out:** Manufacturing production failures to test Retry; claiming INV-E-* Pass without sink.  
- **Blocked deps:** almost all INV-E-* / claim verify / OTP delivery stay Blocked until mail sink.

### 5) Acceptance tests

| # | Pass when | Still Blocked |
|---|-----------|---------------|
| M1 | Actionable failed count cleared or explained | — |
| M2 | One retry in isolation updates status | — |
| M3 | `mail_test` still SUCCEEDED | — |
| M4 | Document sink limitation | INV-E-* delivery |

**Close** INV-R-119 after M1–M3.

---

## RC-JOBS — Invitation / quote cron sweeps never ran

| | |
|--|--|
| **Fail rows** | INV-J-020, INV-J-021 |
| **Source** | IPS-25 [not-tested-chase-results.md](./execution/not-tested-chase-results.md) |
| **Evidence** | `media/nt-chase/inv-j-jobs-page.png` — **latest: never** + crontab/`CRON_SECRET` warning |
| **Adjacent** | INV-J-022 `subscription_renewal_sweep` **Blocked** (shared-host isolation) |

### IPS-30 note

Kind listed / historical UI visibility on `/admin/jobs` is **not** behavior acceptance. INV-J-006/010/011/015/017 were demoted to **Not tested** (listing-only). Closing INV-J-020/021 still requires scheduler operation **and** due-fixture behavior (event + notification; no duplicate on rerun) — not merely a recorded empty/failed scan.

### Product effects of never running (why this Fail matters)

Handlers live in `src/lib/jobs.ts` (`runInvitationFollowUpSweep`, `runQuoteExpirySweep`).

#### INV-J-020 — `invitation_followup_sweep`

| Aspect | Behavior when sweep **runs** | Effect when sweep **never** ran (current Fail) |
|--------|------------------------------|------------------------------------------------|
| Selects | `creatorInvitation` with `followUpAt ≤ now`, unclaimed, email present, status `queued|sent|opened`, not yet `expiresAt` | Due invitations sit without follow-up |
| Sends | Catalog `account.claim_followup` (fallback plain mail) + `invitationEvent` `follow_up_sent` | **No claim follow-up emails** → stale invite alerts never leave the system |
| User impact | Claimants reminded before expiry (`/invite/{token}`) | Unclaimed invites go quiet until hard expiry; conversion / ops visibility lost |
| Audit ties | P-08 notifications; INV-E-006 `account.claim_followup`; process terminal “follow-up sent” | Delivery rows stay Blocked; ops cannot prove follow-up path |

#### INV-J-021 — `quote_expiry_sweep`

| Aspect | Behavior when sweep **runs** | Effect when sweep **never** ran (current Fail) |
|--------|------------------------------|------------------------------------------------|
| Selects | `contractDocument` status `draft|sent` with `signedQuote.validUntil` in the **next 48h** | Expiring quotes not scanned |
| Sends | Catalog `contract.quote_expiring` to **pending** parties; audit `email_quote_expiring` | **No “quote expiring” stale alerts** to parties |
| User impact | Business/influencer warned to sign/act before valid-until | Quotes can approach/pass validity **without** expiring alert; inbox/email silence |
| Audit ties | P-11 terminal / INV-E-027 `contract.quote_expiring`; contracts list “Needs my signature” not reminded by sweep | Related email Blocked; stale commercial drafts linger without system nudge |

> Note: despite the kind name `quote_expiry_sweep`, the current handler sends **expiring-soon alerts** (48h horizon), not a hard status flip to expired. Remediation must either restore that alert path **or** product-change to true expiry — do not silently change semantics without Ola decision. Process-map “quote expired” terminal may need a separate explicit expire path if product requires it.

#### Stale alerts summary

| Stale alert | Sweep | Template | Stuck while Fail open |
|-------------|-------|----------|------------------------|
| Claim / card invitation follow-up | INV-J-020 | `account.claim_followup` | Unclaimed invites without reminder |
| Quote expiring (48h) | INV-J-021 | `contract.quote_expiring` | Pending signers without expiry warning |
| (Adjacent) Subscription renewal | INV-J-022 Blocked | billing renewal path | Not Fail — same cron wiring |

### 1) Current evidence

- Jobs UI: kinds listed; **latest: never**; “confirm crontab + CRON_SECRET”.  
- Unsigned `POST /api/cron/sweeps` → **401** (Pass) — endpoint mounted; scheduler not proven.  
- Other sweeps have historical succeeded rows; these two do not.

### 2) Intended flow

1. Host crontab/scheduler calls `POST /api/cron/sweeps` on interval with valid `CRON_SECRET`.  
2. Unauthorized → still 401.  
3. `enqueueDueSweeps` / process creates observable **succeeded** (or classified failed) history — not “never”.  
4. When due invitations exist → follow-up email + `follow_up_sent` event.  
5. When quotes enter 48h window → `contract.quote_expiring` to pending parties + audit log.  
6. Admin may Process once from Jobs UI in **isolation**; never manufacture production failures solely to test Retry.

### 3) Desktop / mobile design

- Existing `/admin/jobs` (admin-only): kind, latest status, clear crontab warning once runs exist.  
- [Dev_AI_Instructions §14 Jobs](../remediation-pack/Dev_AI_Instructions.md): status, attempts, last error, safe Retry popup.  
- Customer-facing: no new chrome — effects are **email + invitation/contract state**. Email design = existing catalog templates (`account.claim_followup`, `contract.quote_expiring`) — preview in `/admin/mail/templates` (79 listed).  
- Desktop + mobile admin: jobs list usable at 390.

### 4) Implementation scope

- **In:** Wire production/sandbox scheduler + `CRON_SECRET`; verify handlers registered/idempotent; first success evidence in isolation/staging; document live shared-host limits.  
- **Out:** Reopening live deposits; claiming INV-E-006/027 delivery Pass without mail sink; changing quote semantics without product decision.  
- **Entry:** `src/lib/jobs.ts`, `src/lib/sweep-clock.ts`, `/api/cron/sweeps`, host crontab.  
- **Blocked deps:** Mail sink for sink-confirmed follow-up/expiring email; INV-J-022 isolation; fixtures with `followUpAt` due / quote `validUntil` in 48h for behavioral proof.

### 5) Acceptance tests

| # | Pass when | Blocked deps |
|---|-----------|--------------|
| J1 | `/admin/jobs`: `invitation_followup_sweep` not “never” (succeeded or classified fail) | Prefer isolation |
| J2 | Same for `quote_expiry_sweep` | Prefer isolation |
| J3 | Cron without secret still 401 | — |
| J4 | Isolation Process once: due invite → follow-up event **or** zero-due with succeeded empty scan | Mail sink for content proof |
| J5 | Isolation: quote in 48h window → `email_quote_expiring` audit **or** documented zero-due | Mail sink for INV-E-027 |
| J6 | Customer regression: invite accept/decline UI still works; contracts list unaffected | — |
| J7 | INV-J-022 adjacent | When isolation allows — else remain Blocked |

**Close** INV-J-020 + INV-J-021 after J1–J3 (ops observability). J4–J5 required before claiming product alert paths Pass.

---

## RC-EXPORT — Intelligence export JSON ≠ CSV

| | |
|--|--|
| **Fail rows** | INV-D-003, INV-I-014, INV-A-102 |
| **Defect** | INV-D-003 |

### 1) Current evidence

- `media/admin/export-INV-D-003.bin` — `application/json`, not CSV.  
- Accounts CSV (INV-D-002) + legal CSV (INV-D-004) Pass.

### 2) Intended flow

1. Admin Intelligence → Export → **CSV** download (`text/csv` / `*.csv`).  
2. Optional separate “Export JSON” if needed — primary control = CSV.  
3. Admin-only AuthZ; signed-out denied.

### 3) Desktop / mobile design

- Label **Export CSV** (or dual labelled actions).  
- Download trigger without layout break at 390.  
- No customer board required.

### 4) Implementation scope

- **In:** Fix `/api/intelligence/export` (or admin action) Content-Type + rows.  
- **Out:** Changing intelligence product semantics.  
- **Regression:** INV-D-002, INV-D-004.

### 5) Acceptance tests

| # | Pass when |
|---|-----------|
| E1 | CSV parseable columns |
| E2 | INV-I-014 / INV-A-102 same from UI |
| E3 | INV-D-002 / D-004 still CSV |
| E4 | Non-admin / signed-out denied |

**Close** INV-D-003, INV-I-014, INV-A-102 after E1–E3.

---

## RC-DASHBOARD — Dashboard / hub / earnings contradiction (IPS-29)

| | |
|--|--|
| **Fail rows** | INV-DC-001, INV-DC-002, INV-DC-006, INV-DC-015, INV-DC-012, **INV-C-014**, **INV-N-004** |
| **Defects** | DC-INVITE-MISMATCH · DC-PAYOUT-MISMATCH · DC-ACTIVE-MISMATCH · DC-TEAM-INVITE-DEADEND · DC-ACTION-STUCK · ACCEPT-CONDITIONAL |
| **Full patch** | [execution/dashboard-consistency-remediation-patch.md](./execution/dashboard-consistency-remediation-patch.md) |
| **Evidence** | `media/dashboard-consistency/` · [dashboard-consistency-results.md](./execution/dashboard-consistency-results.md) |

### 1) Current evidence (influencer AUDIT, desktop + mobile)

- Home: **1 new invitation** / Invitations **1** / attention Free Tech Support; hub: Invitations **0** + “No invitations are waiting”; Collaborations badge **1**.  
- Home: **Complete payout setup**; hub: Payment readiness **Not ready**; earnings: Payout Setup **Ready**; Earnings badge **1**.  
- Home Active collaborations **3** vs hub Active **2**.  
- Team invite detail: **Pending your response** + **No further action needed** + no respond CTAs → action-required cannot clear.

Business AUDIT: Collaborations badge **2** stable; no parallel invite/payout split this pass.

**IPS-30:** INV-C-014 / INV-N-004 demoted from Pass — setup-reminder cues/`Not forced` alone ≠ conditional acceptance while INV-A-075 earnings shows Ready (same account as INV-DC-002).

### 2) Intended flow

1. One open-invitation projection across home, hub, and Collaborations badge (invite portion).  
2. One payout-readiness projection across home reminder, hub widget, earnings page, Earnings badge.  
3. Home Active count = hub Active.  
4. Pending team invite shows respond controls; completing response clears attention + counts together.  
5. Opening Unread `?open=` clears bell; completing action clears action-required (unread ≠ action-required remains).

### 3–5) Design / implementation / acceptance

See patch **RC-DASHBOARD** (DB1–DB6). Package **R4b**. Deposits stay closed; no money-path reopen.

**Close** INV-DC-001, INV-DC-002, INV-DC-006, INV-DC-012, INV-DC-015, INV-C-014, INV-N-004 after DB1–DB4 (and reminder↔payout agreement) on deployed revision.

---

## Payment remediation requirement — milestone release with frozen fee allocations (R6 · Package 5)

**Added 2026-11-21 per Ola.** Governs the R6 payment remediation and Package 5 ledger acceptance. Full text: #540 `docs/ux-remediation/master-spec.md` §13 (MS1–MS8). **Status: Open. Not satisfied by existing helper code (`readMilestoneAllocation`, `settlementCommandKey`, `partialLegRecovery`) or by simulated releases.**

| ID | Requirement | Evidence required | Status |
|----|-------------|-------------------|--------|
| MS1 | Use the contract's frozen fee rules and milestone allocations | Per milestone: business fee, influencer fee, influencer net, platform allocation from the signed version; no recalculation with today's settings | Open |
| MS2 | Release both allocated amounts | One release authorization linking influencer leg + platform Operations leg | Open |
| MS3 | Partial success handled honestly | One leg ok / one failed → “Partially completed”; retry only the unfinished leg | Open |
| MS4 | No duplicates | Repeated approval, retries, duplicate callbacks never duplicate either payment | Open |
| MS5 | Every amount reconciles | Allocations total contract amounts incl. rounding; taxes/liabilities separately identified | Open |
| MS6 | Complete admin ledger | Contract → milestone → both legs: accounts, currency, amount, status, provider refs | Open |
| MS7 | Operations transfer ≠ bank withdrawal | Separate movements and records | Open |
| MS8 | Actual movement proven | Sandbox provider evidence per external transfer; simulation labelled and never counts as completion | Open |

**Delivery approval vs release (P1-AUD-08, decided):** authorized approval of a valid submitted version persists and clears the review task even with payout setup incomplete; release waits for readiness and the MS controls; UI “Approved · payout setup required”; auto-approval follows the same rule. Retest: INV-N-016T (currently Blocked) moves to its Package 1 acceptance AUD2 once approval is decoupled; the release half stays under MS1–MS8 + R6.

---

## Retained remediation-pack (still applicable)

| Item | Status vs this provisional plan |
|------|--------------------------------|
| #536 COR-20–23 on `main` | Revalidated Pass where noted in collab-results; boards = regression baselines |
| [design-boards/](../remediation-pack/design-boards/) | COR-20–23 only — not substitutes for billing/discovery atlas |
| [Dev_AI_Instructions.md](../remediation-pack/Dev_AI_Instructions.md) | Authoritative design for RC-SEC/CATALOG/PORTAL/INVOICE/DISCOVERY |
| COR-24 addendum | Open → RC-INVOICE |
| Agency / live deposits sections | Still deferred / closed |

---

## Explicitly out of scope

- Declaring **platform-wide completion** or “fully remediated”.  
- Opening **new** product PRs from this provisional plan.  
- Reopening **live collaboration deposits** or R6 payout Pass claims.  
- Agency product depth.  
- Folding Blocked into Pass.  
- Inventing commercial prices/fees from mockups.  
- Marking mail-template delivery Pass without a sink.

---

## Closure ledger (24 Fail)

| Fail row | RC | Close when | Still provisional until |
|----------|----|------------|-------------------------|
| INV-R-074 | RC-SEC | S1–S4 (+ S5 ops) | Live redeploy of `5a5f4c0` + evidence PR |
| INV-R-006 | RC-CATALOG | C1–C2 | Approved year Prices + evidence PR |
| INV-A-070 | RC-CATALOG | C3 | same |
| INV-A-072 | RC-CATALOG | C4 | same |
| INV-A-073 | RC-CATALOG | C5 | same |
| INV-A-074 | RC-PORTAL | P1–P3 | evidence PR |
| INV-C-004 | RC-PORTAL | P1–P3 | evidence PR |
| INV-D-006 | RC-INVOICE | I1–I3 | evidence PR |
| INV-P-001 | RC-DISCOVERY | D2 | evidence PR |
| INV-A-035 | RC-DISCOVERY | D3 | evidence PR |
| INV-C-008 | RC-DISCOVERY | D1 | evidence PR |
| INV-R-119 | RC-MAIL | M1–M3 | evidence PR |
| INV-J-020 | RC-JOBS | J1 + J3 (J4 for alert proof) | Cron wired + evidence PR |
| INV-J-021 | RC-JOBS | J2 + J3 (J5 for alert proof) | Cron wired + evidence PR |
| INV-D-003 | RC-EXPORT | E1 | evidence PR |
| INV-I-014 | RC-EXPORT | E2 | evidence PR |
| INV-A-102 | RC-EXPORT | E2 | evidence PR |
| INV-DC-001 | RC-DASHBOARD | DB1 | evidence PR |
| INV-DC-002 | RC-DASHBOARD | DB2 | evidence PR |
| INV-DC-006 | RC-DASHBOARD | DB3 | evidence PR |
| INV-DC-012 | RC-DASHBOARD | DB4 | evidence PR |
| INV-DC-015 | RC-DASHBOARD | DB4 | evidence PR |
| INV-C-014 | RC-DASHBOARD | DB2 + reminder conditional | evidence PR |
| INV-N-004 | RC-DASHBOARD | DB2 + reminder conditional | evidence PR |

---

## Tracker

- **IPS-20** — this provisional plan (expand for Ola; no new product PRs).  
- **IPS-25** — NT chase complete; Fail +2 (INV-J-020/021).  
- **IPS-26** — [coverage-status.md](./coverage-status.md).  
- **IPS-29** — dashboard consistency contradiction coverage; Fail +5 (INV-DC-001/002/006/012/015) → **RC-DASHBOARD**.  
- **IPS-30** — Pass acceptance corrections (Ola bbc38ce): demote visibility-only Passes; plan stays **PROVISIONAL**.  
- **IPS-31** — isolated Mailpit restore; deposit+mail stay Blocked; plan stays **PROVISIONAL**.
- **IPS-40** — claim draft + notify isolation + demoted NT actions/jobs on isolated host; deposit+mail stay Blocked; plan stays **PROVISIONAL**.  
- **IPS-42** — evidence reconcile: INV-J-010 → NT; INV-D-007 View Pass / Export NT; INV-N-010…017/027 Pass = delivery isolation only; matrix **378 Pass · 80 Blocked · 1 NT**; design PR not held.  
- **IPS-44** — 10 Package 1 gating checks executed on a local isolated host (`main` @ `5a5f4c0`): 4 Pass · 5 Fail · 1 Blocked; new defects P1-AUD-01…10. Matrix **502 · 382 Pass · 29 Fail · 80 Blocked · 1 NT**.
- **IPS-43** — hidden gaps made countable: INV-D-007E media-kit export (NT); notification triggers INV-N-010T…017T/027T (4 Blocked · 4 NT) linked to existing action/job checks; INV-N-014 trigger covered by INV-J-011. Matrix **502 rows · 378 Pass · 24 Fail · 84 Blocked · 6 NT**.
- **#537** — COR-SEC-01 merged `5a5f4c0`; redeploy + rotation open (S1–S5 all required).  
- **GitHub evidence package** — Audit package worker must commit **this** revision.
