# Supersession index — #533 vs the remediation train (#540) and audit (#539)

**Status:** Draft. This index says which parts of this package still apply. It approves nothing.
**As of:** 2026-11-21
**Compared against:** [#540](https://github.com/getnuevetech/Influrios/pull/540) `docs/ux-remediation/` (Package 1 + master spec) · [#539](https://github.com/getnuevetech/Influrios/pull/539) `docs/full-platform-audit/` (matrix at `ccc4fc3`)
**Note:** this branch is based on `e98cea9`, which is older than `main` (`5a5f4c0`). It is a docs-only branch, and `main` has not changed any file under `docs/ux-design-package/`.

## Legend

| Status | Meaning |
|--------|---------|
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
| INBOX-DUP-001 | **Gap (partial)** | #540 master-spec §1 "Action-required" row covers agreement, **not** dedupe | Carry A-INBOX-01 (≤1 task per fundingId + action kind) into Package 1 acceptance or Package 2 |
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
| TERM-CREATOR-001 | **Gap** | — | Nav copy. Not in #540 Package 1. Assign to Package 1 nav copy or Package 4 |

## 2. Acceptance checklist

| #533 acceptance | Status | Replacement |
|-----------------|--------|-------------|
| A-MOBILE-01, A-MOBILE-02 | Retained | — |
| A-MEMBER-MOBILE-01 | **Superseded** | MOB1 |
| A-BADGE-01 | **Superseded** | DB1 (+ DB2 for the Earnings badge) |
| A-INBOX-01 | Retained (gap in #540) | Add to Package 1/2 acceptance |
| A-REQ-01…04, A-ACTIVE-01…03 | Re-homed → Pkg 2 | — |
| A-TAX-01…03, A-CHECKOUT-01, A-PRICE-01, A-AGENCY-PLAN-01 | Re-homed → Pkg 3 | — |
| A-MSG-01, A-CONTRACT-01, A-DISCOVER-01, A-CARD-01, A-CARD-FULL-01 | Re-homed → Pkg 4 | — |
| A-ADMIN-MOBILE-01, A-ADMIN-CHROME-01, A-ADMIN-KPI-01, A-ADMIN-HOOK-01 | Re-homed → Pkg 5 | — |
| A-TERM-01 | Gap | — |
| A-FOOTER-01 | Retained | — |

## 3. Implementation backlog (#533 packages 1–14)

| #533 package | Status | Now |
|--------------|--------|-----|
| 1 UX-P1 Mobile public chrome | Retained | — |
| 2 Requests list→popup · 3 Active overview | Re-homed → Pkg 2 | — |
| 4 UX-P2 Member mobile chrome | **Superseded** | #540 P1-T8 |
| 5 Admin chrome · 12 Ops metrics/webhook | Re-homed → Pkg 5 | — |
| 6 Messages · 7 Contracts · 11 Vanity/footer/terms · 13 Live Discover | Re-homed → Pkg 4 (footer retained here; terms = gap) | — |
| 8 Tax · 9 Pricing · 14 Sandbox checkout | Re-homed → Pkg 3 | — |
| 10 Inbox dedupe + badges | **Split** | Badges superseded by #540 P1-T1/P1-T9; dedupe = gap (A-INBOX-01) |
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

## 6. Open decisions arising from this index

1. **INBOX-DUP-001 / A-INBOX-01:** add it to Package 1 acceptance, or carry it to Package 2?
2. **TERM-CREATOR-001:** decide which package owns it.
3. Should this draft PR stay open as the Packages 2–5 input library, or be closed once those packages restate what they keep? No action until Ola decides.
