# COR-20–23 acceptance evidence

Product PR only (no #534 audit docs). Live collaboration deposits unchanged.

## Evidence kinds (read this first)

| Kind | What it proves | Where |
|------|----------------|-------|
| **Helper / unit** | Pure functions + DB helpers without HTTP | `runtime-upload-path.txt`, `deliverable-upload-path.test.ts` |
| **HTTP / form POST** | Multipart server action + `/api/deliverables/[fileId]` | `app-http-evidence.txt` |
| **Browser (Chromium)** | Real form + Files-tab download + fail/retry | See sections below |

Helper-only TAP is **not** sufficient for COR-21 application claims.

**Authoritative download / access evidence:** `browser-download-corrective-evidence.txt` (corrective run).  
**Preserved unreconciled prior run:** `prior-run-29db36e-unreconciled/` and labeled `browser-large-batch-run.log` (do not use for download byte / signed-out claims).

## Review follow-up (Ola)

| Item | Fix |
|------|-----|
| Client must not import server modules | Browser-safe `deliverable-file-rules.ts` + `deliverable-link.ts` |
| Form-action dispatch | `startTransition(() => formAction(data))` |
| Excess files | Explicit limit error (no silent `.slice`) |
| Progress | Indeterminate full-width pulse |
| MIME fallback | Empty / `octet-stream` + aliases only |
| Body size (4×8 MB) | `serverActions.bodySizeLimit` **and** `middlewareClientMaxBodySize` = `40mb` |
| `use server` export | Removed illegal `export type` re-export |

## 1) Body size + browser batch >10 MB

Config: both limits `40mb` (`app-origin.test.ts`).

Chromium selected two 6.0 MB PDFs (12 MB) and submitted → `submitted=1` (`browser-large-batch-evidence.txt`, `browser-large-batch-shots/02-files-selected-gt-10mb.png`).  
HTTP same size class: `app-http-evidence.txt` (`persisted_batch_gt_10mb=true`).

## 2–3) Download from Files tab + access matrix (CORRECTIVE — authoritative)

Script: `scripts/cor-21-browser-download-corrective.mjs`  
Log: `browser-download-corrective-run.log`  
Evidence: `browser-download-corrective-evidence.txt`  
Shots: `browser-download-corrective-shots/`

### What the corrective run proved

1. Fresh browser upload of `corrective-cut.pdf` (262 144 bytes).
2. Opened **Files** tab; found `<a href="/api/deliverables/{id}">corrective-cut.pdf</a>`.
3. GET that same href with the influencer session → **200**, **262 144 bytes**, **sha256 match** to the original file (`byte_match_original=true`).
4. All four access checks **ran** (missing actor = fail; no skipped=pass):

| Actor | Status | Notes |
|-------|--------|-------|
| Business owner | `200` + matching sha256 | |
| Assigned influencer | `200` + matching sha256 | Same URL as Files-tab link |
| Unrelated account | `404` body `Not found` | |
| Signed out | `401` body `Sign in to open this file.` | Isolated request with **no** session cookie |

### Why the prior large-batch download artifacts were wrong

| Artifact | What went wrong |
|----------|-----------------|
| `browser-large-batch-run.log` early `http_download_auth_pass=false` / “no download link” | Script looked on Milestones tab; download links live on **Files** tab. Later summary appended HTTP results without rewriting the contradictory early lines. |
| `05-authorized-download-status.txt` = 601 bytes | Chromium **inline PDF viewer stub**, not the file body. Raw GET of the same URL returns full bytes (corrective proves 262 144). |
| `07-signed-out-deny.txt` = `404` | Browser page reused the **stranger** cookie jar. Route for true signed-out is **`401`**. |

Original unreconciled files kept under `prior-run-29db36e-unreconciled/` and the labeled `browser-large-batch-run.log`.

### Corrective shots

| Shot | File |
|------|------|
| Form filled | `browser-download-corrective-shots/01-filled-before-submit.png` |
| Submit success | `browser-download-corrective-shots/02-submit-success.png` |
| Files tab with link | `browser-download-corrective-shots/03-files-tab.png` |
| Byte verification | `browser-download-corrective-shots/04-files-tab-download-verified.txt` |
| Access matrix | `browser-download-corrective-shots/04-access-matrix.txt` |
| Stranger deny | `browser-download-corrective-shots/05-stranger-deny.txt` (+ `.png`) |
| Signed-out deny (`401`) | `browser-download-corrective-shots/06-signed-out-deny.txt` (+ `.png`) |

## 4) Failure / retry (popup stays open)

`browser-retry-evidence.txt` + `cor-21-upload-fail-popup-preserved.png` / `cor-21-retry-success.png` / `cor-21-reload-reopen.png`.  
`browser_retry_preserve_pass=true` — one successful submission after retry.

## 5) Helper-only (not sufficient alone)

`runtime-upload-path.txt`. Prefer corrective browser/HTTP rows for application acceptance.

## Commands

```bash
npx tsx --test src/lib/payment-route.test.ts src/lib/deliverable-upload-path.test.ts src/lib/workspace-decision.test.tsx src/lib/app-origin.test.ts
node scripts/cor-21-browser-download-corrective.mjs   # authoritative download + access
node scripts/cor-21-browser-large-batch-evidence.mjs  # >10MB form submit
node scripts/cor-21-browser-retry-evidence.mjs
```
