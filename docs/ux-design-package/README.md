# Influrios UX design package

**Status:** Ready for Ola review  
**Date:** 2026-11-18  
**Baseline:** PR #532 visual audit (immutable) — [../staging-visual-audit/README.md](../staging-visual-audit/README.md)  
**Policy:** Agency deferred · Payment Standard v2 paused · No product UI redesign PRs in this phase  
**Staging:** https://influrios.com  

This package turns the staging visual audit into a coordinated redesign brief: evidence-linked coverage, journeys, issues, navigation, shared UI, critical designs, backlog, and acceptance checks.

---

## Start here

| # | Deliverable | Link |
|---|-------------|------|
| 0 | Baseline & commit caveat | [baseline.md](./baseline.md) |
| 1 | Coverage matrix | [coverage-matrix.md](./coverage-matrix.md) |
| 2 | Journey reviews | [journey-reviews.md](./journey-reviews.md) |
| 3 | Issue register (P0–P3) | [issue-register.md](./issue-register.md) |
| 4 | Navigation map | [navigation-map.md](./navigation-map.md) |
| 5 | Shared UI specification | [shared-ui-spec.md](./shared-ui-spec.md) |
| 6 | Screen designs (critical) | [designs/README.md](./designs/README.md) |
| 7 | Implementation backlog | [implementation-backlog.md](./implementation-backlog.md) |
| 8 | Acceptance checklist | [acceptance-checklist.md](./acceptance-checklist.md) |
| 9 | Coverage / gaps report | [coverage-gaps.md](./coverage-gaps.md) |
| — | Applied Ola §7 product requirements | [product-requirements.md](./product-requirements.md) |
| — | Capture deltas | [deltas/README.md](./deltas/README.md) |

### Evidence pointers

| Kind | Path |
|------|------|
| Project store audit docs | `/cursor/stores/self/docs/visual-audit/` |
| Project store screenshots/recordings | `/cursor/stores/self/media/visual-audit/` |
| Repo mirror (main) | [../staging-visual-audit/](../staging-visual-audit/), [../../media/visual-audit/](../../media/visual-audit/) |
| New captures only | `/cursor/stores/self/media/visual-audit-deltas/YYYY-MM-DD/` (not mirrored in-repo unless added) |

---

## Decisions needed from Ola

1. Approve nav map + shared popup rules (centered list detail/edit; no under-table / right-rail substitutes).  
2. Confirm Active Collaborations badge semantic (attention vs active count).  
3. Agency: hide plan CTA + footer link until Agency onboarding exists?  
4. Admin chrome: remove marketing top nav in `/admin`?  
5. When to enable live Discover (guest gates) for remaining booking evidence.  
6. Priority order of backlog packages 1–3 (mobile chrome → requests popup → active overview).

---

## Top evidence-linked risks

| P | Issue | One-line |
|---|-------|----------|
| P1 | MOBILE-NAV/LOGIN | Mobile guests cannot use header nav or Log in |
| P1 | REQUEST-POPUP / ACTIVE-OVERVIEW | §7 list→popup pattern not fully evidenced / specified for build |
| P1 | CHECKOUT-TOTALS | Blocked — need sandbox for discount+tax consistency |
| P2 | ADMIN-KPI / INBOX-DUP / BADGE | Status & count trust problems |
| P2 | DISCOVER-SAMPLE | Live booking UX still gated |

---

## What this phase did **not** do

- No product UI code changes / redesign PRs  
- No Payment Standard v2 work  
- No Agency role audit  
- No real charges, payouts, invitations, emails, or SMS  
- No alteration of PR #532 captures (delta folder noted empty for 2026-11-18)
