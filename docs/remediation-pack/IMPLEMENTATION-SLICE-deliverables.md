# Deliverables implementation slice — for Ola approval

**Status:** Design-ready proposal · **NOT authorized to implement** until Ola approves.  
**No broad remediations** in this slice. Live collaboration deposits stay closed.  
**Baseline:** #534 pack @ latest reviewability boards.

## Goal

One focused PR family (or single PR if small) that remediates **COR-20 / COR-21 / COR-22 / COR-23** deliverable workroom UX only — after approval.

## In scope (after approval)

| ID | Work |
|----|------|
| COR-20 | Submit/revise/add-files errors stay in milestone popup; inline error; preserve inputs; navigate to payments only on explicit action |
| COR-21 | File select → list/remove/replace → progress → persist → submit → reopen → business view/download; unsupported/oversize → Replace/Remove; Retry upload only for temporary network/storage; **reproduce user-reported upload failure** (do not treat missing test as root cause) |
| COR-22 | Accept bare domain; preview **Will save as https://…**; persist normalized URL; show **Saved as…** after success; reject unsafe inline |
| COR-23 | Separate **Request changes** (required feedback) from **Approve version** (confirmation of version + consequences); no Approve beside revision textarea |

### Required runtime acceptance (permissions)

Permissions rows are **code-reviewed** only until these pass:

1. Authorized party can download own collaboration files.  
2. Cross-account / unauthorized ID → denial (404/401), no leak.  

## Out of scope (this slice)

- R0 security, R2/R3 billing/tax/annual, R5 admin, R6 payout  
- COR-24 in-app billing invoice download  
- COR-25 messages reply depth  
- Live deposits / Payment Standard reopen  
- Inventing commercial rates or fee seeds  
- Silent “fix” of historical Pass labels

## Suggested entry points

`src/app/payments/actions.ts` (`fail` vs workroom return) · `src/components/workspace-milestones.tsx` · `src/app/collaboration/work/[fundingId]/workspace-panel.tsx` · `src/lib/milestone-delivery.ts` · `src/lib/deliverable-files.ts` · `src/app/api/deliverables/[fileId]/route.ts`

## Evidence required on the impl PR

- Desktop + mobile screenshots matching boards in `design-boards/previews/`  
- Recording: unsupported → Replace/Remove; network fail → Retry upload; bare domain Will save as → Saved as; Request changes path; Approve confirmation path  
- Runtime authorized download + cross-account denial  
- Reproduction notes for **user-reported** upload failure (pass or still-open with cause)

## Decision asked of Ola

Approve this **deliverables-only** slice to start implementation, or request further board changes first?
