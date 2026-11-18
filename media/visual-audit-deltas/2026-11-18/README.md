# Visual audit deltas — 2026-11-18

**Purpose:** Dated folder for captures taken *after* baseline PR #532.  
**This pass:** No new screenshots or recordings were added.

Evidence review for the UX design package reused:

- Repo baseline media: [`../../visual-audit/`](../../visual-audit/) (275 screenshots + 4 recordings + `manifest.json`, from PR #532)
- Repo audit docs: [`../../../docs/staging-visual-audit/`](../../../docs/staging-visual-audit/)
- UX design package: [`../../../docs/ux-design-package/`](../../../docs/ux-design-package/)
- Project store baseline (agent workspace): `/cursor/stores/self/media/visual-audit/`

Missing workflows (request edit popup states, invitation accept/withdraw, workroom milestones, contract PDF/signing completion, checkout totals with discount+tax, tax edit/preview) are marked **blocked** or **gap** in the design package coverage docs rather than captured here — money/notification actions require isolated mocks, and Discover remains in sample mode.

When new captures are added later, record for each file:

| Field | Value |
|-------|-------|
| Environment | e.g. https://influrios.com |
| App commit | SHA if known |
| Viewport | 1440×900 or 390×844 |
| Role | public / influencer / business / admin |
| URL | full URL |
| Capture date | ISO date |
