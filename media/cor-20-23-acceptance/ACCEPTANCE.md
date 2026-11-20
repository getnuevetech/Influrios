# COR-20–23 acceptance evidence

Product PR only (no #534 audit docs). Live collaboration deposits unchanged.

## Review follow-up (Ola request changes)

| Item | Fix |
|------|-----|
| Client must not import server modules | Browser-safe `deliverable-file-rules.ts` + `deliverable-link.ts`; FS/crypto/Prisma stay in `deliverable-files.ts` / `milestone-delivery.ts` |
| Form-action dispatch | Submit/Add files use `startTransition(() => formAction(data))`; button disabled while pending |
| Excess files | Explicit `Add up to 4 files.` — no silent `.slice` discard |
| Progress | Indeterminate full-width pulse (no hardcoded `w-2/3`) |
| MIME fallback | Only empty / `application/octet-stream` + explicit aliases; conflicts tested |
| Body size (4×8 MB) | `experimental.serverActions.bodySizeLimit` **and** `experimental.middlewareClientMaxBodySize` set to `40mb` (middleware clone default is 10mb and truncated the batch before the action limit applied) |
| `use server` export | Removed illegal `export type` re-export from `payments/actions.ts` (broke workroom under Turbopack) |

## Evidence kinds (read this first)

| Kind | What it proves | Where |
|------|----------------|-------|
| **Helper / unit** | Pure functions + DB helpers (`saveDeliverableFiles`, `assertFundingAccess`) without HTTP | `runtime-upload-path.txt`, `deliverable-upload-path.test.ts` |
| **HTTP / form POST** | Real Next server: multipart `actionSubmitMilestone` through the workroom page, then `/api/deliverables/[fileId]` | `app-http-evidence.txt` |
| **Browser (Chromium)** | Actual form: select files → submit → reload → reopen → download; fail/retry preserve | `browser-large-batch-evidence.txt`, `browser-retry-evidence.txt`, shot folders |

Helper-only TAP is **not** sufficient for COR-21 application claims. Use the HTTP + browser rows below for Ola’s “actual application” bar.

## Commands

```bash
npx tsx --test src/lib/payment-route.test.ts src/lib/deliverable-upload-path.test.ts src/lib/workspace-decision.test.tsx src/lib/app-origin.test.ts
DOCKER_BUILD=1 npx next build
# Against a running server with DATABASE_URL + AUTH_SECRET:
EVIDENCE_BASE_URL=http://127.0.0.1:3000 npx tsx scripts/cor-21-app-evidence.ts
node scripts/cor-21-browser-retry-evidence.mjs
node scripts/cor-21-browser-large-batch-evidence.mjs
```

## 1) Body size aligned + browser batch >10 MB

Config: both limits `40mb` in `next.config.ts` (asserted in `app-origin.test.ts`).

**Browser proof** (`browser-large-batch-evidence.txt`): Chromium selected `browser-batch-a.pdf` + `browser-batch-b.pdf` (6.0 MB each = **12 MB**), submitted via the workroom dialog → `submitted=1`; persisted `12582912` bytes.

| Shot | File |
|------|------|
| Dialog open | `browser-large-batch-shots/01-submit-dialog-open.png` |
| Two 6 MB files selected | `browser-large-batch-shots/02-files-selected-gt-10mb.png` (+ `cor-21-browser-files-gt-10mb.png`) |
| Submit success | `browser-large-batch-shots/03-submit-success.png` |
| Reload milestones | `browser-large-batch-shots/04-reload-milestones.png` |

HTTP progressive POST of the same size class: `app-http-evidence.txt` (`persisted_batch_gt_10mb=true`).

## 2) Browser application path (select → submit → reload → reopen → download)

Covered by `browser-large-batch-evidence.txt` + shots above, plus files tab reopen:

- `browser-large-batch-shots/05-authorized-files-tab.png`
- Authorized GET status: `browser-large-batch-shots/05-authorized-download-status.txt` / HTTP `download_*_status=200`

## 3) HTTP access checks (real requests)

From `browser-large-batch-evidence.txt` and `app-http-evidence.txt` against `/api/deliverables/{fileId}`:

| Actor | Status |
|-------|--------|
| Business owner | `200` + bytes |
| Assigned influencer | `200` + bytes |
| Unrelated account | `404` |
| Signed out | `401` |

Deny screenshots: `browser-large-batch-shots/06-stranger-deny.png`, `07-signed-out-deny.png` (+ `.txt` status bodies).

## 4) Failure / retry (popup stays open)

`browser-retry-evidence.txt` + shots:

| Shot | File |
|------|------|
| Fail: popup open, note/link/file preserved, **Retry upload** | `cor-21-upload-fail-popup-preserved.png` |
| Retry success | `cor-21-retry-success.png` |
| Reload | `cor-21-reload-reopen.png` |

`browser_retry_preserve_pass=true` — one successful submission only after retry.

## 5) Helper-only (not sufficient alone)

`runtime-upload-path.txt` — helper persist + `assertFundingAccess`. Prefer browser/HTTP rows for application acceptance.

Production build log tail: `production-build-tail.txt`

## UI captures (COR-20/22/23 chrome)

Screenshots / walkthrough under this folder remain useful for stay-in-popup validation chrome and review hub. Static markup alone is **not** the COR-21 runtime proof.
