# r5 · Package 1 slice S1 retest (IPS-47)

**When:** 2026-11-21 · **Host:** local isolated host · **Code:** `claude/vigilant-darwin-h4tha4` @ `bd65bb9` (on `main` @ `5a5f4c0`) with migration `20261121120000_invitation_turn` applied
**Evidence:** `media/full-platform-audit/r5-iso/s1/` (`results.json`, `team-results.json`, `ev-s1-run.txt`, screenshots) · **Harness:** `scripts/e2e-audit/r5-iso/` (`s1-fixture.ts`, `s1-team-fixture.ts`, `s1.js`, `s1-team.js`)
**Scope:** S1 = P1-T1, P1-T4, P1-D1, P1-AUD-10 · acceptance DB1, DB4, DB4a–d (#540 master-spec §1, §2.2a, §2.2b). Live deposits closed; no money path touched.

## Result: 36/36 S1 checks pass · team check 6/6 pass

Run on fresh fixtures (stamp `s1d`): Business A invites Influencer A to four requests (M1–M4) and Influencer B to one (P1). Each check reads the database and the UI.

| Area | Checks | What was verified |
|------|--------|-------------------|
| Matrix, popup | M1.1–M1.3, M2.1–M2.4 | Case 1 offers I'm interested · Ask a question · Decline; a question → case 2 (Decline only); interest → case 4; follow-up → case 5 (turn stays business); answer → case 6 (no task returns) |
| P1-D1 | M1.7, M1.12 | Business answer before interest → case 3, turn = invitee; then I'm interested moves NEGOTIATING → RESPONDED without accepting work |
| Popup = direct route (P1-AUD-10) | M1.10, M1.11, M3.1, MOB.1 | Same case and buttons on the hub popup, `/collaboration/applications/[id]` and mobile 390; the invitee never sees Accept or Withdraw |
| Server enforcement | M1.13, M4.1, P.6 | Stale popup submission rejected and refreshed to the current case, stored once; reply after a concurrent withdrawal rejected, status not overwritten; invitee posting Accept refused |
| Persistence | M1.5, M1.8 | Case survives reload and a fresh login; counts follow persisted state only |
| Business side | M1.6, M1.14 | Answer form only while a question is open; Accept only after interest; “Not a fit” · Withdraw |
| Permissions | P.1–P.9 | Other influencer can't view or respond; other business can't view, answer or accept; influencer can't answer as business; signed-out link and signed-out submission go to login with the exact item as return target, and sign-in lands on it |
| Cross-screen counts | C0, M1.4, M1.8, M2.3, C1, MOB.2 | Home attention, action inbox task list, hub Invitations tab badge and sidebar Collaborations badge list exactly the invitations whose turn is the invitee's (4 → 3 → 4 → … → 0); hub still lists business-turn invitations with their status |
| Team invitation (INV-DC-015) | T1–T4 | Pending: Accept invitation · Decline, never “No further action needed” (desktop + mobile); accept persists, page shows “You accepted”, attention clears |

## Matrix rows

| Row | Was | Now | Basis |
|-----|-----|-----|-------|
| INV-DC-001 | Fail | **Pass** | C0, M1.4, M1.8, M2.3, C1, MOB.2: one waiting projection on home, inbox, hub tab badge and sidebar badge, desktop + mobile |
| INV-DC-015 | Fail | **Pass** | T1–T4 on the current code |
| INV-A-045 | Pass (obs: detail offered Accept/Withdraw) | **Pass**, observation closed | M1.10, M1.11, P.6 |
| INV-A-029 | Pass | **Pass** (re-run) | M3.1–M3.2, M1.2 |

## Observations (not S1 scope, logged for their slice)

- `/creator` at 390 px has horizontal page scroll (scrollWidth 562) from the mobile chip nav. Owner: **S9** (P1-T8 four-slot nav, MOB1). The hub invitations page has none (MOB.3).
- The inbox page's Notifications list shows derived notices for invitations; their read/action-required behaviour is **S4** (DB5, P1-AUD-12).
- Team invitations in the hub list and closed-proposal messaging remain **S2** (P1-AUD-04/05).
- Response idempotency keys and the timeout outcomes (saved / processing / unable to confirm) are **S3**; S1 relies on conditional writes, which reject stale or duplicate submissions but don't yet return the saved outcome on a retry.

## Unit and build checks

`npm test`: 1057 pass, 2 fail — the same 2 DB-state failures as `main` on this host (`repeat prefund attribution`, `staged and recurring prefunds`). New `invitation-turn.test.ts` (9 tests) added to the suite. `tsc`, `eslint` (changed files), `check:brand` and `next build` pass.
