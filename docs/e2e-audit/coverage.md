# Coverage (revision r3 — local dedicated harness)

**Verdict: Audit incomplete with remaining blockers** — local dedicated env now executes invite→accept→agreement→dual-sign and several lifecycle journeys. Provider-sandbox money paths remain Blocked without Stripe test secrets.

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

## Blocked / missing resources (exact)

| ID | Missing resource | Attempted resolution | Smallest Ola action |
|----|------------------|----------------------|---------------------|
| J13/J16 | Bound `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` **not visible in this VM** | Re-probed shell, `.env.local`, next-server environ (names only) — all absent | **Start new worker** so secrets inject at boot |
| J15 | Same + funded collaboration | Dual-sign done earlier; funding blocked | After new worker: J13 then J15 |
| J02 admin (explained) | N/A — harness pwd source mismatch | loginAdmin proves ADMIN_SUPER_PASSWORD works | Harness should load `.env.local` / pass admin env explicitly |

## Blocked / missing resources (exact)

| ID | Missing resource | Attempted resolution | Smallest Ola action |
|----|------------------|----------------------|---------------------|
| J13/J16 | `STRIPE_SECRET_KEY` (sk_test_) + `STRIPE_WEBHOOK_SECRET` bound to Cloud Agent / local `.env.local` | Local app + marketplace primary synthetic route prepared; Checkout not callable without Stripe test key | Bind Stripe **test** secrets to agent env (no live keys) |
| J15 | Funded collaboration + payout provider sandbox (Stripe Connect / Airwallex test) + webhook reachability | Dual-sign completed; funding gate still needs provider sandbox | Provide test payout credentials after J13 |
| J02 admin local | Working local admin password/`AuditLocalAdmin!2026` path failed login in harness | Business/influencer local login Pass; public admin Pass historically | **Separate P0** — do not mix into audit attestation |

## J01–J30 matrix

| ID | Status | Notes |
|----|--------|-------|
| J01 | Pass | email=audit.r3mrvlgh.signup.mwmst7q8@example.com; user=audit.r3mrvlgh.signup.mwmst7q8@example.com; mailDelta=1; url=http://127.0.0.1:3000/account/verify?email=a |
| J02 | Partial | Member logins Pass; admin Fail root-caused (harness fallback pwd ≠ ADMIN_SUPER_PASSWORD); reprobe Pass — see admin-login-root-cause.md |
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
| J13 | Blocked | Stripe secrets bound per Ola but **ABSENT in this VM** — fresh worker required (see stripe-secret-probe.json) |
| J14 | Blocked | Milestone submit/revise/approve needs funded collaboration (depends on J13 Stripe) |
| J15 | Blocked | Upstream J13; secrets not visible in this VM — fresh worker required |
| J16 | Blocked | Same as J13 — STRIPE_* names absent in this VM |
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

