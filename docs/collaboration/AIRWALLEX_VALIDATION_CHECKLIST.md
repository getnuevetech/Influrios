# Airwallex validation checklist (Collab OS §8.3 / §22)

**Status:** Draft artifact — sign columns before any production Airwallex adapter.  
**Source:** `docs/collaboration/COLLABORATION_OS_SPEC_v1.txt` §8.2–8.3, §22; plan P4 gate.  
**Rule:** Airwallex stays an adapter candidate only. Collaboration domain rules must not hard-code Airwallex, Escrow.com, or other provider-specific logic.

## Sign-off

| Role | Name | Date | Signature / note |
|---|---|---|---|
| Engineering | | | |
| Payments / Ops | | | |
| Legal / Compliance (if required) | | | |

Production adapter work is **blocked** until every mandatory item below is `PASS` or `N/A (documented)` with an owner note.

## Environment

| Field | Value |
|---|---|
| Airwallex sandbox account / org | |
| Connected-account program type | |
| Holding / wallet topology (as approved) | |
| Sandbox API base URL | |
| Webhook endpoint under test | `/api/marketplace/webhook` (or adapter path) |
| Checklist revision | 2026-10-04 |

## Mandatory validation items (§8.3)

| # | Validation item | Result (`PASS` / `FAIL` / `N/A`) | Evidence (ticket, screenshot, webhook id, notes) | Owner | Date |
|---|---|---|---|---|---|
| 1 | Multiple manual-release **FundsSplit** objects from one funded collaboration can target the **same** creator connected account (multi-milestone) | | | | |
| 2 | Exact **Holding Account / connected-account topology** keeps collaboration funds separate from Nueve/Influrios **Operations** | | | | |
| 3 | Cleanest path to keep **platform fee allocations unearned/restricted** until the corresponding milestone is approved | | | | |
| 4 | Supported **connected-account types by creator country** (full / withdrawal / ledger / individual / business) documented for target corridors | | | | |
| 5 | **Global Account** availability and supported receiving currencies for target countries | | | | |
| 6 | **Payout destinations and FX** capabilities by corridor (incl. limits / settlement expectations) | | | | |
| 7 | Provider-level **refund, chargeback, reserve, and dispute** behavior confirmed | | | | |
| 8 | Regional payout providers can be used **after release** without routing creator money through Influrios Operations | | | | |

## Adapter readiness gates (plan / §22)

| # | Gate | Result | Notes |
|---|---|---|---|
| A | Domain ledger already books Holding vs Operations independently of Airwallex | | P4 account purposes |
| B | `PaymentProviderAdapter` can host Airwallex without changing fee/milestone rules | | |
| C | Webhooks are idempotent; duplicate FundsSplit / release events do not double-pay | | |
| D | Jurisdiction / corridor matrix can disable Airwallex without deploy | | P5 / P6 |
| E | No Airwallex strings in collaboration domain modules (grep clean) | | |

## Explicit non-assumptions

Do **not** treat public Airwallex marketing docs as Influrios program truth. Confirm with Airwallex during onboarding:

- Approved account structure and legal entity mapping  
- Supported creator countries and KYC/KYB model  
- Wallet / account types actually enabled for the Influrios program  
- Fee behavior, payout destinations, and regulatory responsibilities  

If Airwallex cannot satisfy a corridor, choose another adapter — do not rewrite Collaboration domain logic.

## After sign-off

1. File the signed copy under ops (or attach to the launch ticket).  
2. Open an Airwallex adapter implementation PR that only touches provider adapter + config.  
3. Keep this checklist linked from `docs/FULL_IMPLEMENTATION_PLAN.md` L5 and `COLLABORATION_OS_PLAN.md` P4.
