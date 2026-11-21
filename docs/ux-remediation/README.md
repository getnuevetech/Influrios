# Influrios UX remediation — design packages

**Status:** Design-only · Package 1 ready for Ola review · Packages 2–5 queued  
**Date:** 2026-11-21  
**Constraints:** Live deposits closed · Agency deferred · Preserve centered popups · Preserve original influencer card · No product implementation in this phase

This folder holds the **visual remediation design train**: boards + complete flow instructions that implementers use after each package is reviewed. It does **not** claim implementation, connected-flow retest, or platform-wide remediation complete.

**Evidence source (not completion):** full-platform audit [#539](https://github.com/getnuevetech/Influrios/pull/539) (separate PR — docs/evidence only). Matrix / RC-DASHBOARD plan live on that PR under `docs/full-platform-audit/`. This design PR does **not** merge or depend on #539.

**Prior UX package (reuse where valid):** [#533](https://github.com/getnuevetech/Influrios/pull/533) — navigation map, shared-ui-spec, mobile-public-nav. Package 1 supersedes count/badge/payout-reminder rules where audit confirmed defects.

**Master specification:** [master-spec.md](./master-spec.md) (statuses, badges, buttons, notifications — expandable per package).

---

## Package order

| # | Package | Tracker | Status | Deliverable |
|---|---------|---------|--------|-------------|
| **1** | Shared navigation, dashboards, payout readiness, notifications | IPS-35 | **For Ola review** | [package-01/README.md](./package-01/README.md) |
| 2 | Collaborations lists + centered detail/edit popups (invite / withdraw / delete / deliverable / review) | IPS-36 | Queued after pkg1 review | — |
| 3 | Pricing, billing, checkout (monthly/annual, discounts, tax, plan changes, invoices) | IPS-37 | Queued | — |
| 4 | Contracts, messages, profiles (contract presentation, conversations, original influencer card, collab entry) | IPS-38 | Queued | — |
| 5 | Admin workflows (lists, forms, permissions, config, job failures & recovery, **contract ledger + gateway/bank reconciliation** — [master-spec §10](./master-spec.md#10-admin-contract-ledger--gatewaybank-reconciliation-master-scope-requirement)) | IPS-39 | Queued | — |

Implement only after the package under review is accepted. Do not wait for every audit Blocked row to design proven dashboard/nav defects.

---

## Package 1 at a glance

| | |
|--|--|
| **Root cause** | RC-DASHBOARD |
| **Fail rows** | INV-DC-001, INV-DC-002, INV-DC-006, INV-DC-012, INV-DC-015, INV-C-014, INV-N-004 |
| **Pass rules to preserve** | INV-DC-020 (open Unread clears bell); INV-DC-005 (unread ≠ action-required); refresh/re-login badge stability |
| **Media** | [`../../media/ux-remediation/package-01/`](../../media/ux-remediation/package-01/) |
| **Audit evidence (before)** | [#539](https://github.com/getnuevetech/Influrios/pull/539) RC-DASHBOARD / dashboard-consistency (separate audit PR) |

---

## What this folder is not

- Not product UI code or a product PR  
- Not a claim that Fail rows are closed  
- Not Agency or live-deposit design  
- Not a substitute for retest after implementation
