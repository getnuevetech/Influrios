# Coverage completion status — full-platform audit reopen

**Tracker:** IPS-26 under IPS-19 · **As of:** 2026-11-20 (post–IPS-25 matrix refresh)  
**Package baseline:** `main` @ `5a5f4c0` (includes #536 COR-20–23 + merged #537 R0)  
**Audit execution host:** live probes @ `40b6288` (pre–#537 deploy)  
**Host:** https://influrios.com · Live collaboration deposits closed (`journey_funding`)  
**Authoritative matrix:** [coverage-matrix.md](./coverage-matrix.md)  
**Blocked register:** [blocked-register.md](./blocked-register.md) (162 rows)  
**Evidence INDEX:** [media/INDEX.md](./media/INDEX.md)  
**NT chase (IPS-25 complete):** [execution/not-tested-chase-results.md](./execution/not-tested-chase-results.md)  
**Slice evidence:** [execution/auth-results.md](./execution/auth-results.md) · [execution/collab-results.md](./execution/collab-results.md) · [execution/billing-results.md](./execution/billing-results.md) · [execution/admin-results.md](./execution/admin-results.md)  
**Remediation plan (IPS-20):** [remediation-plan.md](./remediation-plan.md) — **provisional** until Ola endorses; **17 Fail → 8 root causes** (incl. **RC-JOBS** INV-J-020/021 + invitation/quote stale-alert effects); blocked deps mapped; no new product PRs; **not** platform-wide completion

> **This report does not claim the platform is fully audited, fully remediated, or platform-wide complete.** Phase B matrix execution closed all seeded Not tested rows (IPS-25 complete → **Not tested = 0**), but **17 Fail** and **162 Blocked** remain open, Agency stays Explicitly deferred, and defects are not fixed by this audit. Prior e2e Pass results and #536 do not close this reopen. Live deposits remain closed.

---

## Snapshot (matrix header — post IPS-25)

| Status | Count | Meaning here |
|--------|------:|--------------|
| Pass | 287 | Required cases executed; expected met (with caveats in Actual) |
| Fail | 17 | Defect with evidence — see §2 (incl. new INV-J-020/021) |
| Blocked | 162 | Could not execute (env/gate/credentials/fixture) — must not vanish into Pass |
| Not tested | **0** | IPS-25 chase complete — see [not-tested-chase-results.md](./execution/not-tested-chase-results.md) |
| Explicitly deferred | 10 | Agency product entries only (destination checks recorded) |
| **Matrix rows** | **476** | |

**Chase delta (89 former Not tested):** 54 Pass · 2 Fail · 33 Blocked · 0 Not tested ([chase report](./execution/not-tested-chase-results.md)).

**Slices completed (IPS-21…25):** auth (P-01…P-07), collab (P-08…P-18 + #536 revalidate), billing (P-21…P-23 / payouts-refunds surface), admin (P-27* + messages/notifications/jobs/email/integrations), **nt-chase (IPS-25)**.

---

## 1) Coverage completed (what was tested)

Executed work that reached **Pass** (or deliberate gate observation) across slices **plus IPS-25 nt-chase**. Detail lives in the matrix Actual/Evidence columns, slice reports, and [not-tested-chase-results.md](./execution/not-tested-chase-results.md).

### Auth (IPS-21) — P-01…P-07

| Area | What passed |
|------|-------------|
| Signup / register | Validation, create account → `/account/verify`; `/register` alias; claim **start** form |
| Login / logout | Influencer → `/creator`, business → `/business/home`; bad password reject; desktop + mobile logout |
| Password surfaces | Reset **request** (`?sent=1`); set-password redirect when `hasPassword`; `/account?tab=security` change form |
| Verify UI | Code + resend present (OTP completion Blocked — §4) |
| Profiles | Influencer dashboard/details/social/links tabs; details save; business profile save (`?saved=1`) |
| Onboarding | Creator setup reminders visible |
| Discovery routes | `/discover`, `/categories` load (shortlist/card **Fail** — §2) |
| Business marketing | `/business` form + consent |

Evidence root: `media/auth/` · Report: [execution/auth-results.md](./execution/auth-results.md)

### Collaboration / deliverables / review (IPS-22) — P-08…P-18

| Area | What passed |
|------|-------------|
| Hubs / inbox | Business + influencer collab hubs; action inbox tasks; payments list without open-deposit CTA |
| Requests | Create-request wizard (Brief→Audience→Terms→Review); Save draft; hub tabs |
| Contracts prep | Agreements/templates lists; contract & milestone wizard loads |
| Workroom | Both roles; Funds held fixture; milestones/files; FocusDialog review hub |
| Deliverables | Authorized download 200 (both roles); signed-out 401 |
| Review / revisions | Separated Request changes vs Approve (COR-23) |
| Funding **gate** | INV-C-001: no live new-deposit path / no Stripe charge opened |
| Invite token | Invalid `/invite/[token]` → handled 404 |

Evidence root: `media/collab/` · Report: [execution/collab-results.md](./execution/collab-results.md)

### Billing (IPS-23)

| Area | What passed |
|------|-------------|
| Billing shells | Guest/member `/billing`; success/cancel auth gates; business billing/plans monthly UI |
| Admin billing ops | Plans editor (incl. annual fields), billing activity (Stripe·Sandbox), discounts create UI, finance, marketplace destination |
| Tax / auto-renew display | Tax lines on cards; Auto-renewal On shown |
| Connect setup UI | Earnings payout setup Ready |
| Hosted invoice | Stripe invoice `in_1UddzZ…` paid + hosted URL + PDF (**provider-confirmed**) |
| Agency CTA destination | Upgrade CTA present / not silent 404 (product still deferred) |

Evidence root: `media/billing/` · Report: [execution/billing-results.md](./execution/billing-results.md)

### Admin / messages / notifications / jobs / email / integrations (IPS-24)

| Area | What passed |
|------|-------------|
| Admin routes | Authenticated load for probed admin pages (48/48 in slice), menus SIDE_GROUPS, accounts tabs, payment-settings sections |
| Mail ops | SMTP ready; **79/79** templates listed; admin Send test → `mail_test` **SUCCEEDED**; cron sweeps endpoint **401** without secret |
| Jobs UI | Kinds listed; historical succeeded where present; retry copy |
| Messages | Workroom round-trip business ↔ influencer |
| Notifications | Bell, centre, account prefs, inbox consistency samples |
| Downloads | Accounts CSV, legal acceptances CSV, legal doc view |
| Webhooks (mount) | Billing/marketplace/signing/meta/cron/health unsigned probes behave as mounted gates |
| Agency destinations | Gated `/agency` + views + admin CMS + invalid invite token (product Explicitly deferred) |

Evidence root: `media/admin/` · Report: [execution/admin-results.md](./execution/admin-results.md)

### Process coverage (executed vs incomplete)

| Process | Coverage state |
|---------|----------------|
| P-01 Signup | Partial Pass (claim verify/publish Blocked) |
| P-02 Verify / password | Partial Pass (OTP + reset-token + mail Blocked) |
| P-03 Business signup | Surfaces Pass; welcome mail Blocked |
| P-04 Onboarding | Pass (reminders) |
| P-05 Profiles | Pass (core save paths) |
| P-06 Social | UI Pass; OAuth/webhook Blocked |
| P-07 Discovery | Route Pass; shortlist/card **Fail** |
| P-08…P-11 | Partial / Pass (see collab report) |
| P-12 Signing | Blocked (no pending-sign fixture) |
| P-13 Funding | Gate Pass; new deposit actions Blocked |
| P-14…P-16 | Pass (#536 revalidate where noted) |
| P-17…P-20 | Mostly Blocked (cancellation/refund/payout money paths) |
| P-21…P-23 | Mixed — monthly/surfaces Pass; annual/upgrade/portal/in-app invoice **Fail** |
| P-24 Messages | Pass (workroom round-trip) |
| P-25 Mentorship | Community UI Pass (nt-chase); paid path gated |
| P-26 Trust/disputes | Not newly fired (kinds mostly Blocked) |
| P-27 Admin config | Route/UI readiness Pass; deep destructive mutates avoided |
| P-28 Consistency | Light checks only in slices |

**IPS-25 Pass highlights (formerly Not tested):** public marketing/legal/card routes; creator analytics/media-kit/KYC; business intelligence + nav; places/QR APIs; several job kinds listed operable; gates observed (`financial_reports`, `paid_mentoring`, mobile Log in hidden). Full chase detail: [not-tested-chase-results.md](./execution/not-tested-chase-results.md).

---

## 2) Defects found (Fail list with evidence)

Seventeen matrix rows are **Fail**. Evidence paths are under [media/](./media/) ([INDEX](./media/INDEX.md)). #537 COR-SEC-01 is **merged** @ `5a5f4c0`; audit evidence still shows pre-deploy hints @ `40b6288` — live redeploy + rotation unconfirmed. **Fail ≠ remediated.** Root-cause packaging: [remediation-plan.md](./remediation-plan.md).

| Inventory ID | Defect ID | Summary | Evidence |
|--------------|-----------|---------|----------|
| INV-R-006 | BILL-01 / COR-03–04 | `/pricing` annual shows amounts but **yearly Stripe price id is missing**; CTAs omitted | [billing/01-pricing-desktop.png](./media/billing/01-pricing-desktop.png); [40-pricing-annual.png](./media/billing/40-pricing-annual.png) |
| INV-A-070 | BILL-01 | Annual checkout branch unusable (missing year price) | [12-billing-member.png](./media/billing/12-billing-member.png); [40-pricing-annual.png](./media/billing/40-pricing-annual.png); [41d-billing-annual-ctas.png](./media/billing/41d-billing-annual-ctas.png) |
| INV-A-072 | BILL-01 | Month↔year interval switch unavailable | [41d-billing-annual-ctas.png](./media/billing/41d-billing-annual-ctas.png) |
| INV-A-073 | BILL-03 | Upgrade to Pro: **Save a Stripe price before this change** | [44c-upgrade-dialog.png](./media/billing/44c-upgrade-dialog.png) |
| INV-A-074 | BILL-05 | Admin customer portal **On**; member **Manage billing** absent | [32-admin-billing.png](./media/billing/32-admin-billing.png); [12-billing-member.png](./media/billing/12-billing-member.png) |
| INV-C-004 | BILL-05 | `customer_portal` gate ineffective on member path | same as INV-A-074 |
| INV-D-006 | BILL-04 / COR-24 | Billing history COMPLETED rows; **no in-app invoice/PDF download** | [12-billing-member.png](./media/billing/12-billing-member.png) |
| INV-R-074 | COR-SEC-01 | Public `/admin/login` showed default super-admin hint + email prefill on live @ `40b6288`; #537 merged `5a5f4c0` — redeploy + rotation unconfirmed | [admin/01-admin-login-public.png](./media/admin/01-admin-login-public.png) |
| INV-R-119 | ADMIN-MAIL-FAILED | Mail health: **Failed mail jobs: 32** while SMTP ready | [admin/06-admin-mail-health.png](./media/admin/06-admin-mail-health.png); [60-mail-health-detail.png](./media/admin/60-mail-health-detail.png) |
| INV-D-003 | INV-D-003 | Intelligence export returns **JSON**, not CSV | [admin/export-INV-D-003.bin](./media/admin/export-INV-D-003.bin) |
| INV-A-102 | INV-D-003 | Finance/intelligence export path same JSON≠CSV defect | [14-admin-intelligence.png](./media/admin/14-admin-intelligence.png); export bin above |
| INV-I-014 | INV-D-003 | `/api/intelligence/export` JSON≠CSV | export bin above |
| INV-P-001 | COR-13 | Discover card modal / `/c/` links blocked by **Sample directory** | [auth/retest-P-07-*.png](./media/auth/); `P-07-discover-*.png` |
| INV-A-035 | COR-13 | No Shortlist CTA for signed-in business (demo directory) | [auth/retest-P-07-discover-business.png](./media/auth/retest-P-07-discover-business.png) |
| INV-C-008 | COR-13 | `public_pages_live` / demo mode active — blocks booking/shortlist | same Discover evidence |
| INV-J-020 | **RC-JOBS** / JOBS-SWEEP-NEVER *(IPS-25)* | `invitation_followup_sweep` on `/admin/jobs`: **latest: never** + crontab/CRON_SECRET warning | [nt-chase/inv-j-jobs-page.png](./media/nt-chase/inv-j-jobs-page.png) · [chase report](./execution/not-tested-chase-results.md) · plan [RC-JOBS](./remediation-plan.md#rc-jobs--invitation--quote-cron-sweeps-never-ran) |
| INV-J-021 | **RC-JOBS** / JOBS-SWEEP-NEVER *(IPS-25)* | `quote_expiry_sweep` on `/admin/jobs`: **latest: never** + crontab warning | same jobs-page evidence · [chase report](./execution/not-tested-chase-results.md) · plan [RC-JOBS](./remediation-plan.md#rc-jobs--invitation--quote-cron-sweeps-never-ran) |

**Noted on Pass rows (not matrix Fail):** COR-09a dual public+admin chrome; MSG-NAV workroom Messages vs sidebar; BILL-02 business annual unavailable copy; BILL-06 Starter “Manage downgrade” → `/claim`. Tracked in slice reports for remediation planning — do not treat as closed.

**Collab slice:** no new matrix Fail rows. **IPS-25** added the two job-sweep Fails above only.

---

## 3) Retests passed (incl. #536 revalidation)

### Auth slice retests (initial Fail/noise → Pass)

| Item | Result | Evidence / note |
|------|--------|-----------------|
| INV-A-005 mobile reset request | Pass (request); token complete still Blocked | `retest-INV-A-005-reset-mobile.png` |
| INV-A-006 password form | Pass — `/account/password` redirect by design; security tab fields | `retest-password-*.png` |
| INV-A-003 mobile logout | Pass — `aria-label="Log out"` icon | `retest4-mobile-logout-*.png` |
| INV-T-002 business account tabs | Pass after fresh login (session contamination) | `retest-INV-T-002*.png` |
| INV-A-024 / INV-R-050 business profile save | Pass — precise form → `?saved=1` | `retest3-biz-profile-save.png` |
| INV-R-033 hasPassword redirect | Pass (confirmed by design) | `retest-password-*.png` |
| INV-R-034 mobile reset submit | Pass | mobile reset screenshot |

**Still Fail after retest:** P-07 shortlist / demo directory (INV-P-001, INV-A-035, INV-C-008) — reconfirmed.

### #536 / COR-20–23 revalidation (collab on live @ `40b6288`)

| Item | Result | Evidence |
|------|--------|----------|
| COR-21 deliverable download (INV-D-001) | **Pass** — influencer + business 200 / 2015041 bytes; signed-out 401 | `media/collab/desktop-*-download-status.txt`; `signed-out-deny.txt` |
| COR-22 “Saved as https://…” link normalize | **Pass** | Review hub note + green `https://agboolaolomola.com` (collab manual shots) |
| COR-23 separated Request changes / Approve (INV-A-059, INV-A-060) | **Pass** | `manual/cor23-request-changes-step.png`; `manual/cor23-approve-after-click.png`; `manual/biz-review-hub-focus.png` |
| COR-20 soft-error / upload retry | **Not re-run** — waiting-review milestones; avoided mutating fixture (same skip as deployed smoke) | Prior pack retained under `media/cor-20-23-deployed-smoke/` |

Approve confirm / release and request-changes **submit** were not confirmed (would mutate production audit fixture).

### Billing revalidation

| Item | Result |
|------|--------|
| Hosted Stripe invoice/PDF (INV-D-005) | **Pass** — provider-confirmed revalidate |
| Annual missing year price (BILL-01 / COR-03–04) | **Fail reconfirmed** (not a pass) |

---

## 4) Unresolved limitations (Blocked + Not tested)

### 4a. Blocked (162) — cannot execute; not Pass

**Not tested = 0** after IPS-25; unresolved execution gaps are **Blocked** (plus Fail in §2). Pre-chase Blocked (129) plus **33** chase Blockeds = **162**. Themes:

| Blocker | Notes / examples |
|---------|------------------|
| **No live mail sink / Mailpit** | Claim verify/publish; OTP/reset complete; most INV-E-* delivery; notification kinds needing email proof; INV-I-019 |
| **Live deposits closed** (`journey_funding`) | Fund/checkout/release/refund/payout money paths; related payout/refund notices & emails |
| **Fixture / UI gaps (slices)** | Pending native sign; payments dialog tabs; cancel/settlement; withdraw; team send/respond; valid invite token |
| **Fixture / UI gaps (IPS-25)** | Deep-link ids (applications/openings/records); collab mutations needing quote/series/dispute/inquiry; AI tailor off; NoticeDialog not triggered; dashboard-own milestone path; `invitation_email` not listed until enqueued |
| **Notification kinds not fireable** | INV-N-023…026, 029…034 (ops/dispute) — no live fire / no centre match |
| **Provider / OAuth** | Meta webhook; social OAuth |
| **Shared-host isolation** | INV-J-022 subscription renewal sweep; related cron isolation |
| **SMS** | INV-N-103 not exercised |
| **Destructive / demo gates** | INV-C-013 unpublished check blocked by demo Discover; INV-C-015 delete not executed on funded fixture |

Authoritative row list: [coverage-matrix.md](./coverage-matrix.md). Chase Blocked detail: [not-tested-chase-results.md](./execution/not-tested-chase-results.md).

### 4b. Remaining Not tested — **none** (IPS-25 complete)

| Metric | Value |
|--------|------:|
| Not tested (matrix) | **0** |
| IPS-25 status | **Complete** |
| Chase report | [execution/not-tested-chase-results.md](./execution/not-tested-chase-results.md) |

Former Not tested IDs were closed to Pass (54), Fail (INV-J-020/021), or Blocked (33) — never folded into aggregate Pass without evidence.

### 4c. Explicitly deferred (10) — Agency product

`INV-R-072/073`, `INV-M-010`, `INV-T-016`, `INV-A-080/081`, `INV-AG-001…004` — destination checks only; **not** full Agency product coverage. (`INV-AG-005` destination Pass.)

### 4d. Global constraints (unchanged)

- Live collaboration **deposits closed** — money-movement journeys cannot be completed on production fixtures.
- **No Mailpit** on live — email delivery remains unproven except SMTP-accepted `mail_test`.
- Agency product deferred by scope.
- Destructive admin CMS / approve-release / dispute fires avoided on shared live data.
- Matrix status closed ≠ product remediated: **17 Fail** still open.

---

## Sources & next steps

| Doc | Role |
|-----|------|
| [inventory.md](./inventory.md) | Surfaces inventoried |
| [process-map.md](./process-map.md) | P-01…P-28 |
| [coverage-matrix.md](./coverage-matrix.md) | Row-level status (authoritative) |
| [execution/not-tested-chase-results.md](./execution/not-tested-chase-results.md) | IPS-25 NT chase (complete) |
| [execution/*](./execution/) | Slice narratives + defect tables |
| [remediation-plan.md](./remediation-plan.md) | Phase C **provisional** plan (17 Fail + blocked deps; not remediated until GitHub pack + impl) |
| Prior [docs/e2e-audit/](../e2e-audit/), [docs/remediation-pack/](../remediation-pack/) | Historical only — not substitute for this reopen |

**Status language:** Phase B matrix coverage is closed (Not tested = 0), but the platform is **not** fully remediated or platform-wide complete — **17 Fail** and **162 Blocked** remain. [remediation-plan.md](./remediation-plan.md) is **provisional** until the Audit package GitHub worker commits the evidence pack (must include the expanded plan). Do not open new product PRs from the plan alone; live deposits stay closed.
