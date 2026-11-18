# Payment implementation inventory (P0)

Authority: Influrios Payment Standard v2.0 + Dev AI Instructions v1.0 (18 Nov 2026).  
Branch work: `cursor/payment-standard-v2-dollars-18a0`.  
**Money rule for this implementation:** all new standard pricing and money values are **dollars with two decimals** (for example `4830.00`), not cents fields.

This inventory is the starting map. Dispositions: **reuse** / **extend** / **replace** / **retire**.

## Domain ownership (target)

| Concern | Owner | Gateway role |
| --- | --- | --- |
| Prices, fees, tax, allocations | Influrios services | None |
| Milestone approval / release authorization | Influrios | None |
| Collection, transfer, payout, refund execution | Adapter | Execute only |
| Journals / reconciliation | Influrios | Evidence source |

## Existing components

| Path | Behavior today | Required (v2) | Disposition |
| --- | --- | --- | --- |
| `src/lib/money.ts` | Formats **cents** integers for UI | Display helpers may remain for legacy rows | **reuse** for legacy; new standard uses `payment-money.ts` |
| `src/lib/payment-money.ts` | *(new)* Dollar decimal arithmetic | Canonical money for Payment Standard v2 | **extend** |
| `src/lib/payment-standard-v2.ts` | *(new)* Roles, economics, fixture, release keys | Core economics in dollars | **extend** |
| `src/lib/payment-standard-v2-accounts.ts` | *(new)* Bindings, edges, activation checks | STD04/05 route readiness | **extend** |
| `src/lib/payment-standard-v2-adapter.ts` | *(new)* Adapter contract + mock | Provider-agnostic commands | **extend** |
| `src/lib/payment-standard-v2-release.ts` | *(new)* Batch plan/execute/retry/sweep | REL02/03, OPS01 | **extend** |
| `src/lib/payment-standard-v4.ts` | Cents-based illustrative fixtures + screens | Keep until callers migrate | **reuse** then migrate callers |
| `src/lib/payment-engine.ts` | Signed commercial snapshots in cents | Snapshot dollars on new quotes | **extend** |
| `src/lib/agreement-fee-engine.ts` | Milestone split in cents | Bridge via dollar↔provider minor only at adapter edge | **reuse** temporarily |
| `src/lib/collaboration-fees.ts` | Fee matrix | Single fee engine | **reuse** |
| `src/lib/payment-account-routing.ts` | Stripe topology proof gates | Generalize capabilities | **replace** Stripe-only assumptions |
| `src/lib/payment-provider-adapter.ts` | Queues Job instructions | Full v2 command set | **replace** interface gradually |
| `src/lib/stripe-payment-adapter.ts` + billing webhook | Subscription collection | Preserve | **reuse** |
| `src/lib/providers/airwallex*.ts` | Marketplace funding/release | First collab adapter candidate | **extend** behind v2 adapter |
| `src/lib/payment-standard-store.ts` | Route/tax persistence | Persist dollar amounts for new records | **extend** |
| `src/lib/collab-journey-money.ts` | Reconciliation in cents | Add dollar API or convert at boundary | **extend** |
| `prisma` `ProviderConnection` / `ProviderAccount` / `PaymentRoleBinding` / `PaymentRouteVersion` | Account registry skeleton | Main/subaccount + evidence | **extend** |
| `prisma` `ProviderEventInbox` / `PaymentJournalLine` / `ProviderCommand` | Inbox/journal/outbox seeds | Deduped events + dollar journal lines | **extend** |
| `prisma` `CollaborationFunding` / `FundingMilestone` / `FundingSettlement` | Live collab money (cent integers) | Pin route versions; new writes in dollars where additive | **extend** (no silent rewrite of history) |
| Admin `payment-settings` | Providers / roles / routes / fees / tax / discounts | Integrations / Mappings / Routes / Transactions IA | **extend** then **refactor** UI |
| Marketplace catalog as provider identity | Still referenced in older route helpers | Must not select account roles | **retire** as role selector |

## Money initiating paths (initial)

| Entry | Caller | Record | Provider | Disposition |
| --- | --- | --- | --- | --- |
| Subscription checkout | billing / Stripe adapter | subscription invoice / entitlement | Stripe | **reuse** (preserve) |
| Collaboration funding checkout | funding-checkout / Airwallex | `CollaborationFunding` | Airwallex | **extend** behind FundingService |
| Milestone release | work release UI / marketplace adapter | `FundingMilestone` / settlement legs | Airwallex / jobs | **extend** via ReleaseService |
| Influencer payout | earnings / payout readiness | payout method + provider payout | provider-specific | **extend** |
| Refund / cancel | payment-provider-adapter queue | Job + webhook | provider webhooks | **extend** |
| Admin route activation | payment-settings actions | `PaymentRouteVersion` | none (must not move money) | **extend** |

## Gap list (confirmed)

1. Public/domain money for the new standard must be dollars with decimals — **in progress** via `payment-money` + v2 modules.
2. Adapter contract incomplete vs v2 commands — **stubbed** with mock; Airwallex/Stripe wrappers next.
3. ReleaseAuthorization uniqueness not enforced in DB yet — domain helper ready; schema constraint next.
4. Admin IA still includes marketplace switches / discounts in the same shell — refactor later (P5).
5. Historical `*Cents` columns remain for legacy rows — do not rewrite signed amounts; bridge at edges.

## Next packages

- **P1** continue: persist capability evidence + movement edges; block invalid activation.
- **P2** done for fixture math in dollars; wire fee engine snapshots to dollar fields for new agreements.
- **P3** continue: durable outbox + DB locks around release batches.
- **P4** wrap Airwallex + preserve Stripe subscription adapter.
- **P5–P7** UI, migration shadow quotes, one sandbox route evidence pack.
