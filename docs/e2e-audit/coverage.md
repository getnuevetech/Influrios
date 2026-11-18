# Coverage — AUDIT_20261118170047

## Denominators

| Denominator | Count | Notes |
|-------------|------:|-------|
| Source routes (`page.tsx`) | 128 | See route-inventory.csv |
| Seeded unique actions | 34 | See action-inventory.csv |
| Case results this run | 153 | results.json |
| Journey IDs touched | 31 | J01–J30 + AGENCY + inventory |
| Screenshots | 141 | media/e2e-audit/screenshots |
| Preflight shots | 15 | media/e2e-audit/preflight |
| Recordings | 3 | role desktop nav webm |

## Functional outcomes

| Result | Count |
|--------|------:|
| Pass | 131 |
| Not tested | 1 |
| Blocked | 20 |
| Not applicable | 1 |

**Check:** Pass+Fail+Blocked+Not tested+Not applicable = **153** (must equal 153).

## Visual outcomes

| Result | Count |
|--------|------:|
| Pass | 132 |
| Not tested | 20 |
| Not applicable | 1 |

## By journey

| Journey | Total | Pass | Fail | Blocked | Not tested | N/A |
|---------|------:|-----:|-----:|--------:|-----------:|----:|
| AGENCY | 4 | 3 | 0 | 0 | 0 | 1 |
| J01 | 5 | 4 | 0 | 1 | 0 | 0 |
| J02 | 11 | 11 | 0 | 0 | 0 | 0 |
| J03 | 20 | 20 | 0 | 0 | 0 | 0 |
| J04 | 6 | 5 | 0 | 1 | 0 | 0 |
| J05 | 5 | 4 | 0 | 1 | 0 | 0 |
| J06 | 1 | 0 | 0 | 1 | 0 | 0 |
| J07 | 1 | 0 | 0 | 1 | 0 | 0 |
| J08 | 1 | 0 | 0 | 1 | 0 | 0 |
| J09 | 1 | 0 | 0 | 1 | 0 | 0 |
| J10 | 5 | 4 | 0 | 1 | 0 | 0 |
| J11 | 2 | 1 | 0 | 1 | 0 | 0 |
| J12 | 1 | 0 | 0 | 1 | 0 | 0 |
| J13 | 5 | 4 | 0 | 1 | 0 | 0 |
| J14 | 4 | 3 | 0 | 1 | 0 | 0 |
| J15 | 3 | 2 | 0 | 1 | 0 | 0 |
| J16 | 10 | 9 | 0 | 1 | 0 | 0 |
| J17 | 1 | 0 | 0 | 1 | 0 | 0 |
| J18 | 2 | 1 | 0 | 1 | 0 | 0 |
| J19 | 4 | 3 | 0 | 1 | 0 | 0 |
| J20 | 1 | 0 | 0 | 1 | 0 | 0 |
| J21 | 1 | 1 | 0 | 0 | 0 | 0 |
| J22 | 2 | 1 | 0 | 1 | 0 | 0 |
| J23 | 3 | 2 | 0 | 1 | 0 | 0 |
| J24 | 3 | 2 | 0 | 0 | 1 | 0 |
| J25 | 10 | 10 | 0 | 0 | 0 | 0 |
| J26 | 2 | 2 | 0 | 0 | 0 | 0 |
| J27 | 2 | 2 | 0 | 0 | 0 | 0 |
| J28 | 2 | 2 | 0 | 0 | 0 | 0 |
| J29 | 29 | 29 | 0 | 0 | 0 | 0 |
| J30 | 6 | 6 | 0 | 0 | 0 | 0 |

## Integration levels

- **L1 visual/nav:** route opens, popup geometry, pricing visuals
- **L2 app-internal:** authenticated role logins, invalid login, cross-screen read-only
- **L3 provider-sandbox:** **not executed** this run — blocked by BLK-ISOLATION / BLK-MAIL-SINK

Provider-sandbox coverage: **0 / required critical collection+payout journeys** (honestly blocked).

## Exclusions

- Agency workflows: deferred (Not applicable)
- Payment Standard v2: paused — not enabled to force passes
- Mutating sandbox checkout/signing/invite/withdraw: blocked pending isolation + mail sink
- Screenshot-count % is **not** used as end-to-end completion

## Manual review

Popup geometry cases under J30 were inspected via bounding-box assertions + screenshots. Recordings show role shell navigation; they are **not** substitutes for blocked mutating journeys.
