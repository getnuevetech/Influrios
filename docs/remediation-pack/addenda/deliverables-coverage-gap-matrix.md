# Deliverables — coverage-gap matrix

**Scope start:** deliverable workflows (files, links, notes, edits, versions, resubmission, review, permissions — both parties).  
**Historical evidence:** #534 @ `db64224` (not complete platform coverage).  
**J14:** note-submission **subtest Pass** · journey **aggregate Partial**.  
**Live deposits:** closed.

## Evidence classes

| Class | Meaning |
|-------|---------|
| **reproduced** | Observed in harness/UI with media or probe |
| **code-observed** / **code-reviewed** | Proven from source / unit tests; **not** runtime acceptance by itself |
| **user-reported** | Owner/reviewer report; must be reproduced separately — lack of test evidence ≠ root cause |
| **not executed** | Expanded audit step not run (orthogonal to user-reported) |

Coverage/acceptance classes (Pass / Partial / Gap / Defect / Blocked) describe product outcome; evidence class describes how we know.

---

## A. Influencer — submit / revise version

| Action | Alt inputs | Failure / recovery | Outcome | Evidence class | Evidence / register |
|--------|------------|--------------------|---------|----------------|---------------------|
| Open Submit version popup | Row CTA · `?focus=&intent=submit` | — | Pass | **reproduced** | `j14r35-creator-submit-open.png` |
| Note ≥8 chars (note-only submit) | Note only | Short note alone → error | Pass (subtest) | **reproduced** | J14 r35 note submit |
| Error stay in popup / preserve inputs | — | Today: `fail()` → `/payments` | Defect | **code-observed** | COR-20; `payments/actions.ts` |
| Deliverable link bare domain | `example.com` · `https://` · `http://` · unsafe | Must normalize/reject inline | Defect | **code-observed** | COR-22; `milestone-delivery.ts` LINK |
| Attach files control visible | — | — | Partial | **reproduced** | Attach files on j14 screenshot |
| Full upload path select→persist→download | 0–4 files | Unsupported / >8MB → Replace/Remove; network → Retry upload | Defect | **user-reported** failure + audit path **not executed** (keep separate) | COR-21; Attach control reproduced; reproduce reported failure before root-causing |
| Selected-file list / replace / remove | — | Missing UI | Gap | **code-reviewed** | `workspace-milestones.tsx` sr-only |
| Upload progress | — | Missing | Gap | **not executed** | COR-21 boards |
| After success version In review | Reopen | Note path OK | Pass (subtest) | **reproduced** | `j14r35-creator-after-submit.png` |
| Resubmit after revision | New note/files | v2 UI thin | Partial | **not executed** (UI) / lib **reproduced** | r35 `v2` via lib |
| Permissions (assigned / business blocked / held) | — | Server + UI gates | Pending acceptance | **code-reviewed** · runtime **not executed** | Must pass authorized-download + cross-account-denial before Pass |

## B. Business — review / files / download

| Action | Alt inputs | Failure / recovery | Outcome | Evidence class | Evidence / register |
|--------|------------|--------------------|---------|----------------|---------------------|
| Open Review popup chrome | — | — | Partial | **reproduced** | `j14r35-biz-*-open.png` |
| Request changes **UI** | Note | — | Gap | **not executed** | COR-23; `uiRevise=false` |
| Approve **UI** → release step | — | — | Gap | **not executed** | COR-23; `uiApprove=false` |
| Lib revise / approve / stale block | — | Stale blocked | Pass (lib subtest) | **reproduced** | r35 assertions |
| Business add files | Multipart | Errors → `/payments` | Defect | **code-observed** | COR-20/21 |
| Download `/api/deliverables/{id}` | — | 401/404 | Gap | **code-reviewed** · runtime **not executed** | Required before acceptance |
| Cross-account deny | — | 404/401 · no leak | Gap | **code-reviewed** · runtime **not executed** | Required before acceptance |

## C. Journey scoring impact

| Journey | Subtest | Aggregate acceptance | Why |
|---------|---------|----------------------|-----|
| **J14** | Note submit→lib revise→lib approve **Pass** | **Partial** | File upload + business Approve/Request-changes **UI** not executed |
| **J18** | Monthly Apply→pay→redeem **Pass** | **Partial** | Annual Fail COR-04 |
| Expanded upload/review/reply edges | — | not complete | Coverage Incomplete **0** is old-checklist only |

## D. Cross-cutting failure matrix (design targets)

| Scenario | Expected | Today | ID | Evidence class |
|----------|----------|-------|----|----------------|
| Invalid / bare link | Stay in popup; normalize or inline reject | Redirect `/payments` + rigid https | COR-20+22 | code-observed |
| Unsupported / oversize file | Inline + **Replace/Remove** (not Retry submit) | Often `fail()` → payments | COR-20+21 | user-reported + code-reviewed; reproduce |
| Upload store / network failure | Inline + **Retry upload**; no orphan version | Delete then redirect | COR-21 | code-reviewed |
| Session expired | Return to same focus | Login next=/payments | COR-20/21 | code-observed |
