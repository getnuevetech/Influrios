# COR-20 — Deliverable errors must stay in the milestone popup

**Priority:** P1 · **Kind:** product / ux · **Package:** R4 workroom (paused)  
**Evidence class:** **code-observed** (redirect behavior); popup chrome **reproduced** (`j14r35-creator-submit-open.png`); error→payments diversion itself **not executed** as a headed capture  
**Atlas / boards:** Board 6 · `design-boards/preserved-input-errors.html`

## Finding (evidenced)

Updating a deliverable (submit version, request changes, add files) that fails validation or storage currently routes many errors through `fail()` → **`/payments?error=…`** (“Collaboration payments”), which:

1. Closes the milestone focus popup  
2. Drops the user onto the payments list  
3. Discards typed note, link, and selected files  
4. Offers no in-context Retry

### Code evidence (workspace `main` / product tree; behavior present at freeze lineage)

```40:42:src/app/payments/actions.ts
function fail(message: string): never {
  redirect(`/payments?error=${encodeURIComponent(message)}`);
}
```

`actionSubmitMilestone` uses `fail()` for access denials, file validation failures, and `submitMilestoneWork` content/errors (including the https link message). Success and some workspace-state errors use `failWork` / `workspaceReturn` back to the workroom — **inconsistent**.

Payments chrome title: “Collaboration payments” (`payments-panel.tsx`).

### Audit evidence

- Happy-path popup: `media/e2e-audit/local-journeys/j14r35-creator-submit-open.png`  
- J14 did not capture the error→payments diversion; defect is **code-proven** and must be registered before claiming deliverable UX complete.

## Required behavior (design)

| Rule | Detail |
|------|--------|
| Keep user in milestone popup | On validation/storage/permission-soft failures from submit/revise/add-files |
| Inline error | One clear message in the dialog (amber/destructive per Spec tokens) |
| Preserve inputs | Note, link text, and already-selected files remain |
| Retry | Primary control re-submits without re-navigating |
| Navigate away only on explicit action | e.g. Cancel, Close, or labelled “View collaboration payments” |
| Hard auth failures | Sign-in return URL must restore `/collaboration/work/{id}?tab=…&focus=…&intent=…` (not bare `/payments`) |

### Flow (happy vs error)

```
Influencer opens Submit version popup
  → fills note / link / files
  → Submit
      ├─ OK → stay on workroom; popup closes or shows success; version In review
      └─ FAIL → popup remains; inline error; inputs kept; Retry enabled
           (do NOT redirect to /payments)
```

Same pattern for business Request changes and Add files.

## Acceptance tests (for future IPS-14 PR — not run as product fix now)

1. Submit with short note and no link/file → error text visible **inside** focus dialog; URL still `/collaboration/work/{id}?...focus=...`; note field retains text.  
2. Submit with invalid link → same stay-in-dialog behavior (see COR-22).  
3. Attach unsupported type → inline error; other fields preserved.  
4. Click Retry after fixing input → success path without visiting `/payments`.  
5. Click explicit “View payments” → `/payments` allowed.  
6. Business Request changes with empty note → stay in review popup.  
7. Desktop 1440 + mobile 390: dialog remains usable with error banner.

## Non-goals

- Do not invent fee/rate changes.  
- Do not reopen live deposits.  
- Do not merge product fixes into #534 history.
