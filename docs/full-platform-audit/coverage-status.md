# Coverage completion status — full-platform audit reopen

> **Historical audit record.** Recorded against live `40b6288` (Nov 2026), when live collaboration deposits were closed and a simulated funding path existed. Both have since changed (Stripe Checkout funding; simulation removed). Current status of every row and root cause: [docs/remediation-status.md](../remediation-status.md). Screenshots referenced here stay on the [`cursor/full-platform-audit-package-b6cf`](https://github.com/getnuevetech/Influrios/tree/cursor/full-platform-audit-package-b6cf/media/full-platform-audit) branch.

**Tracker:** IPS-26 under IPS-19 · **As of:** 2026-11-21 (IPS-29/30/31 + IPS-40 + **IPS-42 evidence reconcile**)  
**Code baseline:** `main` @ `40b6288` (includes #536 COR-20–23); #537 COR-SEC-01 merged `5a5f4c0` (live redeploy + rotation unconfirmed)  
**Host:** https://influrios.com · Live collaboration deposits closed (`journey_funding`) · **IPS-31/40 sink:** isolated local Mailpit (not live)  
**Authoritative matrix:** [coverage-matrix.md](./coverage-matrix.md)  
**NT chase (IPS-25):** [execution/not-tested-chase-results.md](./execution/not-tested-chase-results.md)  
**Dashboard consistency (IPS-29):** [execution/dashboard-consistency-results.md](./execution/dashboard-consistency-results.md)  
**Mail-sink restore (IPS-31):** [execution/mail-sink-restore-results.md](./execution/mail-sink-restore-results.md)  
**Audit-continue (IPS-40 + IPS-42):** [execution/audit-continue-alongside-design-results.md](./execution/audit-continue-alongside-design-results.md)  
**Slice evidence:** [execution/auth-results.md](./execution/auth-results.md) · [execution/collab-results.md](./execution/collab-results.md) · [execution/billing-results.md](./execution/billing-results.md) · [execution/admin-results.md](./execution/admin-results.md)  
**Remediation plan (IPS-20):** [remediation-plan.md](./remediation-plan.md) — **PROVISIONAL**; **24 Fail → 9 root causes** (incl. **RC-JOBS**, **RC-DASHBOARD**); blocked deps mapped; no new product PRs; **not** platform-wide completion

> **This report does not claim the platform is fully audited, fully remediated, or platform-wide complete.** **35 Fail** and **54 Blocked** remain open after IPS-48 (S1 retest closed INV-DC-001, INV-DC-015; S2 closed INV-DC-013, INV-DC-014, INV-A-048); **Not tested = 0** after IPS-46; Agency stays Explicitly deferred; defects are not fixed by this audit. Prior Pass aggregates are **superseded** (IPS-30 demotions + IPS-31 + IPS-40 + IPS-42). Live deposits remain closed. **Do not endorse blanket IPS-40 24/24 Pass.**

---

## Acceptance criteria (IPS-30 / Ola bbc38ce)

Pass requires proof beyond control visibility. Applied in the matrix revision on #539:

| Rule | Requirement | Implication |
|------|-------------|-------------|
| **Conditional reminders** | Same account + same state: reminder presence/absence must agree with payout readiness on home / hub / earnings | Reminder cues alone ≠ Pass. INV-C-014 + INV-N-004 demoted to **Fail** (paired with INV-DC-002 / INV-A-075 Ready). |
| **Action checks** | Execute action → persistence after reload → inspect resulting record or downloaded file | Visibility of save / opt-in / save-listing / media-kit export controls ≠ functional Pass. INV-A-008, INV-A-019, INV-A-027, INV-D-007 → **Not tested**. |
| **Annual purchase** | Unavailable/error-handling UX may Pass; purchasing the configured annual plan must succeed for purchase Pass | Annual purchase rows remain **Fail** (INV-R-006, INV-A-070, INV-A-072) until year price is purchasable. |
| **Cron / jobs** | Separately prove (a) scheduler operation and (b) behavior: due invitation/quote → correct event → expected notification; no duplicate sends on rerun | Kind listed / empty or failed scan alone ≠ behavior Pass. INV-J-006/010/011/015/017 → **Not tested**. INV-J-020/021 stay **Fail**. |
| **Security** | Track code containment, deployment verification, and credential/session rotation as separate steps | Overall RC-SEC / INV-R-074 stays open until all required steps complete — merged #537 ≠ closed. |

Do **not** preserve the old **287 Pass** (or post–IPS-29 **296**) where evidence only proves visibility.

---

## Snapshot (matrix header — post IPS-29 + IPS-30 + IPS-31 + IPS-40 + IPS-42)

| Status | Count | Meaning here |
|--------|------:|--------------|
| Pass | **403** | Required cases executed; expected met (incl. IPS-31/40 isolated Mailpit; IPS-42 narrowed notify/View Passes) |
| Fail | **35** | Defect with evidence — see §2 (IPS-47 closed INV-DC-001, INV-DC-015; IPS-48 closed INV-DC-013, INV-DC-014, INV-A-048) |
| Blocked | **54** | IPS-44 executed 5 Blocked rows on the isolated r5 host; INV-N-016T newly Blocked |
| Not tested | **0** | all executed (IPS-44/45) |
| Explicitly deferred | 10 | Agency product entries only (destination checks recorded) |
| **Matrix rows** | **502** | IPS-43 split hidden gaps into tracked rows (+9) |

**IPS-29 delta (+17 INV-DC-* rows):** +9 Pass · +5 Fail · +3 Blocked.  
**IPS-30 demotions from Pass:** −11 Pass → +2 Fail · +9 Not tested.  
**IPS-31 mail-sink restore:** +70 Pass · −70 Blocked (isolated Mailpit; 15 MAIL_SINK + 14 deposit+mail remain Blocked).  
**IPS-40 audit-continue:** +24 Pass / −15 Blocked / −9 NT (pre-reconcile).  
**IPS-42 evidence reconcile:** −1 Pass → +1 NT (INV-J-010); INV-D-007 View/Export split; INV-N-010…017/027 Pass narrowed to delivery isolation.  
**IPS-45 isolated r5 round 2:** 37 remaining ready rows → +14 Pass · +10 Fail · 8 still Blocked · 5 not run. [Results](./execution/r5-isolated-round2-results.md).  
**IPS-44 isolated r5 run:** 10 Package 1 checks executed → +4 Pass (INV-DC-010, INV-A-031, INV-N-013T, INV-J-010) · +5 Fail (INV-DC-013, INV-DC-014, INV-A-048, INV-N-015T, INV-N-017T) · INV-N-016T Blocked. [Results](./execution/r5-isolated-package1-results.md).  
**IPS-43 hidden-gap split:** +9 rows → +4 Blocked · +5 Not tested (Pass unchanged). INV-D-007E export; INV-N-0xxT originating triggers linked to INV-A-050/057/058/059/060/066 and INV-J-010; INV-N-014 trigger = INV-J-011.  
**Chase delta (89 former Not tested, IPS-25):** historically 54 Pass · 2 Fail · 33 Blocked — several of those Passes demoted under IPS-30.

**Slices completed:** auth (P-01…P-07), collab (P-08…P-18 + #536 revalidate), billing (P-21…P-23), admin (P-27* + messages/notifications/jobs/email/integrations), **nt-chase (IPS-25)**, **dashboard consistency (IPS-29)**, **mail-sink restore (IPS-31)**.

---

## 1) Coverage completed (what was tested)

Executed work that reached **Pass** (or deliberate gate observation) across slices **plus IPS-25 nt-chase**, minus IPS-30 demotions. Detail lives in the matrix Actual/Evidence columns, slice reports, [not-tested-chase-results.md](./execution/not-tested-chase-results.md), and [dashboard-consistency-results.md](./execution/dashboard-consistency-results.md).

### Auth (IPS-21) — P-01…P-07

| Area | What passed |
|------|-------------|
| Signup / register | Validation, create account → `/account/verify`; `/register` alias; claim **start** form |
| Login / logout | Influencer → `/creator`, business → `/business/home`; bad password reject; desktop + mobile logout |
| Password surfaces | Reset **request** (`?sent=1`); set-password redirect when `hasPassword`; `/account?tab=security` change form |
| Verify UI | Code + resend present; **IPS-31** OTP complete Pass on isolated Mailpit |
| Profiles | Influencer dashboard/details/social/links tabs; details save; business profile save (`?saved=1`) |
| Discovery routes | `/discover`, `/categories` load (shortlist/card **Fail** — §2) |
| Business marketing | `/business` form + consent |

Evidence root: `media/full-platform-audit/auth/` · Report: [execution/auth-results.md](./execution/auth-results.md)

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

Evidence root: `media/full-platform-audit/collab/` · Report: [execution/collab-results.md](./execution/collab-results.md)

### Billing (IPS-23)

| Area | What passed |
|------|-------------|
| Billing shells | Guest/member `/billing`; success/cancel auth gates; business billing/plans monthly UI |
| Admin billing ops | Plans editor (incl. annual fields), billing activity (Stripe·Sandbox), discounts create UI, finance, marketplace destination |
| Tax / auto-renew display | Tax lines on cards; Auto-renewal On shown |
| Connect setup UI | Earnings payout setup Ready (surface) — **does not** clear INV-C-014 / INV-DC-002 contradiction |
| Hosted invoice | Stripe invoice `in_1UddzZ…` paid + hosted URL + PDF (**provider-confirmed**) |
| Agency CTA destination | Upgrade CTA present / not silent 404 (product still deferred) |

Annual **purchase** remains **Fail** (BILL-01) until year Stripe price is purchasable — error/unavailable UX may Pass separately.

Evidence root: `media/full-platform-audit/billing/` · Report: [execution/billing-results.md](./execution/billing-results.md)

### Admin / messages / notifications / jobs / email / integrations (IPS-24)

| Area | What passed |
|------|-------------|
| Admin routes | Authenticated load for probed admin pages (48/48 in slice), menus SIDE_GROUPS, accounts tabs, payment-settings sections |
| Mail ops | SMTP ready; **79/79** templates listed; admin Send test → `mail_test` **SUCCEEDED**; cron sweeps endpoint **401** without secret |
| Jobs UI | Kinds listed; historical succeeded where present; retry copy — **behavior Pass** for invitation/quote sweeps still open (INV-J-020/021 Fail; listing-only rows demoted IPS-30) |
| Messages | Workroom round-trip business ↔ influencer |
| Notifications | Bell, centre, account prefs surface, inbox consistency samples |
| Downloads | Accounts CSV, legal acceptances CSV, legal doc view |
| Webhooks (mount) | Billing/marketplace/signing/meta/cron/health unsigned probes behave as mounted gates |
| Agency destinations | Gated `/agency` + views + admin CMS + invalid invite token (product Explicitly deferred) |

Evidence root: `media/full-platform-audit/admin/` · Report: [execution/admin-results.md](./execution/admin-results.md)

### Dashboard consistency (IPS-29) — P-28 deep

| Area | Outcome |
|------|---------|
| Invitation / payout / active projections | **Fail** INV-DC-001/002/006 (home ≠ hub ≠ earnings/badge) |
| Team invite action-required | **Fail** INV-DC-012/015 (pending + no-action + no CTAs) |
| Bell / unread / badge stability / refresh / re-login | Pass INV-DC-003/004/005/020/030–033 |
| Create / withdraw / expire invite mutations | Blocked INV-DC-010/013/014 |

Evidence root: `media/full-platform-audit/dashboard-consistency/` · Report: [execution/dashboard-consistency-results.md](./execution/dashboard-consistency-results.md)

### Process coverage (executed vs incomplete)

| Process | Coverage state |
|---------|----------------|
| P-01 Signup | Partial Pass (claim verify/publish Blocked) |
| P-02 Verify / password | **IPS-31** OTP + reset-token Pass on isolated Mailpit; live host still without Mailpit UI |
| P-03 Business signup | Surfaces Pass; welcome mail Blocked |
| P-04 Onboarding | **Fail** conditional reminders (INV-C-014 / INV-N-004) |
| P-05 Profiles | Pass (core save paths); managed-intro / notif prefs functional → Not tested (IPS-30) |
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
| P-28 Consistency | **IPS-29** deep — 5 Fail / 9 Pass / 3 Blocked (+ IPS-30 reminder Fails) |

---

## 2) Defects found (Fail list with evidence)

Twenty-four matrix rows are **Fail**. Evidence paths under `docs/full-platform-audit/media/`. **Fail ≠ remediated.** Root-cause packaging: [remediation-plan.md](./remediation-plan.md).

| Inventory ID | Defect ID | Summary | Evidence |
|--------------|-----------|---------|----------|
| INV-R-006 | BILL-01 / COR-03–04 | `/pricing` annual shows amounts but **yearly Stripe price id is missing**; CTAs omitted | [billing/01-pricing-desktop.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/billing/01-pricing-desktop.png); [40-pricing-annual.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/billing/40-pricing-annual.png) |
| INV-A-070 | BILL-01 | Annual checkout branch unusable (missing year price) | [12-billing-member.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/billing/12-billing-member.png); [40-pricing-annual.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/billing/40-pricing-annual.png); [41d-billing-annual-ctas.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/billing/41d-billing-annual-ctas.png) |
| INV-A-072 | BILL-01 | Month↔year interval switch unavailable | [41d-billing-annual-ctas.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/billing/41d-billing-annual-ctas.png) |
| INV-A-073 | BILL-03 | Upgrade to Pro: **Save a Stripe price before this change** | [44c-upgrade-dialog.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/billing/44c-upgrade-dialog.png) |
| INV-A-074 | BILL-05 | Admin customer portal **On**; member **Manage billing** absent | [32-admin-billing.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/billing/32-admin-billing.png); [12-billing-member.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/billing/12-billing-member.png) |
| INV-C-004 | BILL-05 | `customer_portal` gate ineffective on member path | same as INV-A-074 |
| INV-D-006 | BILL-04 / COR-24 | Billing history COMPLETED rows; **no in-app invoice/PDF download** | [12-billing-member.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/billing/12-billing-member.png) |
| INV-R-074 | COR-SEC-01 | Public `/admin/login` still shows default super-admin hint + email prefill (code merged #537; live redeploy + rotation open) | [admin/01-admin-login-public.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/admin/01-admin-login-public.png) |
| INV-R-119 | ADMIN-MAIL-FAILED | Mail health: **Failed mail jobs: 32** while SMTP ready | [admin/06-admin-mail-health.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/admin/06-admin-mail-health.png); [60-mail-health-detail.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/admin/60-mail-health-detail.png) |
| INV-D-003 | INV-D-003 | Intelligence export returns **JSON**, not CSV | [admin/export-INV-D-003.bin](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/admin/export-INV-D-003.bin) |
| INV-A-102 | INV-D-003 | Finance/intelligence export path same JSON≠CSV defect | [14-admin-intelligence.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/admin/14-admin-intelligence.png); export bin above |
| INV-I-014 | INV-D-003 | `/api/intelligence/export` JSON≠CSV | export bin above |
| INV-P-001 | COR-13 | Discover card modal / `/c/` links blocked by **Sample directory** | [auth/retest-P-07-*.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/auth) |
| INV-A-035 | COR-13 | No Shortlist CTA for signed-in business (demo directory) | [auth/retest-P-07-discover-business.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/auth/retest-P-07-discover-business.png) |
| INV-C-008 | COR-13 | `public_pages_live` / demo mode active — blocks booking/shortlist | same Discover evidence |
| INV-J-020 | **RC-JOBS** / JOBS-SWEEP-NEVER | `invitation_followup_sweep` **latest: never** + crontab/CRON_SECRET warning | [nt-chase/inv-j-jobs-page.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/nt-chase/inv-j-jobs-page.png) |
| INV-J-021 | **RC-JOBS** / JOBS-SWEEP-NEVER | `quote_expiry_sweep` **latest: never** + crontab warning | same |
| INV-DC-001 | **RC-DASHBOARD** / DC-INVITE-MISMATCH | Home invites 1 vs hub 0 | [dashboard-consistency/re-inf-home.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/dashboard-consistency/re-inf-home.png); [re-inf-hub.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/dashboard-consistency/re-inf-hub.png) |
| INV-DC-002 | **RC-DASHBOARD** / DC-PAYOUT-MISMATCH | Home/hub Not ready vs earnings Ready | same + [re-inf-earnings.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/dashboard-consistency/re-inf-earnings.png) |
| INV-DC-006 | **RC-DASHBOARD** / DC-ACTIVE-MISMATCH | Home Active 3 vs hub Active 2 | home/hub shots |
| INV-DC-012 | **RC-DASHBOARD** / DC-ACTION-STUCK | Cannot complete invitation action-required | [re-inf-invitation-open.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/dashboard-consistency/re-inf-invitation-open.png) |
| INV-DC-015 | **RC-DASHBOARD** / DC-TEAM-INVITE-DEADEND | Pending + “No further action needed”; no CTAs | [re-inf-team-invite-detail.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/dashboard-consistency/re-inf-team-invite-detail.png) |
| INV-C-014 | **RC-DASHBOARD** / ACCEPT-CONDITIONAL *(IPS-30)* | Setup reminder cues Pass withdrawn — contradicts payout Ready | [nt-chase/inv-c-014-setup-reminders.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/nt-chase/inv-c-014-setup-reminders.png); INV-DC-002 |
| INV-N-004 | **RC-DASHBOARD** / ACCEPT-CONDITIONAL *(IPS-30)* | Setup reminders conditional not proven; paired with INV-C-014 | [admin/20-influencer-home.png](https://github.com/getnuevetech/Influrios/blob/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/admin/20-influencer-home.png) |

**Noted on Pass rows (not matrix Fail):** COR-09a dual public+admin chrome; MSG-NAV workroom Messages vs sidebar; BILL-02 business annual unavailable copy; BILL-06 Starter “Manage downgrade” → `/claim`. Tracked in slice reports — do not treat as closed.

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
| COR-22 “Saved as https://…” link normalize | **Pass** | Review hub note + green `https://agboolaolomola.com` |
| COR-23 separated Request changes / Approve (INV-A-059, INV-A-060) | **Pass** | `manual/cor23-*.png` |
| COR-20 soft-error / upload retry | **Not re-run** — waiting-review milestones; avoided mutating fixture | Prior pack under `media/cor-20-23-deployed-smoke/` |

### Billing revalidation

| Item | Result |
|------|--------|
| Hosted Stripe invoice/PDF (INV-D-005) | **Pass** — provider-confirmed revalidate |
| Annual missing year price (BILL-01 / COR-03–04) | **Fail reconfirmed** (not a pass) |

---

## 4) Unresolved limitations (Blocked + Not tested)

### 4a. Blocked (80) — cannot execute; not Pass

Authoritative count **80** after IPS-40. Themes:

| Blocker | Notes / examples |
|---------|------------------|
| **Mail sink** | Isolated Mailpit restored; claim-draft MAIL_SINK cleared IPS-40; notify-kind Pass narrowed IPS-42 (delivery isolation only). Deposit+mail money events (14) still Blocked. Live host still has no Mailpit UI. |
| **Live deposits closed** (`journey_funding`) | Fund/checkout/release/refund/payout money paths; related payout/refund notices & emails |
| **Fixture / UI gaps** | Pending native sign; payments dialog tabs; cancel/settlement; withdraw; team send/respond; valid invite token; IPS-29 invite create/withdraw/expire |
| **Notification kinds not fireable** | INV-N-023…026, 029…034 (ops/dispute) |
| **Provider / OAuth** | Meta webhook; social OAuth |
| **Shared-host isolation** | INV-J-022 subscription renewal sweep; related cron isolation |
| **SMS** | INV-N-103 not exercised |
| **Destructive / demo gates** | INV-C-013 unpublished check; INV-C-015 delete not executed on funded fixture |

Authoritative row list: [coverage-matrix.md](./coverage-matrix.md).

### 4b. Not tested (1)

- **INV-J-010** (`milestone_auto_approval`) — IPS-42 demote: both sweep runs `scanned:0` / `approved:0` while milestone ends `release_scheduled`; transition provenance unproven. Evidence retained at `media/full-platform-audit/audit-continue/inv-j-010-auto-approval.json`.
- **Related narrowed (still Pass, not NT):** INV-D-007 **Export** remains unproven (View Pass only); INV-N-010…017 / INV-N-027 Pass = delivery isolation only (not business-action emission).

See [execution/audit-continue-alongside-design-results.md](./execution/audit-continue-alongside-design-results.md).

### 4c. Explicitly deferred (10) — Agency product

`INV-R-072/073`, `INV-M-010`, `INV-T-016`, `INV-A-080/081`, `INV-AG-001…004` — destination checks only; **not** full Agency product coverage. (`INV-AG-005` destination Pass.)

### 4d. Global constraints (unchanged)

- Live collaboration **deposits closed** — money-movement journeys cannot be completed on production fixtures.
- **Live host** still has no Mailpit UI — do not treat live SMTP 250 as sink proof. **IPS-31** proved interception on isolated local Mailpit (see [mail-sink-restore-results.md](./execution/mail-sink-restore-results.md)).
- Agency product deferred by scope.
- Destructive admin CMS / approve-release / dispute fires avoided on shared live data.
- Matrix status closed ≠ product remediated: **24 Fail** still open; plan **PROVISIONAL**.

---

## Sources & next steps

| Doc | Role |
|-----|------|
| [inventory.md](./inventory.md) | Surfaces inventoried |
| [process-map.md](./process-map.md) | P-01…P-28 |
| [coverage-matrix.md](./coverage-matrix.md) | Row-level status (authoritative) |
| [execution/not-tested-chase-results.md](./execution/not-tested-chase-results.md) | IPS-25 NT chase |
| [execution/dashboard-consistency-results.md](./execution/dashboard-consistency-results.md) | IPS-29 |
| [execution/*](./execution/) | Slice narratives + defect tables |
| [remediation-plan.md](./remediation-plan.md) | Phase C **PROVISIONAL** plan (24 Fail + blocked deps) |
| Prior [docs/e2e-audit/](../e2e-audit/), [docs/remediation-pack/](../remediation-pack/) | Historical only — not substitute for this reopen |

**Status language:** Platform is **not** fully remediated or platform-wide complete — **24 Fail**, **95 Blocked**, and **9 Not tested** remain. [remediation-plan.md](./remediation-plan.md) is **PROVISIONAL**. Do not open new product PRs from the plan alone; live deposits stay closed.
