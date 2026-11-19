# Executive summary (revision r3.6)

**Verdict: Incomplete — continue #534.** Remaining items are Pass or blocked with precise product/provider limitations. J15 never Pass without provider payout.

## Highlights

| Journey | Result | Notes |
|---------|--------|-------|
| J18 discount Apply | **Pass** | Pro month Checkout Apply `AUDITPRO15M`; year-on-month rejected |
| J20 quote→invoice | **Pass** | Pro $29 + $2.39 tax = $31.39 Stripe TEST; invoice tax=239; hosted+PDF |
| J16 annual | **Fail** | Empty annualOffers + no year Price (RCA) |
| J17 proration | **Partial** | `externalId=cs_test_` + empty `billing.prices` |
| J28 matching fee | **Partial** | Advanced lifecycle; no `managed_intro` fee rule |
| J15 payout | **Partial forever** | Simulation only |

## Counts (J01–J30)

- Pass: **26**
- Partial: **4** (J15, J16, J17, J28)
- Blocked (collection gate): **0**

Media: `/cursor/stores/self/media/e2e-audit/local-journeys/` (`j18r36-*`, `j20r36-*`, `j28r36-*`, `vis36-*`).
