# Journeys (revision r3.2 — Stripe fresh-boot)

Operator attestation checkboxes are **not** a gate. Local dedicated Postgres + Mailpit + synthetic `@example.com` fixtures execute mutating journeys.

| ID | Status | Notes |
|----|--------|-------|
| J01 | Pass | email=audit.r3mrvlgh.signup.mwmst7q8@example.com; user=audit.r3mrvlgh.signup.mwmst7q8@example.com; mailDelta=1; url=http://127.0.0.1:3000/account/verify?email=a |
| J02 | Pass | Members Pass earlier; admin Fail RCA fixed via harness `.env.local` load — **reconfirm Pass** this boot (`/admin`) |
| J03 | Partial | Discover/card inventory opens only — false journey Pass avoided |
| J04 | Pass | briefs=cmwms5ddg00ncjsu70yjkim0x/AUDIT debug send/draft … |
| J05 | Pass | apps … ACCEPTED |
| J06 | Pass | acceptedOrSignedVisible=true |
| J07 | Pass | pureDraft deleted; saved=deleted |
| J08 | Pass | ACCEPTED → WITHDRAWN |
| J09 | Pass | Delete blocked; settlement redirect; contract stays signed |
| J10 | Pass | Contract sent (native) |
| J11 | Pass | business/signed · creator/signed |
| J12 | Pass | Status signed 2/2 |
| J13 | Blocked | Secrets present; `collaborationCollectionGate` refuses card deposit until allocated funds/Treasury proven |
| J14 | Blocked | Depends on funded collaboration (J13) |
| J15 | Blocked | Upstream J13 — funding never `held`; payout not executed |
| J16 | Partial | Checkout `cs_test_` opens + sandbox UI + webhook 400 unsigned; hosted card confirm incomplete; related API sub active (see j16-related-stripe-api-evidence.json) |
| J17 | Blocked | Retry/failure money paths need funded deal after J13 |
| J18 | Blocked | Discount mutating admin ops not fully executed this revision |
| J19 | Blocked | Tax/payment-settings mutating ops not fully executed this revision |
| J20 | Blocked | Withdrawal mutating path blocked pending payout after J13 |
| J21 | Partial | Business shell surfaces captured; entity ID reconciliation Partial |
| J22 | Blocked | Messages mutating path not fully executed this revision |
| J23 | Pass | Mailpit interception |
| J24 | Partial | Synthetic denial + local unrelated Pass |
| J25 | Partial | Admin accounts inventory/read-only |
| J26 | Partial | Admin plans inventory/read-only |
| J27 | Partial | Admin jobs/CMS inventory |
| J28 | Partial | Admin AI/matching inventory |
| J29 | Partial | Public/marketing inventory |
| J30 | Partial | Centered popup samples + mobile a11y smoke |
| AGENCY | N/A | Deferred |
