# Remediation patch — RC-DASHBOARD (IPS-29)

**Merge into:** [remediation-plan.md](../remediation-plan.md)  
**Source:** [dashboard-consistency-results.md](./dashboard-consistency-results.md)  
**Evidence:** `media/dashboard-consistency/`  
**Product PRs:** not opened by audit (plan only)

## Fail inventory delta

| Root cause | Defect IDs | Fail matrix rows | Severity |
|------------|------------|------------------|----------|
| **RC-DASHBOARD** | DC-INVITE-MISMATCH, DC-PAYOUT-MISMATCH, DC-ACTIVE-MISMATCH, DC-TEAM-INVITE-DEADEND, DC-ACTION-STUCK | INV-DC-001, INV-DC-002, INV-DC-006, INV-DC-015, INV-DC-012 | High (trust / payout / invitation UX) |

Update plan header counts: prior **17 Fail → 8 RC**; after merge **22 Fail → 9 RC** (matrix +5 Fail rows).

---

## RC-DASHBOARD — Dashboard / hub / earnings contradiction

**Fail rows:** INV-DC-001, INV-DC-002, INV-DC-006, INV-DC-012, INV-DC-015  
**Evidence:** `re-inf-home.png`, `re-inf-hub.png`, `re-inf-earnings.png`, `re-inf-invitation-open.png`, `re-inf-team-invite-detail.png` (+ mobile counterparts)

### Corrected flow

1. **Single invitation projection** for an account: `/creator` banner + Invitations card + Needs attention + Collaborations hub “Invitations” + sidebar Collaborations (invite portion) use the **same** open-invitation query (marketplace + team members with `invited`/`PENDING`). Hub must not show `0` / “No invitations are waiting” while home shows `1`.  
2. **Single payout-readiness projection**: `globalPayoutReady` (or documented equivalent) drives earnings “Payout Setup”, hub “Payment readiness”, home setup reminder, and Earnings sidebar badge (`1` only while not ready **and** product rule for active collabs). Never “Ready” on earnings while hub/home still demand setup.  
3. **Active collaboration count** on home equals hub Active status card (same membership filter).  
4. **Team / coordinated invitation detail**: if status is pending response, show respond controls (interested / question / decline — or accept if product defines it). Never show “Pending your response” and “No further action needed” together. Completing the response clears home attention + invite counts + related action-required notice **without** requiring a read-only open.  
5. Opening a notice with `?open=` marks unread; completing the underlying record clears action-required (existing centre copy stays true).

### Design requirements

- Desktop + mobile: same counts; no viewport-only divergence.  
- Sidebar badges remain “count on the item that opens them” (`sidebar-badges.ts`); destination page must explain the badge (invites and/or work).  
- Payout Ready / Not ready use one visual language across hub widget and earnings Receive payments.

### Implementation requirements

- Align `loadCreatorHome` attention / `pendingInvitations` with hub applications invitation filter (`applicationIsInvitation` + open pipeline + team invited members).  
- Align payout badge input (`home.payoutReady`) with earnings page readiness and hub `payout.readiness` blockers.  
- Fix team invitation page copy + CTA gating (`/collaboration/team/[id]`).  
- Add regression tests: home invites === hub invites; earnings Ready ⇒ no setup reminder ⇒ badge 0; pending team invite ⇒ respond CTA present.  
- **Out:** Live deposit / withdraw money paths while `journey_funding` closed; Agency product.

### Acceptance tests

| # | Pass when |
|---|-----------|
| DB1 | INV-DC-001: home invite count = hub Invitations; Collaborations badge ≥ invites and explained |
| DB2 | INV-DC-002: earnings Ready ⇔ hub Ready ⇔ no “Complete payout setup” ⇔ Earnings badge 0 (when rule says so) |
| DB3 | INV-DC-006: home Active collaborations = hub Active |
| DB4 | INV-DC-015/012: pending team invite shows respond controls; after decline/interest, attention + counts clear; hub agrees |
| DB5 | INV-DC-020 regression: open Unread `?open=` decreases bell; action-required unchanged by read alone |
| DB6 | Refresh + re-login keep agreed counts (INV-DC-030/031) |

**Close** INV-DC-001, INV-DC-002, INV-DC-006, INV-DC-012, INV-DC-015 together after DB1–DB4 on deployed revision; DB5–DB6 on retest.

### Package suggestion

Insert as **R4b** (consistency) after R4 discovery, or fold into **R4** alongside discovery — owner choice. Not R6 (deposits still closed).
