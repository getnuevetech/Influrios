# Remediation status

**As of:** 2026-11-23 · live influrios.com on `7d3e16b` (main)
**Replaces as status source:** the "Status" columns in [ux-remediation/](./ux-remediation/) (#540) and [full-platform-audit/](./full-platform-audit/) (#539). Those folders keep the specs, flows and the historical audit record; this page says what is built, what is open and what needs a retest.
**Former PRs:** #533 (UX design package), #539 (full-platform audit), #540 (Package 1 design boards) were consolidated here. Their screenshots stay on the original branches and are linked from the docs.

---

## 1. What changed since the audit

The audit (#539) was recorded on live `40b6288` with **live collaboration deposits closed** and a simulated funding path. Since then:

| Area | Now | PRs |
|------|-----|-----|
| Collaboration funding | Stripe Checkout into the Collaborations account. Test keys move sandbox money; while Stripe uses test keys only allowlisted test accounts can fund; live keys also need the launch approvals and a recorded test transaction | #563, #569 |
| Payment methods by amount | USD: card or ACH up to $5,000 (business chooses), ACH from $5,000, wire or bank transfer from $25,000; other currencies card. Limits editable in Marketplace settings | #570, #571 |
| Milestone release | Influencer net to their Stripe Connect account and the milestone fees to the Operations account, both tied to the original charge; Stripe's refusal reason shown on the admin payout row; manual and automatic release switches | #565, #570, #572, #574, #576 |
| Simulated funding | Removed entirely (`sandbox_ledger_hold`, settlement simulator, `COLLABORATION_SANDBOX_LEDGER_HOLD`) | #573 |
| Staged / recurring funding | Removed | earlier |
| KYC and payouts (US) | Stripe Connect Express is the KYC and payout rail; KYC recorded once when Stripe verifies | #566 |
| Subscriptions | Paid into the Collection connected account | #566 |
| Admin finance | Contract ledger + Gateway & bank reconciliation (approved design), top-ups explained | #564, #575 |
| Background jobs | Sweeps run inside the app every 5 minutes; failed emails visible with retry | #562 |
| Emails | Every collaboration email opens the page it is about; influencer payout receipt page; real figures; branded signing emails | #577, #579 |

**Verified on influrios.com (Stripe sandbox, 2026-11-23):** test deal C-0002, $551.25 paid by card through Checkout → webhook confirmed → milestone 1 released automatically ($194.74 to the influencer, $15.00 fees to Operations) → milestone 2 released through the manual gate (switches off: approve, then send; nothing sent by the sweep in between). Contract ledger and reconciliation show the movements.

---

## 2. Package 1 (#540 backlog)

| Task | What | Status | Where |
|------|------|--------|-------|
| P1-D1, P1-T1 | Invitation turn tracking; one "waiting for your reply" count for home, hub, inbox, badge | **Done** | S1 `bd65bb9` |
| P1-AUD-10, P1-T19 | Same action matrix on popup and detail page; signed-out link returns to the item | **Done** | S1 |
| P1-AUD-01…05, P1-T20 | Withdraw/expire clear tasks and notify; team invitations in hub and inbox; closed proposals; withdrawal reason | **Done** | S2 `d57e2fa` |
| — | Business sees questions/responses to answer; event-based notices | **Done** | `879a2d2`, `dd43b6d` |
| P1-AUD-06 | In-app notices for revision requested / approved / auto-approved | **Done** | collab notices |
| P1-AUD-08 | Approval not blocked by payout setup; payout waits; "Approved · payout setup required" | **Done** | #578 |
| P1-T2 | Six payout states shared by home, hub, Earnings, badge; saved account ≠ Ready | **Done** | #580 |
| P1-T8 | Fixed four-slot mobile nav + More drawer | **Done** (checked at 320/390 px locally) | #581 |
| P1-T13 | "Discover Influencers", no customer-facing "Creator" | **Done** | |
| P1-T3 | One active-collaboration filter home ↔ hub | **Likely done** (home derives from the hub list) — retest | |
| P1-T12, P1-AUD-07 | Inbox dedupe by task; rows name collaboration + milestone | **Partly** — dedupe by key exists; naming to verify | |
| P1-T5 | "Couldn't confirm" recovery with an idempotency record | **Partly** — stale/repeat submissions are rejected server-side; recovery screen not built | |
| P1-AUD-11 | Who acts next after accept and signature (signer-specific tasks) | **Partly** — "preparing the agreement" exists; per-signer tasks not built | |
| P1-T17 | Accept persists before agreement preparation; "agreement not sent" retry | **Open** | |
| P1-AUD-09 | Business Collaborations badge counts review tasks only | **Open** | |
| P1-AUD-12 | Bell count / Unread update immediately after opening a notice | **Open** — verify live first | |
| P1-T9, P1-T14, P1-T15 | Business dashboard, home card, visual parity vs boards | **Needs visual review** against the boards | |
| P1-T10, P1-T16 | Playwright + shared fixtures across surfaces | **Open** | |
| P1-T11, P1-T18 | Destinations explain badges; mobile tabs/affordances | **Open** (P1-T18 active-item rule done in #581) | |

---

## 3. Audit root causes (#539, baseline `40b6288`)

**Matrix as recorded:** [coverage-matrix.md](./full-platform-audit/coverage-matrix.md) has 502 rows — 403 Pass · 35 Fail · 54 Blocked · 10 Explicitly deferred (counted from the rows; other totals quoted in older sections, e.g. "24 Fail" or "378 Pass", are earlier snapshots). The rows have not been re-run since the changes in §1.

| Root cause | Fail rows | Status now |
|------------|-----------|------------|
| RC-SEC admin bootstrap hint | INV-R-074 | **Fixed live** — no hint or prefill on `/admin/login` (checked 2026-11-23). Credential rotation is an owner task |
| RC-CATALOG annual / upgrade prices | INV-R-006, A-070, A-072, A-073 | **Open — admin data**: save yearly and upgrade Stripe prices on each plan (do not invent amounts) |
| RC-PORTAL "Manage billing" missing | INV-A-074, C-004 | **Retest** — the button shows when the portal switch is on **and** the member has a Stripe customer |
| RC-INVOICE invoice download | INV-D-006 | **Open** — no download in billing history |
| RC-DISCOVERY sample directory | INV-P-001, A-035, C-008 | **Open — switch**: live Discover still shows "Sample directory" (`public_pages_live` off) |
| RC-MAIL failed mail backlog | INV-R-119 | **Retest** — failed emails now listed with retry (#562) |
| RC-JOBS sweeps never ran | INV-J-020, J-021 | **Fixed** — all sweeps succeed every 5 minutes on live (#562) |
| RC-EXPORT JSON ≠ CSV | INV-D-003, I-014, A-102 | **Fixed in code** — export returns `text/csv`; retest |
| RC-DASHBOARD | INV-DC-001/002/006/012/013/014/015, C-014, N-004, A-048 | **Mostly fixed** (§2); retest on live |

**"No UI" rows** (refresh suggestions, inquiry thread, managed match, member dispute entry, request cancellation, convert to ambassador, media-kit export): each needs a decision — build, or mark out of scope.

**Blocked rows** that cited "live deposits closed" are no longer blocked by that gate; they need a run against the Stripe sandbox flow.

---

## 4. Carried from #533 (still open)

| ID | Issue | Status |
|----|-------|--------|
| MOBILE-NAV-001 / MOBILE-LOGIN-001 | Public mobile header: menu and Log in | Retest on live |
| CARD-VANITY-001 | `/c/ag` returns 404 | **Open** (checked live 2026-11-23) |
| AGENCY-PLAN-001 / FOOTER-AGENCY-001 | Agency offered while deferred | **Open** — pricing still lists "Agency workspace" |
| DUAL-CHROME-001 | Admin pages show the marketing header and the admin sidebar | **Open** |
| ADMIN-KPI-001 | Admin KPIs disagree with member reality | Retest |

---

## 5. Next

1. P1-AUD-11 / P1-T17, P1-AUD-09, P1-AUD-12.
2. Re-run the #539 Fail and Blocked rows on influrios.com against the Stripe sandbox flow and refresh the matrix.
3. Owner decisions: support page or address for email "contact support" links; "No UI" rows; Discover live profiles switch; Agency on pricing; yearly prices.
