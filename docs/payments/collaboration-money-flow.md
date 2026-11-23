# Collaboration money flow (Stripe)

One flow for test and live keys. Test keys move sandbox money; while Stripe uses test keys only the
test accounts in Payment settings can fund. Live keys also need the launch approvals and a recorded
test transaction.

1. **Collection.** The business pays the signed total through Stripe Checkout into the Influrios
   platform balance (the Collaborations account). Methods depend on the amount (Marketplace settings →
   Payment methods by amount): card or ACH debit up to the card limit, ACH debit above it, wire or bank
   transfer from the wire amount. The webhook (`/api/billing/webhook`) posts the hold.
2. **Release.** When a milestone's payout is approved and sent (manually or by the release sweep):
   - the influencer's net is transferred to their Stripe Connect account (verified by Stripe), and
   - that milestone's platform fees are transferred to the Operations connected account.
   Both transfers reference the original charge (`source_transaction`) and the funding
   (`transfer_group`). If Stripe refuses, its reason is shown on the admin payout row.
3. **Subscriptions** go to the Collection connected account and never mix with collaboration funds.

The contract ledger and the gateway reconciliation page read these ledger entries and the Stripe balance.
