# Package 5 reference — approved ledger design

| File | What it is |
|------|-----------|
| [contract-ledger-and-bank-reconciliation-dashboard.png](./contract-ledger-and-bank-reconciliation-dashboard.png) | **Approved** design reference (Ola, 2026-11-21): Contract ledger (collapsed contract rows, inline-expanded money movements, per-contract and full-ledger download) and Gateway & bank reconciliation (balances per account/currency, as-of timestamp, differences, exceptions) |

**Source:** the copy supplied in review (1536 × 1024). Replace with the full-resolution original when it's available; keep the filename.

## How to use it

- It's the **visual and structural reference** for [master-spec §12](../../master-spec.md#12-admin-contract-ledger--gatewaybank-reconciliation-master-finance-scope). The written requirements in §12 govern where they are more specific.
- **All figures are illustrative.** Amounts, fee splits, tax amounts, allocation timing, account names, references and party names in the image must **not** become hardcoded payment, fee, tax or allocation rules. The image itself says: “illustrative allocation timing, no universal policy”.
- Keep from the design: Admin-only marking · Contracts / Gateway & bank reconciliation tabs · currency and date filters · collapsed row columns (Collected, Collaboration fees, Taxes, Platform retained, Processing/recorded costs, Net earnings) · inline row expansion with a Money movements table (Date, Movement, From → To, Amount, Status, Reference) · per-contract and full-ledger downloads · balance cards (gateway, bank, combined cash, unexplained difference) · per-location ledger vs provider/bank balance table with status · internal transfer note · cash reconciliation and cash ownership lines · exceptions (unmatched, duplicates, pending settlement) · as-of timestamp + Refresh records.
- “Internal allocations do not create additional cash”: internal allocations and external cash movements stay separate (§12.6).
