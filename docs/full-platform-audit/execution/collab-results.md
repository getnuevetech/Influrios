# IPS-19 collab slice results (`collab`)

> **Historical audit record.** Recorded against live `40b6288` (Nov 2026), when live collaboration deposits were closed and a simulated funding path existed. Both have since changed (Stripe Checkout funding; simulation removed). Current status of every row and root cause: [docs/remediation-status.md](../../remediation-status.md). Screenshots referenced here stay on the [`cursor/full-platform-audit-package-b6cf`](https://github.com/getnuevetech/Influrios/tree/cursor/full-platform-audit-package-b6cf/media/full-platform-audit) branch.

**Slice:** COLLABORATION / DELIVERABLES / REVIEW (IPS-22)  
**Host:** https://influrios.com · revision `40b6288` (#536 on main)  
**Roles:** AUDIT business + AUDIT influencer (desktop + mobile)  
**Fixture workroom:** `/collaboration/work/cmw9ybc0m005io901ek96km44` (Funds held)  
**Constraint:** Live collaboration deposits **closed** — new funding treated as Blocked, not Pass.  
**Evidence root:** `./media/collab/`  
**Matrix:** updated **136** collab-owned rows only in `docs/full-platform-audit/coverage-matrix.md`

## Slice counts (matrix rows owned by this slice)

| Status | Count |
|--------|------:|
| Pass | 43 |
| Fail | 0 |
| Blocked | 62 |
| Not tested | 31 |
| **Total owned** | **136** |

Raw probe rows (viewport/role case log): see `media/collab/results.tsv` (~118 lines; unique probe ids ≈113 → Pass 100 / Blocked 11 / Fail 2 before consolidation into matrix).

## Processes covered (P-08…P-18)

| Process | Outcome | Notes |
|---------|---------|-------|
| P-08 Invitations | Partial Pass | Invalid token destination Pass; accept/decline UI present (0 pending); live token decline Blocked; invite emails Blocked (no mail sink) |
| P-09 Requests | Pass | Create-request wizard (Brief→Audience→Terms→Review); Save draft; business hub tabs |
| P-10 Applications | Partial | Opportunities/Applications tabs Pass; application detail id Not tested; withdraw Blocked |
| P-11 Contracts prep | Pass | Contracts list + CONTRACT & MILESTONE wizard |
| P-12 Signing | Blocked | No pending Sign CTA on already-signed funded fixture |
| P-13 Funding | Blocked / gate Pass | INV-C-001 Pass (no open-deposit CTA); INV-A-052/056/057 + INV-R-030 Blocked (closed live deposits; no Stripe charge) |
| P-14 Deliverables | Pass | Workroom both sides; Files tab; authorized download 200 / 2015041 bytes |
| P-15 Review | Pass | COR-23 hub revalidated — separated Request changes / Approve |
| P-16 Revisions | Pass | `review=changes` → feedback textarea; Approve unavailable on that step |
| P-17 Cancellation | Blocked | No Request cancellation control found on held fixture/payments |
| P-18 Withdrawal / prefund | Partial | Close request control Pass; withdraw + cancel-prefund Blocked |

## #536 evidence reuse (revalidated)

| Item | Result | Evidence |
|------|--------|----------|
| COR-21 authorized download (both roles) | Pass | `desktop-*-download-status.txt` status=200 bytes=2015041 |
| COR-21 signed-out deny | Pass | `signed-out-deny.txt` status=401 |
| COR-22 Saved as https://… | Pass | Review hub note + green link `https://agboolaolomola.com` |
| COR-23 separated Request changes / Approve | Pass | `manual/biz-review-hub-focus.png`, `manual/cor23-request-changes-step.png`, `manual/cor23-approve-after-click.png` |
| COR-20 soft-error / upload retry on submit form | Not re-run | Waiting-review milestones — submit form not available without mutating fixture (same skip as deployed smoke) |

Prior pack retained under `media/cor-20-23-deployed-smoke/` and `docs/remediation-pack/`; Pass only where revalidated above.

## Key cases

| Case | Expected | Actual | Status | Evidence |
|------|----------|--------|--------|----------|
| Business request composer | Wizard opens | Create request 4-step; Save draft + Next | Pass | `manual/biz-request-new.png` |
| Contracts / wizard | Usable | Agreements list + wizard | Pass | `desktop/business-contract-wizard.png` |
| Native sign both sides | Sign when pending | No Sign on signed fixture | Blocked | contracts list screenshots |
| Live funding deposit | Refused / closed | No open-deposit CTA; start-funding → needs_funding picker; no Stripe | Blocked (actions) / Pass (gate) | `manual/biz-funding-*.png` |
| Deliverable download | Party OK; anon deny | 200 + 401 | Pass | download status + signed-out-deny |
| Review hub COR-23 | Separated paths | Hub copy + changes step textarea + approve confirm | Pass | `manual/cor23-*.png` |
| Cancellation | Entry when allowed | Control not found | Blocked | `manual/biz-payments-detail.png` |
| Inbox consistency | Tasks/empty both sides | Influencer 4 open tasks; business inbox loads | Pass | `manual/inf-inbox-tasks.png` |
| Collab emails INV-E-011…041,058…062 | Provider-confirmed | No Mailpit on live | Blocked | — |
| Collab jobs INV-J-001/006/010/011/015/017/020/021 | Observable run | Left to admin/jobs slice | Not tested | — |

## Defects

No new **Fail** defects filed in this slice’s matrix rows.

**Blocked (not defects):** live deposit closure; pending-signature fixture gap; cancellation entry not exposed on current held funding; mail sink absent for invite/contract/milestone emails; several optional actions Not tested (AI tailor, change order, dispute, openings detail).

## Artifacts

| Path | Contents |
|------|----------|
| `media/collab/desktop/` | Desktop screenshots (52) |
| `media/collab/mobile/` | Mobile screenshots (35) |
| `media/collab/manual/` | Deep probes + COR-23 revalidate |
| `media/collab/results.tsv` | Case log |
| `media/collab/summary-final.json` | Probe aggregation |

## Non-actions

- No merge PRs; no code changes; deposits left closed.
- Did not confirm Approve/release or request-changes submit (would mutate production audit fixture).
- Did not claim admin invitations, billing payouts, or auth signup rows (sibling slices).
