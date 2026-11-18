# Baseline & commit caveat

## Immutable baseline

| Item | Location |
|------|----------|
| Merged PR | [#532](https://github.com/getnuevetech/Influrios/pull/532) |
| Repo docs | [../staging-visual-audit/](../staging-visual-audit/) (PR #532) |
| Repo media | [../../media/visual-audit/](../../media/visual-audit/) (PR #532) |
| Project store docs | `/cursor/stores/self/docs/visual-audit/` |
| Project store media | `/cursor/stores/self/media/visual-audit/` |
| Credentials notes | `/cursor/stores/self/docs/staging-visual-audit-credentials.md` |

**Do not alter** #532 captures. Additional evidence → dated folders under `media/visual-audit-deltas/`.

## Capture vs current code

| Fact | Value |
|------|-------|
| Staging URL used in audit | https://influrios.com |
| Audit pack generated | 2026-11-18 (Playwright) |
| Viewports | Desktop 1440×900 · Mobile 390×844 |
| Repo HEAD at package time | `e98cea9` (merge of #532 onto main) |
| Staging deploy SHA | **Unknown** — not recorded in `manifest.json` |

**Rule:** Do not attribute a visual defect solely to current `main` without confirming staging still runs the same commit. Prefer evidence links from the baseline pack; treat code references as “likely current implementation” when matching patterns (e.g. `SiteHeader` hiding Log in below `sm`).

## Policy locks for this package

- Agency role deferred (`preferences.md`)
- Payment Standard v2 paused
- No product UI redesign PRs / independent page redesigns in this phase
- No real charges, payouts, invitations, emails, or SMS
