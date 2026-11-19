# Coverage (revision r3.2 — Stripe fresh-boot)

**Verdict: Audit incomplete with remaining blockers** — Stripe test secrets are present on this fresh boot. Collaboration card funding is product-gated; subscription Checkout is Partial.

**Route-open Pass ≠ journey Pass.** Completed journeys below are dual-account / DB / Mailpit evidenced on `http://127.0.0.1:3000` + Mailpit + Postgres `influrios_audit`.

## Denominators

| Bucket | Count | Notes |
|--------|------:|-------|
| All result rows | 173 | inventory + journey + visual |
| Journey-kind rows | 48 | includes public stubs + local |
| Local dedicated journey Passes (completion) | 15 | strict |
| Required journeys J01–J30 | 30 | see matrix |

## Completed journeys (local-dedicated, dual-party / DB / Mailpit)

- **J01** — email=audit.r3mrvlgh.signup.mwmst7q8@example.com; user=audit.r3mrvlgh.signup.mwmst7q8@example.com; mailDelta=1; url=http://127.0.0.1:3000/account/verify?email=a
- **J04** — briefs=cmwms5ddg00ncjsu70yjkim0x/AUDIT debug send/draft
cmwms41i300mcjsu77wn66by9/AUDIT r3mrvlgh Main mwms3x9b/draft
cmwms2k0300l8jsu73109vwx0/AUDIT r3mrvlgh Ma
- **J05** — apps=cmwms5ddq00ndjsu7koishj64/REQUESTED/audit-r3mrvlgh-a
cmwms41ip00mdjsu7wkmlliks/ACCEPTED/audit-r3mrvlgh-a; acceptedHeuristic=true
- **J06** — acceptedOrSignedVisible=true
- **J07** — pureDraft deleted; url=.../collaboration/business?tab=requests&saved=deleted; still=0
- **J08** — before=cmwmsrmk60005jsou6iklidzm/ACCEPTED; after=cmwmsrmk60005jsou6iklidzm/WITHDRAWN; openedVia=true
- **J09** — Delete blocked with settlement redirect; doc remains signed; parties signed; error=A signed agreement... Open cancellation and settlement instead of deleting.
- **J10** — cmwmsgt1p01c9jsu7j1cibafm/signed/native
- **J11** — business/signed
creator/signed
- **J12** — Status: signed · Influrios in-app · 2/2 signed; doc=signed
- **J23** — before=0; after=1; gained=1; sample=[{"id":"Npyxqj5AvuCxkLDmf8K4rq","to":[{"Name":"","Address":"audit.r3mrvlgh.influencer-a@example.com"}],"subject":"Preview re

## Navigation / inventory / visual (not counted as journey completion)

- Route/action inventory Passes remain screenshots + open checks only.
- J30 popup geometry samples and mobile a11y smoke are visual/navigation, tracked Partial until full checklist.

## Blocked / missing resources (exact) — r3.2

| ID | Missing resource | Attempted resolution | Smallest Ola action |
|----|------------------|----------------------|---------------------|
| J13 | Proven Stripe allocated-funds / Treasury capability (or product decision to allow ordinary card deposit) | Secrets present; dual-party `awaiting_provider` seeded; `startFundingDeposit(card)` hits hardcoded `collaborationCollectionGate(false,false)` | Product decision / separate PR to wire gate — audit will not silent-fix |
| J15 | Funded (`held`) collaboration after J13 | Upstream blocked; marketplace primary webhook seeded only | Unblock J13 then hold → approve → `payout.released` |
| J16 | Headless completion of Stripe hosted Checkout card form | `startCheckout` opens `cs_test_`; sandbox UI screenshots; webhook 400 unsigned; API `pm_card_visa` sub active (related) | Optional headed confirm / Stripe CLI; or accept Partial |
| J02 admin | ~~Harness pwd~~ | Reconfirm Pass with `.env.local` load this boot | None — harness fix already in place |

## J01–J30 matrix

| ID | Status | Notes |
|----|--------|-------|
| J01 | Pass | email=audit.r3mrvlgh.signup.mwmst7q8@example.com; user=audit.r3mrvlgh.signup.mwmst7q8@example.com; mailDelta=1; url=http://127.0.0.1:3000/account/verify?email=a |
| J02 | Pass | Members Pass; admin Fail RCA harness `.env.local` — **reconfirm Pass** this boot |
| J03 | Partial | Discover/card inventory opens only — false journey Pass avoided |
| J04 | Pass | briefs=cmwms5ddg00ncjsu70yjkim0x/AUDIT debug send/draft
cmwms41i300mcjsu77wn66by9/AUDIT r3mrvlgh Main mwms3x9b/draft
cmwms2k0300l8jsu73109vwx0/AUDIT r3mrvlgh Ma |
| J05 | Pass | apps=cmwms5ddq00ndjsu7koishj64/REQUESTED/audit-r3mrvlgh-a
cmwms41ip00mdjsu7wkmlliks/ACCEPTED/audit-r3mrvlgh-a; acceptedHeuristic=true |
| J06 | Pass | acceptedOrSignedVisible=true |
| J07 | Pass | pureDraft deleted; url=.../collaboration/business?tab=requests&saved=deleted; still=0 |
| J08 | Pass | before=cmwmsrmk60005jsou6iklidzm/ACCEPTED; after=cmwmsrmk60005jsou6iklidzm/WITHDRAWN; openedVia=true |
| J09 | Pass | Delete blocked with settlement redirect; doc remains signed; parties signed; error=A signed agreement... Open cancellation and settlement instead of deleting. |
| J10 | Pass | cmwmsgt1p01c9jsu7j1cibafm/signed/native |
| J11 | Pass | business/signed
creator/signed |
| J12 | Pass | Status: signed · Influrios in-app · 2/2 signed; doc=signed |
| J13 | Blocked | Secrets present; product `collaborationCollectionGate` refuses card deposit |
| J14 | Blocked | Milestone submit/revise/approve needs funded collaboration (depends on J13) |
| J15 | Blocked | Upstream J13 — funding never held |
| J16 | Partial | Checkout opens + sandbox UI + webhook ready; hosted card confirm incomplete; related API sub active |
| J17 | Blocked | Retry/failure money paths need provider sandbox after J13 |
| J18 | Blocked | Discount mutating admin ops not fully executed this revision |
| J19 | Blocked | Tax/payment-settings mutating ops not fully executed this revision |
| J20 | Blocked | Withdrawal mutating path blocked pending payout sandbox |
| J21 | Partial | Business shell surfaces captured; entity ID reconciliation Partial |
| J22 | Blocked | Messages mutating path not fully executed this revision |
| J23 | Pass | before=0; after=1; gained=1; sample=[{"id":"Npyxqj5AvuCxkLDmf8K4rq","to":[{"Name":"","Address":"audit.r3mrvlgh.influencer-a@example.com"}],"subject":"Preview re |
| J24 | Partial | Synthetic denial + local unrelated Pass; cross-account real contract IDOR still fixture-limited |
| J25 | Partial | Admin accounts inventory/read-only opens — mutating admin ops Partial |
| J26 | Partial | Admin plans inventory/read-only opens — mutating Partial |
| J27 | Partial | Admin jobs/CMS inventory opens — mutating Partial |
| J28 | Partial | Admin AI/matching inventory opens — mutating Partial |
| J29 | Partial | Public/marketing surfaces inventory — not a mutating journey |
| J30 | Partial | Centered popup samples + mobile a11y smoke Pass; full viewport checklist still Partial |
| AGENCY | N/A | Deferred |

## Status counts (matrix)

- Pass: **11**
- Partial: **10**
- Blocked: **9**

