# Influrios UX remediation — design packages

**Status (2026-11-23):** Package 1 mostly implemented · Package 5 contract ledger + reconciliation implemented · Package 2 design prep only · Packages 3–4 queued. Per-task status: [../remediation-status.md](../remediation-status.md).  
**Date:** 2026-11-21  
**Constraints:** Agency deferred · Preserve centered popups · Preserve original influencer card
**Implementation status (2026-11-23):** [../remediation-status.md](../remediation-status.md) is the single place that says what is built, what is open and what needs a retest.

This folder holds the **visual remediation design train**: boards + complete flow instructions that implementers use. Implementation and retest status live in [../remediation-status.md](../remediation-status.md), not here.

**Evidence source (not completion):** full-platform audit [#539](https://github.com/getnuevetech/Influrios/pull/539) (separate PR — docs/evidence only). Matrix / RC-DASHBOARD plan live on that PR under `docs/full-platform-audit/`. This design PR does **not** merge or depend on #539.

**Prior UX package (reuse where valid):** [#533](https://github.com/getnuevetech/Influrios/pull/533) — navigation map, shared-ui-spec, mobile-public-nav. Package 1 supersedes count/badge/payout-reminder rules where audit confirmed defects.

**Master specification:** [master-spec.md](./master-spec.md) (statuses, badges, buttons, notifications — expandable per package).

---

## Package order

| # | Package | Tracker | Status | Deliverable |
|---|---------|---------|--------|-------------|
| **1** | Shared navigation, dashboards (influencer + business), payout readiness, invitations, notifications, inbox dedupe, terminology | IPS-35 | **Mostly implemented** ([status](../remediation-status.md#2-package-1-540-backlog)) | [package-01/README.md](./package-01/README.md) |
| 2 | Collaborations lists + centered detail/edit popups (invite / withdraw / delete / deliverable / review) | IPS-36 | Design prep only | — |
| 3 | Pricing, billing, checkout (monthly/annual, discounts, tax, plan changes, invoices) | IPS-37 | Queued | — |
| 4 | Contracts, messages, profiles (contract presentation, conversations, original influencer card, collab entry) | IPS-38 | Queued | — |
| 5 | Admin workflows (lists, forms, permissions, config, job failures & recovery, **contract ledger + gateway/bank reconciliation** — [master-spec §12](./master-spec.md#12-admin-contract-ledger--gatewaybank-reconciliation-master-finance-scope)) | IPS-39 | Ledger + reconciliation **implemented** (#564, #575); other admin workflows queued | — |

Implement only after the package under review is accepted. Do not wait for every audit Blocked row to design proven dashboard/nav defects.

---

## Package 1 at a glance

| | |
|--|--|
| **Root cause** | RC-DASHBOARD |
| **Fail rows** | INV-DC-001, INV-DC-002, INV-DC-006, INV-DC-012, INV-DC-015, INV-C-014, INV-N-004 |
| **Also in Package 1** | Inbox deduplication and “Influencer” terminology (moved from #533) |
| **Review findings** | Six findings corrected — [finding-to-file checklist](./package-01/README.md#finding-to-file-checklist) |
| **Pass rules to preserve** | INV-DC-020 (open Unread clears bell); INV-DC-005 (unread ≠ action-required); refresh/re-login badge stability |
| **Media** | [`../../media/ux-remediation/package-01/`](https://github.com/getnuevetech/Influrios/blob/cursor/ux-pkg1-design-boards-9268/media/ux-remediation/package-01) |
| **Audit evidence (before)** | [#539](https://github.com/getnuevetech/Influrios/pull/539) RC-DASHBOARD / dashboard-consistency (separate audit PR) |

---

## What this folder is not

- Not product UI code  
- Not a claim that Fail rows are closed (see the status page)  
- Not Agency design  
- Not a substitute for retest after implementation
