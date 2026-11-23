# r5 · Package 1 slice S2 retest (IPS-48)

> **Historical audit record.** Recorded against live `40b6288` (Nov 2026), when live collaboration deposits were closed and a simulated funding path existed. Both have since changed (Stripe Checkout funding; simulation removed). Current status of every row and root cause: [docs/remediation-status.md](../../remediation-status.md). Screenshots referenced here stay on the [`cursor/full-platform-audit-package-b6cf`](https://github.com/getnuevetech/Influrios/tree/cursor/full-platform-audit-package-b6cf/media/full-platform-audit) branch.

**When:** 2026-11-22 · **Host:** local isolated host · **Code:** `claude/vigilant-darwin-h4tha4-s2` @ `d57e2fa` (S2 on top of S1 `d0351a3`; not merged)
**Evidence:** `media/full-platform-audit/r5-iso/s2/` (`results.json`, `ev-s2-run.txt`, screenshots) · **Harness:** `scripts/e2e-audit/r5-iso/` (`s2-fixture.ts`, `s2-sweep.ts`, `s2-cleanup.ts`, `s2.js`)
**Scope:** S2 = P1-AUD-01…05 (+ withdrawal reason, P1-T20) · acceptance AUD1, DB1, DB4, DB5 (#540 master-spec §2.2, §2.2c, §5.3, §5.7). Live deposits closed; no money path touched.

## Result: 26/26 pass

Fresh fixture (stamp `s2e`): Business A sends three brief-based invitations to Influencer A (W1, W2, E1) and two team proposals to Influencers A + B (T1, T2). FIXTURE steps, named as such: `s2-cleanup.ts` withdrew leftover open audit invitations from earlier runs through the real transition (so the sidebar badge shows a number, not "9+"); `s2-sweep.ts past` moved E1's Respond-by date one minute into the past.

| Area | Checks | What was verified |
|------|--------|-------------------|
| Baseline | B0, B1 | All five listed on home, inbox and hub, badge 5; their notices Action required (5) |
| Withdraw with reason (business request dialog) | W1.1–W1.6 | WITHDRAWN, turn none; home, inbox, hub and badge drop together (5→4); original notice kept in history, read state unchanged, out of Action required (5→4); new in-app notice “AUDIT r5iso01 Co A withdrew an invitation · Reason given: Schedule changed” (not Action required); one `invite.withdrawn` email with the reason and no invitation-template email; detail panel shows reason and message, no actions |
| Withdraw from detail (no reason) | W2.1–W2.3 | Email and panel omit the reason line (nothing invented) |
| Respond-by expiry | E1.1–E1.5 | Before the sweep: off home, inbox, hub and badge, detail “Expired” with no actions, notice out of Action required. Real sweep (admin mode manual) persists EXPIRED; expiry notice + `invite.expired` email |
| Team listing (P1-AUD-04) | T.1, T.2 | Pending team invitations in hub and inbox; after accept: hub “Team invitation · You accepted · Waiting for teammates”, gone from inbox, home and badge |
| Team closure (P1-AUD-05) | T.3–T.7 | Teammate decline closes both; still-invited member: “This invitation is closed”, no controls; accepted member: closed “after you accepted”, never “waiting for teammates”; both leave every count; notices stay in history, not Action required |
| Mobile 390 | M.1, M.2 | Hub agrees; withdrawn panel shows the reason |
| S1 regression | R.1 | Signed-out item link → `/login?next=/collaboration/applications/{id}` (S1 layout fix `d0351a3`) |

Earlier runs on this host (stamps `s2b`–`s2d`) failed on fixture noise (leftover invitations, “9+” badge) and exposed two real defects that were fixed before the final run: brief-based invitations were titled “Campaign invitation” on home, inbox and notices, and the notices/emails said “The business” instead of the workspace name.

## Matrix rows

| Row | Was | Now | Basis |
|-----|-----|-----|-------|
| INV-DC-013 | Fail | **Pass** | W1.1–W1.6, W2.1–W2.3 |
| INV-DC-014 | Fail | **Pass** | E1.1–E1.5 |
| INV-A-048 | Fail | **Pass** | T.1–T.7 |

## Notes

- New email templates `invite.withdrawn` and `invite.expired` are in the catalog (81 templates). Like every catalog template they ship disabled until enabled in admin.
- The S1 PR (#541) received a follow-up commit `d0351a3`: the applications layout must redirect signed-out visitors itself (two existing source tests require it); it now returns to the exact item.
- `npm test`: 1071 pass, 2 fail — the same 2 DB-state failures as `main` on this host. New `invitation-lifecycle.test.ts` (5 tests).
