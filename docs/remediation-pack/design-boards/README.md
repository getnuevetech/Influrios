# Deliverables design boards (desktop + mobile)

Proposed UI states for COR-20–23 before IPS-14. **Illustrative only** — no commercial rates; no product code in this pack.

| Board | Desktop | Mobile (390) | COR |
|-------|---------|--------------|-----|
| Upload progress | [upload-progress.html](./upload-progress.html) | same file `#mobile` | COR-21 |
| Upload fail / retry | [upload-fail-retry.html](./upload-fail-retry.html) | same | COR-21 |
| Preserved-input submission errors | [preserved-input-errors.html](./preserved-input-errors.html) | same | COR-20 |
| Normalized links | [normalized-links.html](./normalized-links.html) | same | COR-22 |
| Business review actions | [business-review-actions.html](./business-review-actions.html) | same | COR-23 |

Shared tokens: [_design-system.css](./_design-system.css).

## Acceptance snapshot

1. Upload shows progress; fail keeps popup + Retry.  
2. Validation errors keep note/link/files; no auto-nav to Collaboration payments.  
3. Bare domain shows normalized `https://` preview; unsafe rejected inline.  
4. Business sees Request changes + Approve in the review popup (both viewports).
