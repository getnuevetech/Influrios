# Financial rails — what each system does

Influrios money movement uses **four separate rails**. They are not interchangeable. Mixing their jobs (especially “payout method” vs Stripe Connect vs marketplace webhook) is what produced sticky Flutterwave labels on Stripe/US deals.

## 1. Collection route (Payment gateways + Country corridors)

| | |
|---|---|
| **Admin** | Payment gateways → assign country routes; Country corridors → **Collection route** |
| **Job** | How the **business pays** / how the corridor charges or holds funds for a collaboration |
| **Examples** | Stripe, Airwallex, Flutterwave (as a *collection* provider) |
| **Shown as** | Payment readiness → “Payment route: ready (Stripe)” |

Not the same as marketplace webhook. Not the same as influencer withdrawal brand.

## 2. Influencer payout account (Connect / connected account)

| | |
|---|---|
| **Admin / creator** | Stripe Connect (or Airwallex connected account) onboarding |
| **Job** | Where **released milestone balance** is paid to the influencer |
| **Tied to** | Corridor **collection route** (`choosePayoutOnboardingRail`) |
| **Shown as** | Payment readiness → “Influencer payout account: connected (Stripe)” |

For Stripe/Airwallex corridors, **Global Payout Ready** follows this connection (account id present), not a Flutterwave withdrawal checkbox.

## 3. Withdrawal method (`InfluencerPayoutProfile.primaryMethod`)

| | |
|---|---|
| **Codes** | `usd_bank`, `local_bank`, `mpesa`, `flutterwave_payout` |
| **Job** | Local-rail / bank-style withdrawal metadata for Global Payout Ready on **non-Connect** corridors |
| **Must match** | Corridor collection rail — Stripe/Airwallex corridors only allow `usd_bank` / `local_bank` |
| **Shown as** | Payment readiness → “Withdrawal method (Global Payout Ready)” |

Legacy bug: profiles kept `flutterwave_payout` after the corridor moved to Stripe. Sync now drops methods incompatible with the collection provider.

## 4. Marketplace ledger provider (webhook)

| | |
|---|---|
| **Admin** | Marketplace ledger → Marketplace provider + jurisdiction **Provider** |
| **Job** | Confirms the **prefund is held** before the deal is funded (`ROUTE_READY` gate) |
| **Shown as** | Payment readiness → “Marketplace provider: Stripe ready” / escrow banner “marketplace provider is not ready” |

API keys on Payment gateways ≠ signing secret on Marketplace ledger. Jurisdiction Provider (often Primary or Stripe) must have webhook + Enabled.

## 5. Escrow / Protected Payments page

| | |
|---|---|
| **Path** | `/payments` — “Start a protected deal” |
| **Job** | Alternate **deal creation** UI (business + influencer + jurisdiction + gross) that also calls prefund |
| **Payout method field** | Must be a method **on that jurisdiction’s corridor**, filtered by collection rail |
| **Not** | A second ledger. Same marketplace confirmation + corridor rules as the contract wizard |

If the banner says the marketplace provider is not ready, fix **Marketplace ledger** webhook for that jurisdiction’s provider — not Payment gateways KYC.

## ROUTE_READY vs Global Payout Ready

```
ROUTE_READY (funding allowed)
  ├─ Identity verified
  ├─ Payout country known
  ├─ Corridor active
  ├─ Payment route ready (collection gateway)
  ├─ Influencer Connect account when the rail requires it
  ├─ Jurisdiction protected payments on
  └─ Marketplace provider webhook ready for that jurisdiction

Global Payout Ready (withdraw released balance)
  ├─ Same corridor / identity / route basics
  └─ Verified withdrawal path:
       • Stripe/Airwallex → connected payout account, or
       • Local rails → verified usd_bank / local_bank / mpesa / flutterwave_payout
```

Funding does **not** wait for Global Payout Ready. Withdrawals do.

## Admin checklist (no baked defaults)

1. **Payment gateways** — add gateways; assign **country routes** deliberately (nothing auto-assigns Flutterwave to Africa anymore).
2. **Country corridors** — activate country; set **collection route** + **payout methods** that match that route.
3. **Marketplace ledger** — save webhook for each provider you use; set each **jurisdiction Provider** to that code (not only Primary).
4. **Influencer** — KYC/identity; Connect onboarding for Stripe corridors.

## Code anchors

- Corridor sync / compatibility: `src/lib/payout-readiness.ts` (`payoutMethodsCompatibleWithCollection`, `ensureInfluencerPayoutProfile`)
- Onboarding rail: `choosePayoutOnboardingRail`
- Prefund + marketplace confirm: `src/lib/marketplace-ledger.ts`
- Escrow form: `src/app/payments/page.tsx` + `jurisdiction-payout-method-fields.tsx`
- Contract readiness UI: `src/app/collaboration/contract/page.tsx`
