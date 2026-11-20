# COR-21 — Deliverable file upload path (broken / incomplete)

**Priority:** P1 · **Kind:** product / ux · **Package:** R4 workroom (paused)  
**Evidence class:**  
- **user-reported** — file upload broken (product owner); must be **reproduced**; lack of audit test evidence ≠ root cause  
- Attach control **reproduced** in J14 screenshot  
- Full E2E audit path still **not executed** (keep separate from user-reported)  
- Limits/UX gaps **code-reviewed**  

**Atlas / boards:** Board 6 · `design-boards/upload-progress.html` · `upload-fail-retry.html`

## Finding (evidenced)

The Submit version popup shows **Attach files**, and server helpers exist (`deliverable-files.ts`, `saveDeliverableFiles`, `/api/deliverables/[fileId]`). **User-reported:** upload fails in practice — reproduce that failure before declaring a code root cause. Separately, the **audit E2E path** (select→progress→persist→submit→reopen→business download) remains **not executed**. Incomplete tests do not explain the reported break.

| Step | Expected | Today |
|------|----------|-------|
| Select file(s) | Visible selection list | `sr-only` input; no chips / names |
| Progress | Determinate or busy state | None |
| Persist | Files stored + DB rows | Code path exists; not proven in J14 media |
| Submit version | Version references files | J14 used **notes only** |
| Reopen | Files listed on version / Files tab | Unproven |
| Business view/download | Open/download via authorized URL | Route coded; no audit download proof |
| Failure: unsupported | Inline + **Replace file** / **Remove file** (not Retry submit) | Often `fail()` → payments (COR-20) |
| Failure: too large (>8MB) | Inline + Replace / Remove | Same |
| Failure: temporary network/storage | Inline + **Retry upload**; no orphan version | Submission deleted then redirect |
| Remove / replace before submit | Controls present | Missing / sr-only |
| Expired session | Return to same popup with draft | Login next=/payments |
| User-reported broken upload | Reproduce exact step/error | Reported; reproduction pending in pack |

### Evidence

- **user-reported:** upload broken — reproduce before root-cause; missing tests ≠ cause  
- UI: `j14r35-creator-submit-open.png` — Attach files control present  
- J14 r35 assertions: submission notes only; no `milestoneFile` / download refs (**not executed** audit path)  
- Code-reviewed: `workspace-milestones.tsx` file input; `actionSubmitMilestone` + `actionAddDeliverableFiles`; limits 4×8MB  
- Unit coverage proves type rules, **not** browser upload UX

## Required behavior (design)

### Influencer — submit / revise

1. **Select** — Choosing files shows a list (name, size, type icon) under Attach files.  
2. **Replace / Remove** — Each row has Replace file and Remove file (client-only until submit).  
3. **Progress** — On submit, show uploading/saving state; disable double-submit.  
4. **Persist** — On success, files bound to that submission version.  
5. **Reopen** — Version history / Files tab lists them; influencer can re-open own files.  
6. **Limits** — Enforce ≤4 files, ≤8MB each, allowed types; explain inline (COR-20).

### Business

1. Open submitted version → see file list → **View / Download** via `/api/deliverables/{id}`.  
2. Optional Add files (details mode) uses the same progress + inline error rules.  
3. Cross-account IDs → denial (no leak). **Runtime** authorized-download + cross-account-denial required before acceptance (code-reviewed alone is insufficient).

### Failure / recovery board (must be designed before impl)

| Case | UI |
|------|----|
| Unsupported MIME/ext | Inline + **Replace file** / **Remove file**; keep note/other files; **no** Retry submit |
| Oversize | Inline size + Replace / Remove |
| Temporary network / store failure | Inline + **Retry upload**; no submitted version |
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
