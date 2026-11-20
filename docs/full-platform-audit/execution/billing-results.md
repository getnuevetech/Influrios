# IPS-19 billing slice results

**Slice:** `billing` (subscriptions / discounts / invoices / payouts / refunds)  
**Tracker:** IPS-23 under IPS-19  
**App:** https://influrios.com · revision `40b6288` · Stripe **sandbox** (`sk_test_`, acct `acct_1TqpBo1geYv2y1v8`)  
**Recorded:** 2026-11-20  
**Evidence:** `./media/billing/`  
**Constraints honored:** Live collaboration deposits CLOSED; sandbox Stripe only; simulation vs provider-confirmed distinguished.

## Method

- Desktop Playwright (Chrome) + mobile viewports for `/pricing` and `/billing`
- Role logins: AUDIT influencer / business / admin (secrets not recorded)
- Provider reads via Stripe API (prices, subscriptions, invoice, payouts/transfers/balance) — **provider-confirmed** where cited
- UI-only observations labeled **simulation / UI** when no provider object tied

## Counts (this slice)

| Status | Rows |
|--------|-----:|
| Pass | 32 |
| Fail | 7 |
| Blocked | 31 |
| Not tested | 0 |
| Explicitly deferred | 0 |
| **Total matrix rows updated** | **70** |

## Defects (new or reconfirmed)

| ID | Severity | Summary | Confirmation |
|----|----------|---------|--------------|
| BILL-01 / COR-03–04 | High | Annual influencer plans show amounts but **"The yearly Stripe price id is missing."**; Choose/Switch CTAs omitted. Stripe API `recurring[interval]=year` → **0 prices**. | Provider-confirmed absence + UI |
| BILL-02 | High | Business annual: **"Annual billing is not available for this plan yet."** while Monthly/Annual toggle present. | UI |
| BILL-03 | High | Influencer **Upgrade to Pro** review: **"Save a Stripe price before this change. Nothing was changed."** — blocks upgrade + discount apply UI. Catalog list shows only one active month Price (`price_1UdKNn…` $19 AUDIT Plus API), not UI $25/$29 map. | UI + provider catalog |
| BILL-04 / COR-24 | Med | Billing history lists **COMPLETED** rows with **no in-app invoice/PDF download** (INV-D-006). | UI |
| BILL-05 | Med | Admin **Customer portal - On**, but member `/billing` shows Payment method with **no Manage billing** control (`hasCustomer` path not taken). Portal open not executed. | UI vs admin switch |
| BILL-06 | Low | **Manage downgrade** on free Starter card links to **`/claim`** for logged-in influencer (wrong destination for downgrade management). | UI |

## Case results (by inventory)

Statuses apply to the matrix row. Evidence filenames under `media/billing/`.

### Routes

| ID | Cases | Expected | Actual | Evidence | Status |
|----|-------|----------|--------|----------|--------|
| INV-R-006 | `/pricing` desktop+mobile; Monthly/Annual | Plans + interval toggle | Monthly/Annual works; annual shows $300/$348/year **and** missing yearly Stripe price id (×2) | `01-pricing-desktop.png`, `01m-pricing-mobile.png`, `40-pricing-annual.png`, `40c-pricing-annual-cta-state.png` | **Fail** (annual purchase path) |
| INV-R-024 | `/billing` guest + member | Loads / auth gate | Guest → login; member Plus Monthly Active, tax lines, history | `02-billing-guest.png`, `12-billing-member.png`, `12m-billing-mobile.png` | **Pass** (page); annual/upgrade defects filed under A-070/A-073 |
| INV-R-025 | `/billing/success` | Reachable | Auth redirect to login when signed out | `03-billing-success.png` | **Pass** |
| INV-R-026 | `/billing/cancel` | Reachable | Auth redirect to login when signed out | `04-billing-cancel.png` | **Pass** |
| INV-R-039 | `/creator/earnings` | Earnings + payout setup | Loads; RELEASED $0; UPCOMING NET $5892; PAID TO BANK **$0**; one row **Payout processing**; setup Ready | `13-creator-earnings.png`, `14-creator-payouts.png` | **Pass** (UI surface). Bank payout **not** provider-confirmed for these rows |
| INV-R-051 | `/business/billing` | Business billing | Business Pro $99/mo; history empty; Agency upgrade CTA | `21-business-billing.png`, `47b-biz-annual.png` | **Pass** (monthly UI); annual unavailable message |
| INV-R-052 | `/business/plans` | Plans list | Monthly/Annual toggle; Agency card | `22-business-plans.png` | **Pass** |
| INV-R-092 | `/admin/plans` | Plan/annual edit | Plans UI + Edit/Pricing fields include annual | `31-admin-plans.png`, `31b-admin-plan-edit.png`, `51-plan-edit.png`, `52-plan-pricing.png` | **Pass** |
| INV-R-093 | `/admin/billing` | Activity + sandbox | **Stripe · Sandbox**; Customer portal On; checkout sessions listed | `32-admin-billing.png`, `53-billing-settings.png` | **Pass** |
| INV-R-098 | `/admin/marketplace` | Ledger / payout ops | Page loads under admin | `36-admin-marketplace.png`, `54-marketplace.png` | **Pass** (destination). Release→bank **Blocked** (deposits closed) |
| INV-R-105 | `/admin/payment-settings` | Hub incl discounts | Tabs incl Discount codes | `34-admin-payment-settings.png`, `33-admin-discounts.png` | **Pass** |
| INV-R-108 | `/admin/finance` | Finance views | Loads | `35-admin-finance.png` | **Pass** |

### Menus / tabs / popups

| ID | Cases | Actual | Evidence | Status |
|----|-------|--------|----------|--------|
| INV-M-008 | Billing & Plan nav | Reaches billing/account billing | `11-account-billing.png`, `46b-account-billing-autorenew.png` | **Pass** |
| INV-M-013 | Admin Subscriptions | Plans + Billing activity | `31-admin-plans.png`, `32-admin-billing.png` | **Pass** |
| INV-M-015 | Admin Payments & finance | Payment settings + Finance | `33-admin-discounts.png`, `35-admin-finance.png` | **Pass** |
| INV-T-015 | payment-settings discounts | Create code dialog; Monthly/Annual interval field; AGB expired code listed | `33-admin-discounts.png`, `50b-discount-create-dialog.png` | **Pass** |
| INV-T-019 | Earnings receive/payout | `#payouts` / earnings sections | `14-creator-payouts.png`, `14b-payouts-detail.png` | **Pass** |
| INV-P-011 | earning-dialogs | Earnings page; detail dialog deep-open inconclusive | `13-creator-earnings.png` | **Pass** (page/dialogs shell) |
| INV-P-012 | PayoutDetailDialog | Processing row click did not open dialog in automation | `55b-payout-detail.png` | **Blocked** (no dialog; deposits closed for new fixtures) |
| INV-P-016 | SubscriptionsDialog / admin sub view | Billing activity View links present | `32-admin-billing.png` | **Pass** |
| INV-P-017 | Discount dialogs | Create discount code dialog fields OK | `50b-discount-create-dialog.png` | **Pass** |

### Actions

| ID | Cases | Actual | Evidence | Status |
|----|-------|--------|----------|--------|
| INV-A-009 | Auto-renew | Account Billing shows **Auto-renewal On** (display). No toggle control to mutate | `46b-account-billing-autorenew.png` | **Pass** (status visible) |
| INV-A-053 | Collab discount | Needs funded/quote path | — | **Blocked** (live deposits closed) |
| INV-A-061 | Approve and release → payout | Requires funded collab | — | **Blocked** (deposits closed). Do not treat UI “Payout processing” as provider bank Pass |
| INV-A-068 | Execute approved refund | Needs refundable provider balance from collab | — | **Blocked** (deposits closed) |
| INV-A-070 | Start subscription checkout | Monthly member billing OK for current Plus; **annual missing Stripe price id**; guest annual CTAs suppressed | `12-billing-member.png`, `40-pricing-annual.png`, `41d-billing-annual-ctas.png` | **Fail** (annual required branch) |
| INV-A-071 | Tax preview | Tax $ / % on plan cards; “Applicable tax shown at checkout” | `12-billing-member.png` | **Pass** (UI quote) |
| INV-A-072 | Schedule/cancel interval change | Annual switch unavailable (missing price) | `41d-billing-annual-ctas.png` | **Fail** |
| INV-A-073 | Preview/change price | Upgrade Pro → **Save a Stripe price before this change** | `44c-upgrade-dialog.png` | **Fail** |
| INV-A-074 | Open Stripe portal | Portal switch On in admin; **Manage billing** absent on member billing | `32-admin-billing.png`, `12-billing-member.png` | **Fail** |
| INV-A-075 | Connect / payout setup | Earnings: Payout setup **Ready**; Connect bank update copy present | `14-creator-payouts.png` | **Pass** (setup UI). New Connect onboarding gate separate |
| INV-A-076 | Country regions helper | Tax/country path present in checkout/admin tax | `12-billing-member.png`, `50b-discount-create-dialog.png` | **Pass** |
| INV-A-086 | Admin plans annual | Editor exposes annual | `52-plan-pricing.png` | **Pass** |
| INV-A-087 | Billing activity inspect | Sandbox sessions visible | `32-admin-billing.png` | **Pass** |
| INV-A-088 | Payment settings discounts | Create/list codes (Subscription + Monthly/Annual) | `33-admin-discounts.png`, `50b-discount-create-dialog.png` | **Pass** (admin). Member redeem blocked by BILL-03 |

### Jobs / notifications / email

| ID | Actual | Status |
|----|--------|--------|
| INV-J-014 | failed_payout_retry_sweep not fired on live shared host | **Blocked** |
| INV-J-022 | subscription_renewal_sweep not triggered (isolation) | **Blocked** |
| INV-N-018…022, INV-N-028 | Payout/refund notification events need money movement | **Blocked** (deposits closed) |
| INV-E-042…052, INV-E-063…065 | Payout/refund emails | **Blocked** (deposits closed + no mail sink on influrios.com) |
| INV-E-074…078 | billing.* emails | **Blocked** (no mail sink; catalog IDs retained) |

### Integrations / downloads / gates

| ID | Actual | Confirmation | Status |
|----|--------|--------------|--------|
| INV-I-001 | `/api/billing/webhook` mounted; `STRIPE_WEBHOOK_SECRET` present (name only) | Env + inventory | **Pass** (mount). Full replay not re-run |
| INV-I-015 | Stripe Checkout/Portal/Connect sandbox | Provider: `livemode=false`; year prices=0; active `sub_1UddzZ…` | **Pass** with catalog gap defect |
| INV-D-005 | Hosted invoice/PDF | Provider-confirmed `in_1UddzZ…` paid + `hosted_invoice_url` + `invoice_pdf` (revalidated) | **Pass** |
| INV-D-006 | In-app invoice download | History COMPLETED only; no download control | **Fail** (COR-24) |
| INV-C-004 | customer_portal | Admin On; member Manage billing missing | **Fail** (effective member path) |
| INV-C-005 | stripe_connect | Earnings setup Ready; onboarding not re-opened | **Pass** (observed ready state) |
| INV-C-016 / INV-AG-005 | Agency upgrade CTA | Present on business billing (“Upgrade to Agency”); destination check — not silent 404 when exercised from monthly card | `21-business-billing.png`, `24-agency-upgrade-cta.png` | **Pass** (destination). Agency product still deferred |

## Provider vs simulation

| Claim | Lens |
|-------|------|
| Admin “Stripe · Sandbox” | UI label aligned with `sk_test_` / MCP livemode=false |
| Invoice `in_1UddzZ…` paid + PDF URLs | **Provider-confirmed** |
| Subscription `sub_1UddzZ…` active | **Provider-confirmed** (note: unit_amount 2900 vs UI “Plus $25” label — identity drift risk / COR-07 family) |
| Year Price objects | **Provider-confirmed absent** (0) |
| Earnings “Payout processing” / UPCOMING NET | **UI only** this run — PAID TO BANK $0; not accepted as provider bank payout Pass |
| Stripe account transfers/payouts exist in sandbox | **Provider-confirmed** historical account activity; **not** tied to AUDIT earnings rows in this pass |
| Collaboration refund/payout emails | **Blocked** — cannot generate without deposits |

## Consistency checks

After billing page loads: sidebar badges (Collaborations/Earnings), notification bell (2), Billing & Plan entry — observed on influencer desktop screenshots. Reload of `/billing` retained Active Plus. Cross-role: business billing independent; admin activity lists influencer checkout sessions.

## Prior evidence

- J18 monthly discount Apply→pay→redeem and J20 hosted invoice retained as historical; **this run revalidated hosted invoice via API**. Fresh member discount apply **not** Pass (blocked by missing Stripe price on upgrade/checkout review).
- Annual Fail COR-03/04 **reconfirmed**.

## Matrix ownership

Updated only the 70 INV-* rows listed in counts above inside `docs/full-platform-audit/coverage-matrix.md`. Did not rewrite unrelated slices.
