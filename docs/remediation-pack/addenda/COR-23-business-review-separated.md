# COR-23 — Business review UI: separate Request changes from Approve

**Priority:** P2 · **Kind:** audit-label / ux · **Package:** R4 workroom (paused)  
**Evidence class:** Review UI **not executed** (`uiRevise=false`, `uiApprove=false`); lib revise/approve **reproduced**  
**Boards:** `design-boards/business-review-actions.html`

## Finding

J14 proved note-path delivery with **library** revise/approve. Business **Request changes** and **Approve** controls were not exercised in the popup UI.

## Required behavior (design)

1. **Review hub** — Choose either “Request changes…” or “Approve version N…” (one path).  
2. **Request changes step** — Required feedback field; primary = Send change request; **no Approve** on this screen.  
3. **Approve confirmation step** — Shows version identity, files/link, and consequences (delivery approved ≠ bank payout). Primary = Approve version N. **No revision textarea.** “Need changes instead” returns to the request-changes path.  
4. Never place Approve beside a feedback box (prevents accidental approve while typing).

## Acceptance (future impl)

Desktop + mobile recordings for both paths; stale-version still blocked; feedback-required enforced server-side.
