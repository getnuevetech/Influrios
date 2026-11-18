# Influrios staging visual audit pack

**Status:** Ready for Ola review  
**Staging:** https://influrios.com  
**Generated / reviewed:** 2026-11-18 (Playwright pack + visual issue review)  
**Agency:** deferred / untested (see [coverage](./coverage.md))  
**Policy:** No real money, no real customer notifications, no UI redesign, Payment Standard v2 paused.

## Browse

| Deliverable | Link |
|-------------|------|
| **HTML atlas (browsable)** | [index.html](./index.html) |
| **Screen atlas (markdown)** | [atlas.md](./atlas.md) |
| **Customer journeys** | [journeys.md](./journeys.md) |
| **Workflow recordings** | [recordings.md](./recordings.md) |
| **Issue register** | [issues.md](./issues.md) |
| **Coverage report** | [coverage.md](./coverage.md) |
| **Route inventory** | [inventory.md](./inventory.md) |
| **Credentials / staging notes** | [../staging-visual-audit-credentials.md](../staging-visual-audit-credentials.md) |

Media root: [`../../media/visual-audit/`](../../media/visual-audit/) (screenshots + recordings + `manifest.json`).

**Second-audit UX design package:** [`../ux-design-package/`](../ux-design-package/README.md) · evidence hub [`../ux-design-package/evidence.md`](../ux-design-package/evidence.md) · deltas [`../../media/visual-audit-deltas/2026-11-18/`](../../media/visual-audit-deltas/2026-11-18/README.md).

**Downloads** (split so chat can fetch them; all under [downloads/](./downloads/)):

1. [docs.zip](./downloads/influrios-visual-audit-docs.zip) (24KB)
2. [recordings.zip](./downloads/influrios-visual-audit-recordings.zip) (2.3MB)
3. [screenshots-public-desktop.zip](./downloads/influrios-visual-audit-screenshots-public-desktop.zip)
4. [screenshots-public-mobile.zip](./downloads/influrios-visual-audit-screenshots-public-mobile.zip)
5. [screenshots-influencer.zip](./downloads/influrios-visual-audit-screenshots-influencer.zip)
6. [screenshots-business.zip](./downloads/influrios-visual-audit-screenshots-business.zip)
7. [screenshots-admin-desktop.zip](./downloads/influrios-visual-audit-screenshots-admin-desktop.zip)
8. [screenshots-admin-mobile.zip](./downloads/influrios-visual-audit-screenshots-admin-mobile.zip)

## Roles covered

- Public (guest)
- Influencer (`AUDIT_INFLUENCER_*`)
- Business (`AUDIT_BUSINESS_*`)
- Admin (`AUDIT_ADMIN_*`)
- **Agency — skipped** per preferences

## Method

1. Inventory routes from the Influrios repository.
2. Playwright against https://influrios.com with Cloud Agent `AUDIT_*` secrets.
3. Desktop + mobile captures; opportunistic tabs/dialogs/validation/restricted states.
4. Short workflow recordings without payment confirmation or customer notification sends.

## Counts

- Screenshots: **275**
- Recordings: **4**
- Issue register entries: **7** (2 high, 3 medium, 2 low) — start at [issues.md](./issues.md)
