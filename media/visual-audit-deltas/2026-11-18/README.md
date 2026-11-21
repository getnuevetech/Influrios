# Visual audit deltas — 2026-11-18

**Purpose:** Dated folder for captures taken *after* baseline PR #532.  
**Do not alter** `#532` media under `media/visual-audit/`.

## This revision (PR #533)

Safe **read-only** captures added for Ola’s revision ask. No accept / withdraw / delete / sign / fund / save / email / SMS.

| Workflow | Captures | Notes |
|----------|----------|-------|
| Business requests | `screenshots/business/{desktop,mobile}/requests-list.png`, `request-detail-popup.png`, `request-edit.png` | View + edit opened; unsaved |
| Active collaborations | `.../active-list.png`, `active-overview-popup.png` (business); influencer `active-list.png`, `active-detail.png` | Open/overview only |
| Contract viewing | `.../contracts-list.png`, `contract-viewer.png` (business + influencer) | **Did not** submit signature |
| Tax editing | `screenshots/admin/{desktop,mobile}/tax-settings.png`, `tax-edit.png` | Add/edit form opened; **no** Save/Delete/Sync |

Manifest: [`manifest.json`](./manifest.json)

## Still blocked / not captured

- Invitation accept/withdraw, request delete  
- Milestone submit, funding, payouts, checkout totals  
- Contract signing completion / customer emails  
- Agency journeys · Payment Standard v2  

See [`docs/ux-design-package/coverage-gaps.md`](../../../docs/ux-design-package/coverage-gaps.md).
