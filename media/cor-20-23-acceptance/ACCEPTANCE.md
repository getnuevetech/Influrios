# COR-20–23 acceptance evidence

Product PR only (no #534 audit docs). Live collaboration deposits unchanged.

## Unit / code evidence

```bash
npx tsx --test src/lib/payment-route.test.ts src/lib/workspace-decision.test.tsx src/lib/version-review.test.ts
# 15 pass
```

| ID | Proof |
|----|-------|
| COR-20 | `actionSubmitMilestone` / revise / add-files return `workroomResult` (no `fail(`/payments)`); client forms keep popup + drafts; `requireWorkroomAccount` restores focus URL |
| COR-21 | File list Replace/Remove/progress in `deliverable-file-field.tsx`; **user-reported upload failure reproduced**: browsers sending `application/x-zip-compressed` (and similar vendor MIME) were rejected because `deliverableFileRule` only trusted empty/`octet-stream` + extension — fixed via aliases + allow-listed extension fallback. Download route still uses `assertFundingAccess` (401 unauth / 404 cross-account). Runtime headed download not run here (no Postgres in this agent image). |
| COR-22 | `normalizeDeliverableLink` + `Will save as…` preview; bare domain → `https://`; `http://` / `javascript:` rejected; success redirect carries `savedAs` |
| COR-23 | Review hub chooses Request changes… vs Approve version N…; changes step has no Approve; approve/release step has “Need changes instead” and no feedback textarea |

## UI captures

Rendered from **real** `WorkspaceDialogBody` / client form components (`scripts/render-cor-evidence.mjs`):

- `submit-error-desktop.html` / `submit-error-mobile.html` — COR-20
- `link-normalize-desktop.html` — COR-22 Will save as
- `review-hub-desktop.html` — COR-23 hub
- `request-changes-desktop.html` / `request-changes-mobile.html` — COR-23 changes only

### Screenshots (headed, real `WorkspaceDialogBody` markup)

- `cor-20-submit-error-desktop.webp` / `cor-20-submit-error-mobile.webp`
- `cor-20-link-normalize-desktop.webp`
- `cor-20-review-hub-desktop.webp`
- `cor-20-request-changes-desktop.webp` / `cor-20-request-changes-mobile.webp`

### Recording

- `cor-20-23-acceptance-walkthrough.mp4` — hub → request changes → link normalize → submit error

### Still open / environment limits

- Headed runtime upload → persist → business download against live Postgres was not available in this agent image (`DATABASE_URL` unset). Download auth remains code-proven via `assertFundingAccess` + unit source assert; re-run on sandbox fixture before launch.
