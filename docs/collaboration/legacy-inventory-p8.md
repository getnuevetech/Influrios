# Collab OS P8 — Legacy inventory & teardown

**Date:** 2026-10-04  
**Status:** Core freeze shipped (`legacy_demo_payments` default off)

## 1. Money engine (canonical)

| Path | Role |
|---|---|
| `CollaborationFunding` + `LedgerEntry` / `src/lib/marketplace-ledger.ts` | Sole product money path |
| `/payments`, `/admin/marketplace`, `/admin/trust` (ledger disputes) | Product UI |

## 2. Quarantined Phase 9/10 demos

| Endpoint / module | Store | Replacement |
|---|---|---|
| `/admin/payments` | `data/protected-payments.json` | `/admin/marketplace` |
| `/trust` demo queue | `data/trust.json` | Ledger disputes on `/payments` + `/admin/trust` |
| `src/lib/protected-payments.ts` | JSON | `marketplace-ledger.ts` |
| `src/lib/trust.ts` | JSON | `milestone-disputes.ts` |

**Freeze behavior (P8):**
- `legacy_demo_payments` default **off**
- When off: stores return empty in-memory snapshots; **no JSON seed/rehydrate**; existing demo JSON files are **purged** on read
- Writes call `assertLegacyDemoPayments()` and throw if the switch is off

## 3. Document signing decision

Keep `/admin/signing` as a **non-goal shell** until counsel approves e-sign. Contract wizard remains accept-only. Do **not** claim provider success from queued signature rows.

## 4. `creator_*` technical compatibility (not public role strings)

Public UI already uses **Influencer**. Technical identifiers kept with deprecation telemetry:

| Field | Kind | Influencer alias (telemetry) |
|---|---|---|
| `creator_plus` / `creator_pro` | Billing SKU | Influencer Plus / Pro |
| `creator_claim` | Legal trigger | `influencer_claim` |
| `creator_opportunity` | Marketplace kind | `influencer_opportunity` |
| `business_creator_match` | AI function | `business_influencer_match` |
| `influrios_creator_session` | Cookie | `influrios_influencer_session` |

Checkout records `terminology.creator_field_deprecated` audit events for `creator_*` SKUs (warehouse continuity; no silent Creator-as-role in UI).

## 5. Exit checklist

- [x] Inventory documented  
- [x] Feature-flag cutover (`legacy_demo_payments`)  
- [x] Freeze legacy writes + purge JSON when off  
- [x] Signing fate decided (shell / non-goal)  
- [x] Deprecation telemetry for creator_* SKUs  
- [ ] Optional later: rename SKUs/cookies after dual-write window (do not break Stripe metadata)
