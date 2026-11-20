# COR-21 — Deliverable file upload path (broken / incomplete)

**Priority:** P1 · **Kind:** product / ux · **Package:** R4 workroom (paused)  
**Evidence class:** Attach control **reproduced**; end-to-end upload/download **not executed**; limits/UX gaps **code-observed**  
**Atlas / boards:** Board 6 · `design-boards/upload-progress.html` · `upload-fail-retry.html`

## Finding (evidenced)

The Submit version popup shows **Attach files**, and server helpers exist (`deliverable-files.ts`, `saveDeliverableFiles`, `/api/deliverables/[fileId]`). The **end-to-end user path** is not verified and the UX is incomplete:

| Step | Expected | Today |
|------|----------|-------|
| Select file(s) | Visible selection list | `sr-only` input; no chips / names |
| Progress | Determinate or busy state | None |
| Persist | Files stored + DB rows | Code path exists; not proven in J14 media |
| Submit version | Version references files | J14 used **notes only** |
| Reopen | Files listed on version / Files tab | Unproven |
| Business view/download | Open/download via authorized URL | Route coded; no audit download proof |
| Failure: unsupported | Inline explain | Often `fail()` → payments (COR-20) |
| Failure: too large (>8MB) | Inline | Same |
| Failure: store error | Inline + no orphan version | Submission deleted then redirect |
| Remove before submit | Remove control | Missing |
| Expired session | Return to same popup with draft | Login next=/payments |

### Evidence

- UI: `j14r35-creator-submit-open.png` — Attach files control present  
- J14 r35 assertions: submission notes only; no `milestoneFile` / download refs  
- Code: `workspace-milestones.tsx` file input; `actionSubmitMilestone` + `actionAddDeliverableFiles`; `DELIVERABLE_FILE_LIMIT=4`, `DELIVERABLE_FILE_BYTES=8MB`  
- Unit coverage proves type rules, **not** browser upload UX

## Required behavior (design)

### Influencer — submit / revise

1. **Select** — Choosing files shows a list (name, size, type icon) under Attach files.  
2. **Remove** — Each row has Remove (client-only until submit).  
3. **Progress** — On submit, show uploading/saving state; disable double-submit.  
4. **Persist** — On success, files bound to that submission version.  
5. **Reopen** — Version history / Files tab lists them; influencer can re-open own files.  
6. **Limits** — Enforce ≤4 files, ≤8MB each, allowed types; explain inline (COR-20).

### Business

1. Open submitted version → see file list → **View / Download** via `/api/deliverables/{id}`.  
2. Optional Add files (details mode) uses the same progress + inline error rules.  
3. Cross-tenant IDs → not found (no leak).

### Failure / recovery board (must be designed before impl)

| Case | UI |
|------|----|
| Unsupported MIME/ext | Inline: “Upload a document, media file, or zip…”; keep other files |
| Oversize | Inline size message |
| Network / store failure | Inline + Retry; no submitted version |
| Session expired | Re-auth → restore focus + client draft if possible |
| Empty file selection on Add files | Inline “Choose a file…” |

## Acceptance tests (future IPS-14)

1. Select PDF → name visible → Submit with note → version In review → Files tab shows PDF → business downloads bytes.  
2. Select PNG + Remove PNG → submit without that file.  
3. Unsupported `.html` → inline error; stay in popup.  
4. 8MB+1 file → inline error.  
5. After reload, files still listed and downloadable for both authorized parties.  
6. Unauthorized account cannot download.  
7. Recording covers select→progress→persist→submit→reopen→business download.

## Non-goals

- No new commercial document types beyond existing allow-list without product decision.  
- No live deposit required if held fixture funding already exists in sandbox.
