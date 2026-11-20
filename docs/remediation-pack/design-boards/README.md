# Deliverables design boards (desktop + mobile)

Proposed UI states for COR-20–23 before IPS-14. **Illustrative only** — no commercial rates; no product code in this pack.

**Ola board corrections (post-561fe53):** unsupported/oversized → Replace/Remove (not Retry submit); Retry only for temporary network/storage; “Will save as…” before persist / “Saved as…” after; Request changes separated from Approve confirmation.

| Board | File | COR |
|-------|------|-----|
| Upload progress | [upload-progress.html](./upload-progress.html) | COR-21 |
| Upload fail (replace/remove vs retry) | [upload-fail-retry.html](./upload-fail-retry.html) | COR-21 |
| Preserved-input submission errors | [preserved-input-errors.html](./preserved-input-errors.html) | COR-20 |
| Normalized links | [normalized-links.html](./normalized-links.html) | COR-22 |
| Business review (separated paths) | [business-review-actions.html](./business-review-actions.html) | COR-23 |

Previews (rendered): [`previews/`](./previews/)

| Preview | Path |
|---------|------|
| Upload fail desk/mob | `previews/upload-fail-retry-desktop.png` · `…-mobile.png` |
| Normalized links | `previews/normalized-links-desktop.png` · `…-mobile.png` |
| Business review | `previews/business-review-actions-desktop.png` · `…-mobile.png` |
| Upload progress | `previews/upload-progress-desktop.png` |
| Preserved-input errors | `previews/preserved-input-errors-desktop.png` |

Shared tokens: [_design-system.css](./_design-system.css).

## Acceptance snapshot

1. Unsupported/oversized → **Replace file** / **Remove file**; **Retry upload** only for temporary network/storage.  
2. Before submit: **Will save as…**; after persistence: **Saved as…**.  
3. Request changes (required feedback) and Approve (version + consequences) are **separate steps** — never Approve beside revision text.  
4. Permissions/download: code-reviewed ≠ accepted until authorized-download + cross-account-denial runtime tests pass.
