# Coverage (revision r3.6 — stop when Pass or precise limitation)

**Verdict: Incomplete — #534 stays open.** CI ≠ done. Simulated payouts ≠ provider Pass.

## Completed this revision

- **J18 Pass** — Pro month Checkout Apply UI (`AUDITPRO15M`); wrong-interval reject; tax preview
- **J20 Pass** — Quote→Stripe TEST charge with 8.25% tax→paid invoice/receipt (`tax=239`, total `3139`)
- **J16 year** — Fail with RCA (no invent Pass)
- **J17 / J28 / J15** — Partial with precise product/provider limitations

## Matrix counts (J01–J30)

- Pass: **26**
- Partial: **4** (J15, J16, J17, J28)
- Blocked (gate): **0**

See [journeys.md](./journeys.md), [correction-register.md](./correction-register.md), [local-journey-r36-results.json](./local-journey-r36-results.json).
