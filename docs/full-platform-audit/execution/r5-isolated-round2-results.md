# r5 round 2 — remaining ready checks on the isolated host (IPS-45)

**When:** 2026-11-21 · **Runner:** Claude Code session · **Host:** local isolated `http://127.0.0.1:3000`, `main` @ `5a5f4c0` (same host, data and harness as [IPS-44](./r5-isolated-package1-results.md)) · **Not** influrios.com · live deposits untouched
**Evidence:** `media/full-platform-audit/r5-iso/round2/<check>/` plus chain folders `CONTRACT-CHAIN/` and `CANCEL-CHAIN/` · **Harness:** `scripts/e2e-audit/r5-iso/` (`batchA.js`, `batchD.js`, `cw3.js`, `sign.js`, `cancel.js`, `t009.js`, `r062b.js`)

Scope: the 37 rows marked *Ready to run* in [check-handoff.md](../check-handoff.md) after IPS-44. **32 executed or attempted; 5 not run this round** (listed at the end). Known defects stay Fail; nothing is fixed here.

## Results

| Check | Result | What happened |
|-------|--------|---------------|
| INV-R-061 application detail | **Pass** | Influencer opened `/collaboration/applications/[id]`: 200, invitation shown with its controls |
| INV-A-045 transition on application detail | **Pass** | Influencer clicked **Accept** on the detail page: VIEWED → ACCEPTED, persisted on reload; invitation counts 1 → 0. **Observation:** the detail page offers Accept · Decline · Withdraw while the hub popup offers I'm interested · Ask · Decline (contradicts master-spec §2.2b; decision needed). After accepting, nothing tells the influencer the next step until the business creates the agreement |
| INV-A-029 creator transition (hub popup) | **Pass** | Wizard invitation → influencer **Decline** in the hub popup → DECLINED; banner, stat, attention, hub and badge 1 → 0 |
| INV-A-039 business transition | **Pass** | Business's next step on the accepted application was **Create the agreement**; executed (see contract chain) |
| INV-A-040 withdraw participation | **Pass** | Withdraw executed and persisted in IPS-44 INV-DC-013 (control + mutation). Its notification defects stay counted under INV-DC-013 |
| INV-A-047 queue signature | **Pass** | Agreement wizard → **Send for signature**: contract `sent`, 0/2 signed, both parties pending |
| INV-R-067 agreement detail/sign | **Pass** | Agreement page opens with the sign form (typed name + ink pad) |
| INV-A-050 sign native contract | **Pass** | Business signed (1/2), influencer signed (2/2); parties `signed`; “Signature progress” and “Fully signed” emails to both |
| INV-T-009 agreement dialog tabs | **Pass** | Contracts → agreement dialog: Overview, Document, Signers, Activity each show content |
| INV-T-013 payments dialog tabs | **Pass** | Business: Overview, Breakdown, Milestones, Transactions, Documents all load the deal |
| INV-P-005 collaboration payments dialog | **Pass** | Influencer: same five tabs load the deal |
| INV-R-062 opening detail | **Pass** | Admin published an opening (form has no visible submit button; submitted with Enter); influencer opened `/collaboration/openings/[id]` with a Connect action. **Observation:** a business opening the same URL is redirected to the card-signup page |
| INV-J-001 invitation email job | **Pass** | Admin **Send email** → `invitation_email` job succeeded (×2) → SMTP sink delivery; events `send_queued → send_delivered` |
| INV-C-013 unpublished hidden from Discover | **Pass** | Admin turned public pages live (Homepage); guest `/discover` lists none of the unclaimed/unpublished audit profiles. Weak contrast: no published audit profile exists to show the positive case |
| INV-D-007E media kit export | **Fail** | `/creator/media-kit` offers only “View media kit” (link to the public card). No export or download action exists |
| INV-A-034 refresh campaign suggestions | **Fail** | `actionRefreshCampaignSuggestions` exists in code; no page renders it (business hub, recommended, requests checked) |
| INV-A-036 send/reply/decline inquiry | **Fail** | `actionSendInquiry` / `actionReplyInquiry` / `actionDeclineInquiry` exist; no page renders them |
| INV-A-037 advance/shortlist from inquiry | **Fail** | `actionShortlistFromInquiry` exists; no UI |
| INV-A-042 request managed match | **Fail** | `actionRequestManagedMatch` exists; no UI |
| INV-A-064 add evidence / open dispute | **Fail** | `actionOpenDispute` / `actionAddEvidence` exist; no member UI in workroom or payments dialog (all tabs, both roles) |
| INV-A-079 open dispute (trust page) | **Fail** | `/trust` has no dispute entry (only Protected Payments / Trust console links) |
| INV-A-065 stop series / convert ambassador | **Fail** | `actionConvertAmbassador` has no UI. Stop series renders only for recurring deals (no series fixture) |
| INV-A-066 request cancellation | **Fail** | No entry point: the Request cancellation form only renders at `?case=refund`, and the only link there appears once a case already exists. Reached by URL, the request was refused because a release is pending (“A payout is still with the provider…”) |
| INV-A-069 own-milestone dashboard path | **Fail** | `actionSubmitOwnMilestone` has no UI |
| INV-R-065 record detail | **Blocked** | No `Collaboration` records exist (signing an agreement doesn't create one); record detail needs that record. Next: create one through `/collaboration/propose` |
| INV-P-012 payout detail dialog | **Blocked** | No payout exists; “View payout status” only opens the Transactions tab. Needs the R6 release path |
| INV-A-062 request change order | **Blocked** | Control renders only for `awaiting_provider` funding (closed deposit path) |
| INV-A-063 cancel prefund | **Blocked** | Same: only for `awaiting_provider` |
| INV-A-067 settlement accept/question/dispute | **Blocked** | No settlement can open while a release is pending; release needs R6 |
| INV-N-010T funding required notice | **Blocked** | Fully signing emits “Fully signed” emails only; `funding_required` fires when funding is created (“Start funding”, closed path). **Observation:** a fully signed agreement gives the business no next-step attention item |
| INV-N-027T collaboration cancelled notices | **Blocked** | Cancellation can't complete (see INV-A-066 / R6) |
| INV-C-015 delete signed request protected | **Blocked** | The signed agreement's request (fixture without a brief) has no delete control; needs a wizard-created request taken to signature |

## Not run this round (stay Blocked)

INV-P-004 and INV-A-054 (AI tailor: needs an AI provider key) · INV-P-019 (no trigger found) · INV-A-053 (collab discount: admin discount-code fixture not built) · INV-J-022 (subscription renewal: needs a Stripe test subscription due for renewal).

## Matrix effect (IPS-45)

Pass +14 · Fail +10 (9 from Blocked, INV-D-007E from Not tested) · Blocked −23 · Not tested −1.
Totals: **502 rows · 396 Pass · 39 Fail · 57 Blocked · 0 Not tested · 10 deferred**.

## New findings

| ID | Finding | Rows |
|----|---------|------|
| AUD-R2-01 | Actions implemented but unreachable from any page: inquiry (4), refresh suggestions, managed match, open dispute, add evidence, convert ambassador, own-milestone submit | A-034, A-036, A-037, A-042, A-064, A-065, A-069 |
| AUD-R2-02 | No member dispute entry (trust page, workroom, payments) | A-064, A-079 |
| AUD-R2-03 | Cancellation can't be started from a held collaboration (form only behind `case=refund`) | A-066 |
| AUD-R2-04 | Media kit has no export | D-007E |
| AUD-R2-05 | Invitation detail page offers Accept/Withdraw; hub popup offers Interested/Ask — two rule sets for one invitation (decision vs master-spec §2.2b) | A-045 |
| AUD-R2-06 | No next step shown to the influencer after accepting, or to the business after full signature | A-045, N-010T |
| AUD-R2-07 | Agreement wizard: fee box names “Contracted Pilot” while “Discovery only” is selected; changing service level resets accepted checkboxes; missing US tax rule shown but not blocking | A-047 setup |
| AUD-R2-08 | Business opening an influencer opening is sent to card signup | R-062 |
