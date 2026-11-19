# Visual review (revision r3.5 — expanded beyond samples)

Manual readable-size review against centered-popup design + nav/a11y checklist. Geometry automation is supporting only.  
**Audit NOT complete** — product findings stay in correction register.

## Coverage this revision (`vis35-*`)

| Family | Desktop 1440 | Mobile 390 | Notes |
|--------|--------------|------------|-------|
| Public home / pricing / discover / login / faq / about | yes (+ scroll) | yes (home/pricing/discover/login/faq) | keyboard Tab samples on desk |
| Login empty-submit validation | yes | — | `vis35-login-validation.png` |
| Business hub + workroom focus dialog | yes | biz hub + more menu | centered dialog on workroom (`vis35-workroom-dialog-*`) |
| Influencer hub | yes | — | |
| Admin home / accounts / matching / payment / marketplace | yes | admin home | **dual chrome reproduced** |
| J14 workroom states | `j14r35-*` both parties | — | submit / revise / v2 / approve dialogs |
| J24 denial | 404 unrelated workroom | — | |

## Checklist outcomes

| ID | Result | Evidence |
|----|--------|----------|
| Centered workroom dialog | **Pass (expanded)** | `vis35-workroom-dialog-desk.png`, `j14r35-*` |
| Keyboard/focus samples | **Partial→covered** | Tab on public pages; no BODY-only landing flagged this run |
| Scroll states | **Covered** | `vis35-*-desk-scroll.png` |
| Login validation | **Covered** | empty submit capture |
| Nav consistency / admin chrome | **Fail / reproduced** | `vis35-admin-home-desk.png` — public Home/Discover/Pricing + admin sidebar |
| Creator→Influencer terminology | **Fail / reproduced** | Admin “Top Creator Categories”; Influencer cards / Creator wording |
| Mobile hubs / more menu | **Covered** | `vis35-biz-hub-mob.png`, `vis35-mobile-more-menu.png` |
| Full J30 matrix | **Pass coverage** | Expanded beyond prior samples; open UX defects tracked as COR-09 |

## Honesty rule

Visual coverage Pass does **not** close money journeys (J15/J16-year/J17/J18/J20) or matching (J28).
