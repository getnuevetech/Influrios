---
cursor:
  subagentId: "bc-a80d300f-8f5e-5116-a3bb-8c2cbdedf2eb"
---

# IPS-25 Not-tested chase results

**Slice:** `nt-chase` — close remaining **Not tested** matrix rows  
**Host:** https://influrios.com · revision `40b6288`  
**When:** 2026-11-20  
**Constraint:** Live deposits **closed**. Agency stays **Explicitly deferred** only. Blocked/Not tested never folded into aggregate Pass.  
**Evidence:** `./media/nt-chase/`  
**Raw:** `chase-results.json`, `chase-results.tsv`

## Chase outcome (89 former Not tested rows)

| Status | Count |
|--------|------:|
| Pass | 54 |
| Fail | 2 |
| Blocked | 33 |
| Not tested | **0** |
| Explicitly deferred | 0 (Agency untouched) |

## Whole-matrix header after chase

| Metric | Before | After |
|--------|-------:|------:|
| Matrix rows | 476 | 476 |
| Not tested | 89 | **0** |
| Pass | 233 | **287** |
| Fail | 15 | **17** |
| Blocked | 129 | **162** |
| Explicitly deferred | 10 | 10 |

## Failures (new)

| ID | Finding | Evidence |
|----|---------|----------|
| INV-J-020 | `invitation_followup_sweep` listed with **latest: never** + crontab/CRON_SECRET warning | `inv-j-jobs-page.png` |
| INV-J-021 | `quote_expiry_sweep` listed with **latest: never** + crontab warning | `inv-j-jobs-page.png` |

## Blocked themes (concrete)

| Theme | Examples | Reason |
|-------|----------|--------|
| Missing deep-link fixtures | INV-R-061/062/065, INV-A-029/039/045 | No applications/openings/records `{id}` on audit accounts |
| Collab mutation fixtures | INV-A-034/036/037/042/053/055/062/064/065 | CTA absent or needs quote/series/dispute/inquiry state; deposits closed for create-deal |
| AI tailor | INV-P-004, INV-A-054 | `contract_ai_tailor` off / no Tailor control on wizard |
| Notification kinds | INV-N-023…026,029…034 | Cannot fire ops/dispute kinds on live; no historical centre match |
| Jobs enqueue-only | INV-J-001 | `invitation_email` not listed until enqueued |
| Destructive / demo gates | INV-C-013, INV-C-015 | Demo Discover blocks unpublished check; delete present but not executed on funded fixture |
| Dialogs | INV-P-019 | NoticeDialog not triggered |

## Pass highlights

- Public routes: `/`, `/card`, `/faq`, `/trust`, `/legal`, `/legal/privacy-policy`, `/q` invalid handled, `/c/ag-olomola-2`, `/creators/ag-olomola-2`
- Creator: analytics, media-kit, KYC, links, account details/prefs, CREATOR_NAV
- Business: intelligence; campaigns/workspace alias into collab hub; BUSINESS_NAV; team detail `/collaboration/team/cmw9qs2tx00baqv01xvpsbn1r`
- APIs: `/api/places` 200; `/api/qr/ag-olomola-2` SVG 200; deliverable download 200 / 2,015,041 bytes
- Gates: `financial_reports` checkbox on; `paid_mentoring` off (“Paid mentoring is off”); `contract_ai_tailor` absent; mobile Log in `visible=false`; CMS default NAV
- Jobs listed operable: INV-J-006/010/011/015/017
- Mentorship community UI (INV-A-078); media kit (INV-D-007); contract print controls (INV-D-008)

## Method notes

- Playwright desktop (+ mobile samples) with AUDIT influencer/business/admin secrets (values not recorded).
- Workroom fixture reused: `cmw9ybc0m005io901ek96km44`.
- INV-N-026 initial false positive on inbox “resolved” filter → corrected to **Blocked**.
- INV-A-069 not Pass-aggregated from workroom → **Blocked** (dashboard-own path absent).

## Artifacts

| Path | Role |
|------|------|
| `docs/full-platform-audit/coverage-matrix.md` | Shared matrix updated; Not tested = 0 |
| `docs/full-platform-audit/execution/not-tested-chase-results.md` | This report |
| `media/nt-chase/*` | Screenshots + JSON probes |
