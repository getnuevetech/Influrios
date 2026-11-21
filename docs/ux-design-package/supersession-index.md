# Supersession index — #533 vs the remediation train (#540) and audit (#539)

**Status:** Draft. This index says which parts of this package still apply. It approves nothing.
**Revision:** 2026-11-21. Ownership gaps resolved per Ola: inbox dedupe and terminology now belong to Package 1. #533 stays a **draft reference** until every retained requirement is transferred and linked (§7).
**As of:** 2026-11-21
**Compared against:** [#540](https://github.com/getnuevetech/Influrios/pull/540) `docs/ux-remediation/` (Package 1 + master spec) · [#539](https://github.com/getnuevetech/Influrios/pull/539) `docs/full-platform-audit/` (matrix at `ccc4fc3`)
**Note:** this branch is based on `e98cea9`, which is older than `main` (`5a5f4c0`). It is a docs-only branch, and `main` has not changed any file under `docs/ux-design-package/`.

## Legend

| Status | Meaning |
|--------|---------|
| **Transferred → Pkg 1** | Requirement now lives in #540 Package 1. Link given. |
| **Superseded** | #540 now owns the rule. Do not implement from #533 for this item. |
| **Retained** | #533 is still the source. #540 references it or doesn't touch it. |
| **Re-homed → Pkg N** | Still valid as input. The final design comes in remediation Package N (#540 train). |
| **Evidence only** | Historical visual-audit evidence. Status of record lives in #539's matrix. |
| **Gap** | Neither #533 nor #540 covers it yet. A decision is needed. |

---

## 1. Issue register

| #533 issue | Status | Now governed by | Notes |
|-----------|--------|-----------------|-------|
| MOBILE-NAV-001 | **Retained** | #533 `designs/mobile-public-nav.*` | #540 master-spec §6 "Public mobile" keeps it explicitly |
| MOBILE-LOGIN-001 | **Retained** | Same | Same |
| MEMBER-MOBILE-NAV-001 | **Superseded** | #540 master-spec §6 (signed-in mobile) · board `mobile-auth-nav` · MOB1 · P1-T8 | More drawer replaces "chips or drawer" option |
| BADGE-COUNT-001 | **Superseded** | #540 master-spec §1 single projection + §3 badge semantics · board `sidebar-badges` · DB1 | Audit confirmed as INV-DC-001 (#539) |
| INBOX-DUP-001 | **Transferred → Pkg 1** | [#540 master-spec §7](https://github.com/getnuevetech/Influrios/blob/cursor/ux-pkg1-design-boards-9268/docs/ux-remediation/master-spec.md#7-action-inbox-deduplication-package-1-from-533-inbox-dup-001) · [action-inbox board](https://github.com/getnuevetech/Influrios/blob/cursor/ux-pkg1-design-boards-9268/docs/ux-remediation/package-01/designs/action-inbox.html) · INB1 | Task identity = (collaboration, milestone/invitation, action kind). Distinct tasks preserved; duplicate representations merged |
| ADMIN-KPI-001 | **Re-homed → Pkg 5** | — | Active Collaborations definition must match the Package 1 active projection (DB3) |
| ADMIN-WEBHOOK-001 | **Re-homed → Pkg 5** | #540 master-spec ledger/reconciliation scope | Webhook health feeds the gateway reconciliation requirement |
| ADMIN-MOBILE-001 | **Re-homed → Pkg 5** | — | |
| DUAL-CHROME-001 | **Re-homed → Pkg 5** | — | #539 lists it as COR-09a (non-Fail follow-up) |
| REQUEST-POPUP-001 | **Re-homed → Pkg 2** | #533 `designs/requests.*` is the starting input | Centered popup rule reaffirmed in #540 master-spec §7 |
| ACTIVE-OVERVIEW-001 | **Re-homed → Pkg 2** | #533 `designs/active-collaborations.*` | Same |
| TAX-MODEL-001 | **Re-homed → Pkg 3** | #533 `designs/tax-admin-plans.*` | |
| CHECKOUT-TOTALS-001 | **Re-homed → Pkg 3** | — | Still Blocked (sandbox); see #539 RC-CATALOG |
| AGENCY-PLAN-001 | **Re-homed → Pkg 3** | — | Agency stays deferred |
| MSG-REPLY-001 | **Re-homed → Pkg 4** | #533 `designs/messages.md` (notes only) | |
| CONTRACT-VIEW-001 | **Re-homed → Pkg 4** | #533 `designs/contracts.*` | |
| DISCOVER-SAMPLE-001 | **Re-homed → Pkg 4** | — | #539 RC-DISCOVERY (INV-C-008) |
| CARD-VANITY-001 | **Re-homed → Pkg 4** | — | Original influencer card preserved |
| FOOTER-AGENCY-001 | **Retained** | #533 | Public chrome; Agency deferred |
| TERM-CREATOR-001 | **Transferred → Pkg 1** | [#540 master-spec §6](https://github.com/getnuevetech/Influrios/blob/cursor/ux-pkg1-design-boards-9268/docs/ux-remediation/master-spec.md#6-navigation-and-terminology) · TERM1 | “Discover Influencers”; no customer-facing “Creator” |

## 2. Acceptance checklist

| #533 acceptance | Status | Replacement |
|-----------------|--------|-------------|
| A-MOBILE-01, A-MOBILE-02 | Retained | — |
| A-MEMBER-MOBILE-01 | **Superseded** | MOB1 |
| A-BADGE-01 | **Superseded** | DB1 (+ DB2 for the Earnings badge) |
| A-INBOX-01 | **Transferred → Pkg 1** | INB1 |
| A-REQ-01…04, A-ACTIVE-01…03 | Re-homed → Pkg 2 | — |
| A-TAX-01…03, A-CHECKOUT-01, A-PRICE-01, A-AGENCY-PLAN-01 | Re-homed → Pkg 3 | — |
| A-MSG-01, A-CONTRACT-01, A-DISCOVER-01, A-CARD-01, A-CARD-FULL-01 | Re-homed → Pkg 4 | — |
| A-ADMIN-MOBILE-01, A-ADMIN-CHROME-01, A-ADMIN-KPI-01, A-ADMIN-HOOK-01 | Re-homed → Pkg 5 | — |
| A-TERM-01 | **Transferred → Pkg 1** | TERM1 |
| A-FOOTER-01 | Retained | — |

## 3. Implementation backlog (#533 packages 1–14)

| #533 package | Status | Now |
|--------------|--------|-----|
| 1 UX-P1 Mobile public chrome | Retained | — |
| 2 Requests list→popup · 3 Active overview | Re-homed → Pkg 2 | — |
| 4 UX-P2 Member mobile chrome | **Superseded** | #540 P1-T8 |
| 5 Admin chrome · 12 Ops metrics/webhook | Re-homed → Pkg 5 | — |
| 6 Messages · 7 Contracts · 11 Vanity/footer · 13 Live Discover | Re-homed → Pkg 4 (footer retained here) | Terms → #540 P1-T13 |
| 8 Tax · 9 Pricing · 14 Sandbox checkout | Re-homed → Pkg 3 | — |
| 10 Inbox dedupe + badges | **Transferred → Pkg 1** | Badges: #540 P1-T1/P1-T9 · dedupe: #540 P1-T12 |
| "Suggested ship order" | **Superseded** | #540 `docs/ux-remediation/README.md` package order (1→5) |

## 4. Shared UI spec and navigation map

| Section | Status | Now governed by |
|---------|--------|-----------------|
| shared-ui-spec §1 header, §3 filters, §4 tables, §6 forms, §8 confirmations, §9 money/dates | Retained | #533 |
| §2 Navigation, authenticated member badges | **Superseded** | #540 master-spec §3, §6 |
| §5 Status badges | Retained + extended | #540 master-spec §2 adds payout/invitation labels and forbidden pairings |
| §7 Empty/loading/error/success | **Superseded for Package 1 surfaces**; retained elsewhere | #540 master-spec §8 + `states` board |
| §10 Notifications & action counts | **Superseded** | #540 master-spec §3, §5 |
| §11 Centered popups | Retained (reaffirmed) | #540 master-spec §7 cites it |
| §12 Influencer card | Retained (unchanged) | — |
| §13 Pricing · §14 Tax | Re-homed → Pkg 3 | — |
| navigation-map Public | Retained | — |
| navigation-map Influencer "Mobile" line | **Superseded** | MOB1 |
| navigation-map Business / Agency | Retained | Business badge discipline added by #540 P1-T9 |
| navigation-map Admin | Re-homed → Pkg 5 | — |

## 5. Evidence and coverage files

| File | Status |
|------|--------|
| coverage-matrix.md, coverage-gaps.md, journey-reviews.md | **Evidence only.** #539's matrix is the status of record where rows overlap |
| evidence.md, baseline.md, deltas/, `media/visual-audit-deltas/2026-11-18/` | Evidence only (still valid "before" captures) |
| product-requirements.md | Retained (Ola §7 requirements) |

## 6. Resolved decisions (Ola, 2026-11-21)

1. **INBOX-DUP-001 / A-INBOX-01** → Package 1. Dedupe must keep genuinely distinct tasks separate and stop duplicate representations of the same task.
2. **TERM-CREATOR-001** → Package 1. Customer-facing navigation uses “Influencer”.
3. **This PR stays draft** as reference until the retained requirements below are transferred into their packages and linked back here.

## 7. Transfer tracker (close #533 only when every row is linked)

| Retained requirement (#533) | Target | Transferred | Link |
|-----------------------------|--------|:-----------:|------|
| Inbox dedupe (INBOX-DUP-001, A-INBOX-01) | Pkg 1 | ✅ | [master-spec §7](https://github.com/getnuevetech/Influrios/blob/cursor/ux-pkg1-design-boards-9268/docs/ux-remediation/master-spec.md#7-action-inbox-deduplication-package-1-from-533-inbox-dup-001) |
| Influencer terminology (TERM-CREATOR-001, A-TERM-01) | Pkg 1 | ✅ | [master-spec §6](https://github.com/getnuevetech/Influrios/blob/cursor/ux-pkg1-design-boards-9268/docs/ux-remediation/master-spec.md#6-navigation-and-terminology) |
| Member mobile nav (MEMBER-MOBILE-NAV-001) | Pkg 1 | ✅ | [mobile-auth-nav](https://github.com/getnuevetech/Influrios/blob/cursor/ux-pkg1-design-boards-9268/docs/ux-remediation/package-01/designs/mobile-auth-nav.html) |
| Badge semantics (BADGE-COUNT-001) | Pkg 1 | ✅ | [master-spec §3](https://github.com/getnuevetech/Influrios/blob/cursor/ux-pkg1-design-boards-9268/docs/ux-remediation/master-spec.md#3-badge-semantics) |
| Public mobile nav + login (MOBILE-NAV-001, MOBILE-LOGIN-001, A-MOBILE-01/02) | Pkg 1 reference (kept in #533) | ☐ | — |
| Footer Agency (FOOTER-AGENCY-001, A-FOOTER-01) | Pkg 1 reference (kept in #533) | ☐ | — |
| Shared UI spec §1, §3, §4, §6, §8, §9, §11, §12 | Master spec (all packages) | ☐ | — |
| Requests / Active popups (REQUEST-POPUP-001, ACTIVE-OVERVIEW-001, A-REQ, A-ACTIVE) | Pkg 2 | ☐ | — |
| Tax, checkout, pricing, Agency plan (§13, §14; A-TAX, A-CHECKOUT, A-PRICE, A-AGENCY-PLAN) | Pkg 3 | ☐ | — |
| Messages, contracts, Discover, vanity card (A-MSG, A-CONTRACT, A-DISCOVER, A-CARD, A-CARD-FULL) | Pkg 4 | ☐ | — |
| Admin chrome, mobile, KPI, webhook (A-ADMIN-*) | Pkg 5 | ☐ | — |
| Product requirements (Ola §7) | Master spec | ☐ | — |
