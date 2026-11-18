# Coverage (reconciled) — AUDIT_20261118170047 / r2

## Important

**Route-open Pass ≠ journey Pass.** Revision r2 separates denominators after Ola rejected screenshot-only completion.

## Denominators

| Denominator | Count | Notes |
|-------------|------:|-------|
| Source routes | 128 | route-inventory.csv |
| Action inventory rows | 34 | action-inventory.csv |
| Case rows (all kinds) | 153 | results.json |
| Inventory route-open rows | 116 | supporting only |
| Journey-kind rows | 29 | includes Blocked mutating stubs |
| Journey completion Passes | 7 | strict |
| Required journeys J01–J30 | 30 | see matrix |
| Screenshots | 141 | |
| Recordings | 3 | |

## Functional tallies by caseKind

### Inventory
- Pass: 116

### Journey
- Pass: 7
- Not tested: 1
- Blocked: 20
- Not applicable: 1

### Visual
- Pass: 8

## J01–J30 matrix (reconciled)

| Journey | Status | Detail |
|---------|--------|--------|
| J01 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J02 | Partial | Logins + invalid login Pass; password-reset mail path not fully retested this revision |
| J03 | Not tested | Inventory/visual only — false journey Pass avoided |
| J04 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J05 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J06 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J07 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J08 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J09 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J10 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J11 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J12 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J13 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J14 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J15 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J16 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J17 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J18 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J19 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J20 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J21 | Partial | Business shell surfaces captured; no main-journey entity ID reconciliation yet |
| J22 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J23 | Blocked | BLK-ISOLATION residual attestation — mail sink proven; mutations gated |
| J24 | Partial | Synthetic ID denial Pass; real cross-account contract IDOR not fixture-linked |
| J25 | Partial | Read-only inventory/admin opens — not full mutating admin ops |
| J26 | Partial | Read-only inventory/admin opens — not full mutating admin ops |
| J27 | Partial | Read-only inventory/admin opens — not full mutating admin ops |
| J28 | Partial | Read-only inventory/admin opens — not full mutating admin ops |
| J29 | Partial | Read-only inventory/admin opens — not full mutating admin ops |
| J30 | Partial | Sampled centered popup geometry Pass; full checklist / all viewports still in progress |
| AGENCY | Not applicable | Deferred |

**Arithmetic check (journey statuses):** each of 30 rows has exactly one status above.

| Status | Count |
|--------|------:|
| Blocked | 20 |
| Partial | 9 |
| Not tested | 1 |

## Provider-sandbox coverage

**0** critical collection/payout journeys completed at L3 (honest). Mail controlled-delivery proof is separate (see mail-sink-proof.md).

## Evidence link roots

- Pack index: [index.html](./index.html)
- Media store: `/cursor/stores/self/media/e2e-audit/`
- Downloads: [downloads/](./downloads/)
