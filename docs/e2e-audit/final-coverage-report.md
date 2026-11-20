# Final coverage report — J18/J20 completion (#534)

**Revision:** j18-j20-complete · **Base:** `3924de3`  
**Scope:** Complete remaining J18/J20 execution evidence only. Remediation **PAUSED**. No DB repairs, fabricated webhooks, or hardcoded tax.

## Executive counts (J01–J30)

| Acceptance | Count | IDs |
|------------|------:|-----|
| Pass | **22** | J01–J02, J04–J14, **J18**, J19, **J20**, J21–J24, J26, J29 |
| Partial | **8** | J03, J15, J16, J17, J25, J27, J28, J30 |
| Coverage Incomplete | **0** | |

**Reporting qualification:** J18 is labelled Pass for the **monthly** branch while annual remains Fail (COR-04). For an all-required-branches aggregate, treat J18 as Partial → **21 Pass / 9 Partial**. Publish branch labels alongside either count; never imply annual discounts passed.

One Stripe TEST transaction satisfies **both** J18 and J20 monthly acceptance criteria.

## J18 + J20 completed transaction

| Field | Value |
|-------|-------|
| Session | `cs_test_a0EmDMZuI8eydnfk4Q7mmX0qws8ubVjVzYpvrImu1MdQ6Q2bH4QaoI1ryt` |
| Code | `AUDITPRO15MAC4C` (15% month Pro) |
| Path | Influrios `/billing` Upgrade to Pro → Apply → tax preview → Stripe → computerUse Card `4242` |
| Checkout | subtotal 2900 · discount 435 · tax 203 · **total 2668** |
| Invoice | `in_1UddzZ1geYv2y1v8tm2vcCBe` paid — same amounts; hosted + PDF |
| Influrios | `SubscriptionState` **active** `creator_pro` month; `CheckoutAttempt` **completed** |
| Redemption | `DiscountOffer.redeemedCount=1`; reservation **consumed** / `providerOutcome=confirmed` |

### Required-step outcomes

| Step | Result | Evidence |
|------|--------|----------|
| Influrios quote + Apply monthly discount | executed_successfully | `j18j20-preview-applied.png` |
| Open Stripe Checkout with coupon | executed_successfully | `j18j20-stripe-hosted.png`, `j20-unrelated-pre-subscribe.png` |
| Complete Stripe TEST payment | executed_successfully | computerUse; `j18-j20-discounted-checkout-payment.mp4` |
| Provider → Influrios entitlement | executed_successfully | `j18-j20-postpay-probe.json` |
| Discount redemption persisted | executed_successfully | offer redeemedCount=1; reservation consumed |
| Customer billing history | executed_successfully | `j18j20-billing-after-pay.png` |
| Invoice + PDF reconcile | executed_successfully | `j20-invoice-details.png`, `j20-invoice-pdf.png`, `j18j20-invoice.pdf` |

**J18 acceptance Pass** for monthly Apply→pay→redeem. **Annual Apply remains Fail (COR-04)** — preserved for remediation, not silently repaired.  
**J20 acceptance Pass** for Influrios UI quote→payment→invoice (same txn).

## Preserved defects (remediation still paused)

COR-03 annual offers · COR-04 annual Apply · COR-07/11/12 proration · COR-10 managed_intro fee · COR-09a/b · COR-18 mobile overflow · COR-13/14/15 · PL-01 payout · COR-SEC-01  

**Deliverables expansion (2026-11-20, design/register only):** COR-20 error→payments · COR-21 file upload path · COR-22 bare-link normalize · COR-23 J14 review UI gap · COR-24 billing invoice download · COR-25 messages reply. Pack is **NOT** complete verified UI/UX remediation; deliverable gaps **IN SCOPE**. See `docs/remediation-pack/` in the Project store.

## Pack

- `j18-j20-complete-results.json` · `j18-j20-postpay-probe.json`  
- `phase1-acceptance-matrix.json` · `correction-register.md` · `journeys.md`  
- Media: `media-local-journeys-closure/j18j20-*`, `j20-invoice-*`  
- Recording: `/opt/cursor/artifacts/j18-j20-discounted-checkout-payment.mp4`
