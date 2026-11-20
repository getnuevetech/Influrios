# Addendum v1.1 — Deliverables coverage & defects

**Date:** 2026-11-20 (reviewability fix)  
**Kind:** Design / audit expansion only (no product fix)  
**Historical evidence:** #534 @ `db64224`  
**In-repo on:** #534 (this pack under `docs/remediation-pack/`)

## Scope decision

Deliverable workflow gaps are **IN SCOPE**. This addendum does **not** authorize implementation, seed commercial rates, open live deposits, or silently repair product code.

`db64224` remains the historical execution freeze. Do **not** present that checklist as complete platform coverage.

## Scoring (expanded aggregate)

| Lens | Result |
|------|--------|
| **Aggregate acceptance** | **20 Pass / 10 Partial** |
| J14 note-submission **subtest** | **Pass** |
| J14 journey **aggregate** | **Partial** (file upload + business Approve/Request changes UI unproven) |
| J18 monthly **subtest** | **Pass** |
| J18 journey **aggregate** | **Partial** (annual Fail COR-04) |
| Old-checklist Coverage Incomplete | **0** @ `db64224` only |
| Expanded audit (upload/review/reply/download edges) | Steps remain **not executed** — not covered by that zero |

## Evidence classes (use on every case)

| Class | Meaning |
|-------|---------|
| **reproduced** | Exercise observed in harness/UI with media or probe |
| **code-observed** | Failure or behavior proven from source / unit tests without fresh UI capture |
| **user-reported** | Product owner / reviewer report pending harness reproduction |
| **not executed** | Required expanded step not run |

## Registered defects

| ID | Pri | Evidence class | Title |
|----|-----|----------------|-------|
| **COR-20** | P1 | **code-observed** (+ UI context reproduced) | Update-deliverable errors route to Collaboration payments |
| **COR-21** | P1 | **user-reported** failure + Attach **reproduced** + E2E **not executed** (separate) | File upload broken/incomplete — reproduce reported failure; Replace/Remove vs Retry |
| **COR-22** | P1 | **code-observed**; field UI **reproduced** | Bare domain normalize; Will save as… / Saved as… |
| **COR-23** | P2 | **not executed** (UI); lib **reproduced** | Separate Request changes vs Approve confirmation |
| **COR-24** | P2 | **not executed** (in-app billing download) | Influrios billing-history invoice/receipt actions — does **not** demote J20 hosted invoice Pass |
| **COR-25** | P2 | **not executed** (attachment fail/retry / workroom composer depth) | Does **not** demote J22 two-party send Pass |

Design/flow/acceptance: [`addenda/`](./addenda/) · boards: [`design-boards/`](./design-boards/).

## Permissions

Rows previously labelled Pass/code-observed for download/deny are now **code-reviewed · runtime not executed**. Acceptance requires authorized-download + cross-account-denial tests.

## Implementation gate

See [`IMPLEMENTATION-SLICE-deliverables.md`](./IMPLEMENTATION-SLICE-deliverables.md) — **awaiting Ola approval**. No broad remediations until approved.
