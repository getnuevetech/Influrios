# r5 round 3 — fixture work and contrast test (IPS-46)

**When:** 2026-11-21 · **Host:** same local isolated host (`main` @ `5a5f4c0`) · **Evidence:** `media/full-platform-audit/r5-iso/round3/` · **Harness:** `scripts/e2e-audit/r5-iso/` (`c013.js`, `batchE.js`, `bellcheck.js`, `disc4.js`, `chainF.js`, `del.js`, `chainG.js`)

## Results

| Check | Result | What happened |
|-------|--------|---------------|
| INV-C-013 published/unpublished contrast | **Pass** (replaces the weak IPS-45 Pass) | FIXTURE: card `published=true` for influencer A, `published=false` for Unrelated (no member UI publishes cards), Instagram account on both, public pages live. Guest: A listed in Discover and in search, `/c/` and `/creators/` 200; Unrelated not listed, both URLs 404. Consequence observed later: an unpublished influencer can't be found in the request wizard's audience search |
| INV-P-019 notice dialog | **Pass** | Notification centre → Open → dialog with Close / Open; notice `readAt` set. **Defect P1-AUD-12:** bell and the row's Unread label stay stale after closing until the next full page load (2 → 2, then 1 after reload) |
| INV-C-015 delete signed request | **Pass** | Wizard request → influencer accepted → agreement created, sent, signed by both → business **Delete request** from the row menu → refused: “A signed agreement, funded collaboration, or payment history is linked. Open cancellation and settlement instead of deleting.” Request (BusinessBrief) kept |
| INV-A-053 collaboration discount | **Fail** | Admin created and activated code `AUDITR5TEN` (10 %, business collaboration fee, Discovery, US) in the UI. On an unsigned Discovery agreement the business applied it: refused with “This code is valid for Discovery only.” Total stayed $840, 0 uses reserved. Same root as **AUD-FEE-01** (agreement fee rule is “Contracted Pilot” while Discovery is shown). On a signed agreement the discount box is hidden (correct) |
| INV-R-065 record detail | **Blocked** | Records come from influencer-to-influencer proposals (`/collaboration/propose?a=&b=`), which need a Plus plan. Setting `planTier` in the DB isn't honoured (plan comes from the subscription), so this needs a real Plus subscription via Stripe test mode (RC-CATALOG). Fixture change reverted |

## Still explicitly Blocked (gate named)

| Rows | Gate |
|------|------|
| INV-P-004, INV-A-054 AI tailor | AI provider credentials (not available on the isolated host) |
| INV-J-022 subscription renewal | Stripe test subscription due for renewal |
| INV-R-065 record detail | Plus subscription (Stripe test mode, RC-CATALOG) |
| INV-P-012 payout detail · INV-A-067 settlement · INV-N-027T cancellation notices | R6 release path (a release is pending; no provider) |
| INV-A-062 change order · INV-A-063 cancel prefund · INV-N-010T funding required | Funding creation (`awaiting_provider`) — live deposits closed |

## Matrix effect (IPS-46)

INV-P-019 Blocked → Pass · INV-C-015 Blocked → Pass · INV-A-053 Blocked → Fail · INV-C-013 evidence replaced (stays Pass).
Totals: **502 rows · 398 Pass · 40 Fail · 54 Blocked · 0 Not tested · 10 deferred**.
