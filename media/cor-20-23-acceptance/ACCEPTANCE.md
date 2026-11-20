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
| **Browser (headed automation)** | Select files → submit → popup stays on upload failure with note/link/files → retry → one success → reload | `browser-retry-evidence.txt`, `cor-21-*.png`, `browser-shots/` |

Helper-only TAP is **not** sufficient for COR-21 application claims. Use the HTTP + browser rows below for Ola’s “actual application” bar.

## Commands

```bash
npx tsx --test src/lib/payment-route.test.ts src/lib/deliverable-upload-path.test.ts src/lib/workspace-decision.test.tsx src/lib/app-origin.test.ts
DOCKER_BUILD=1 npx next build
# Against a running server (dev or `next start`) with DATABASE_URL + AUTH_SECRET:
EVIDENCE_BASE_URL=http://127.0.0.1:3000 npx tsx scripts/cor-21-app-evidence.ts
node scripts/cor-21-browser-retry-evidence.mjs   # needs Chrome + seeded fixture from the HTTP script
```

## HTTP application evidence (COR-21)

See `app-http-evidence.txt` (and run log `app-http-evidence-run.log`).

Proves against the live app:

1. **Valid batch >10 MB** through the workroom submit form (progressive `$ACTION_ID_` multipart POST for `actionSubmitMilestone`): 2×6 MB PDFs → `303` with `submitted=1`; persisted `12582912` bytes (`persisted_batch_gt_10mb=true`) — does **not** fail at the 10mb middleware/body limit before inline validation.
2. **Reload / reopen**: work page `200` after submit; submission visible.
3. **Authorized download**: owner + influencer `GET /api/deliverables/{fileId}` → `200` with bytes.
4. **Deny**: unrelated business account → `404`; signed out → `401`.
5. **Failed upload + retry (HTTP)**: store dir made unwritable → no submission row; restore → one `submitted=1` (`retry_one_success=true`).

## Browser application evidence (COR-21 retry UX)

See `browser-retry-evidence.txt` and screenshots:

| Shot | File |
|------|------|
| Upload fail, popup open, note/link/file preserved, **Retry upload** | `cor-21-upload-fail-popup-preserved.png` |
| Retry success (`submitted=1`) | `cor-21-retry-success.png` |
| Reload / reopen after success | `cor-21-reload-reopen.png` |
| Full sequence | `browser-shots/01` … `05` |

`browser_retry_preserve_pass=true`: dialog stayed open on “The file could not be stored. Nothing was saved.”; note, link, and `retry.pdf` preserved; retry → single successful submission.

## Helper-only runtime (still useful, not sufficient alone)

See `runtime-upload-path.txt` (TAP). Proves helper path persistence + `assertFundingAccess` parties/deny. Prefer HTTP/browser rows above for application acceptance.

Production build log tail: `production-build-tail.txt`

## UI captures (COR-20/22/23 chrome)

Screenshots / walkthrough under this folder remain useful for stay-in-popup validation chrome and review hub. Static markup alone is **not** the COR-21 runtime proof.
