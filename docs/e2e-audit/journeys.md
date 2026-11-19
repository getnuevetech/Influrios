# Journeys (revision r3 — local dedicated harness)

Operator attestation checkboxes are **not** a gate. Local dedicated Postgres + Mailpit + synthetic `@example.com` fixtures execute mutating journeys.

| ID | Status | Notes |
|----|--------|-------|
| J01 | Pass | email=audit.r3mrvlgh.signup.mwmst7q8@example.com; user=audit.r3mrvlgh.signup.mwmst7q8@example.com; mailDelta=1; url=http://127.0.0.1:3000/account/verify?email=a |
| J02 | Partial | Local business/influencer login Pass; local admin Fail (separate P0); public logins Pass |
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
| J13 | Blocked | MISSING_RESOURCE: Stripe/provider sandbox secrets not bound in Cloud Agent env |
| J14 | Blocked | Milestone submit/revise/approve needs funded collaboration (depends on J13 Stripe) |
| J15 | Blocked | MISSING_RESOURCE: Stripe/provider sandbox secrets not bound in Cloud Agent env |
| J16 | Blocked | MISSING_RESOURCE: Stripe/provider sandbox secrets not bound in Cloud Agent env |
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
