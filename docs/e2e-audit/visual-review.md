# Visual review vs adopted centered-popup design (rev r2)

Manual readable-size review of captured screens against PR #533 / `docs/ux-design-package` acceptance checklist. Geometry automation is supporting only.

## Samples reviewed

| Surface | Viewport | File | Presentation | Notes |
|---------|----------|------|--------------|-------|
| Business Create request | desktop | `screenshots/business/desktop/j30-popup-business-collaboration-business__popup-open.png` | **Centered modal over list** | Title, Close, stepper, sticky Save draft/Next — aligns with A-REQ-01/02 intent |
| Business request detail | mobile 390 | `screenshots/business/mobile/j30-popup-business-mobile__open.png` | **Full-viewport overlay** | Title + Close; Overview/Invitations/Activity; actions reachable — A-ACTIVE-03 / mobile editor direction |
| Admin tax edit | desktop | `screenshots/admin/desktop/j30-popup-admin-admin-payment-settings-section-tax__popup-open.png` | **Centered modal** | Country + Product/charge fields present (A-TAX-01 direction). **Dual chrome:** marketing public nav still visible above admin ops |
| Admin accounts view | desktop | `screenshots/admin/desktop/j30-popup-admin-admin-accounts__popup-open.png` | Centered (prior geom Pass) | Supporting |
| Admin plans edit | desktop | `screenshots/admin/desktop/j30-popup-admin-admin-plans__popup-open.png` | Centered (prior geom Pass) | Supporting |
| Influencer contracts | desktop | `screenshots/influencer/desktop/j30-popup-influencer-collaboration-contracts__popup-open.png` | Centered (prior geom Pass) | Supporting |

## Checklist outcomes (this revision)

| ID | Result | Evidence |
|----|--------|----------|
| A-REQ-01 / centered create | **Pass (sample)** | Create request centered on desktop |
| A-TAX-01 tax popup fields | **Pass (sample)** | Country + Product/charge in Edit tax rule |
| A-ADMIN-CHROME-01 | **Fail / reproduced** | Admin pages still show full marketing nav alongside ops sidebar |
| A-TERM-CREATOR-001 | **Fail / reproduced** | Business sidebar still says “Discover Creators” |
| A-AGENCY-PLAN / footer Agency | **Deferred inventory** | Agency links still exposed; workflow not certified |
| Full J30 matrix all routes/viewports | **Partial** | Only sampled families; keyboard/focus/scroll-lock not interactively certified this revision |

## Issue register adds

See `issues.csv` / `issues.json` for VIS-ADMIN-DUAL-CHROME and VIS-TERM-CREATORS.

## Honesty rule

Passing geometry on a sample dialog does **not** mark J04–J15 journeys complete.
