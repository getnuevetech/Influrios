# Collab OS P8 — Legacy inventory & teardown

**Date:** 2026-10-04  
**Status:** Phase 9/10 JSON modules deleted. Marketplace ledger is the only money path.

## 1. Money engine (canonical)

| Path | Role |
|---|---|
| `CollaborationFunding` + `LedgerEntry` / `src/lib/marketplace-ledger.ts` | Sole product money path |
| `/payments`, `/admin/marketplace`, `/admin/trust` (ledger disputes) | Product UI |

## 2. Removed Phase 9/10 demos

| Former path | Store | Replacement |
|---|---|---|
| `/admin/payments` (redirects) | `data/protected-payments.json` | `/admin/marketplace` |
| JSON trust queue | `data/trust.json` | Ledger disputes on `/payments` + `/admin/trust` |
| `src/lib/protected-payments.ts` | JSON | `marketplace-ledger.ts` |
| `src/lib/trust.ts` | JSON | `milestone-disputes.ts` |

`purgeLegacyDemoJsonFiles()` deletes those two JSON files when they are still on disk. Public `/payments` and `/trust` read the marketplace ledger. The legal document `protected-payments-policy` stays.

## 3. Document signing decision

DocuSign completes a signature. The collaboration stays unsigned until every required party is completed.

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
- [x] JSON payment modules deleted  
- [x] Purge leftover `protected-payments.json` and `trust.json`  
- [x] Signing completes through DocuSign  
- [x] Deprecation telemetry for creator_* SKUs  
- [ ] Optional later: rename SKUs/cookies after dual-write window (do not break Stripe metadata)
