# Local J06–J12 runner notes

Prereq: `seed-local-fixtures.ts` then `seed-local-readiness.ts`; app on `127.0.0.1:3000`; Mailpit on `1025/8025`.

Proven flow on AUDIT_LOCAL_R3:
1. J04/J05 — invite + accept (see `run-local-j04-j05.mjs`)
2. J10 — `/collaboration/contracts` → Create contract → US + contracted + `local_bank` + fee/party checkboxes → Send for signature
3. J11 — both parties open contract, `typedName` + canvas ink (≥8 points via hover path) + agree → Sign agreement now
4. J07 — open row `···` (`aria-label=More actions`) → Delete request (pure draft → `saved=deleted`)
5. J09 — same Delete on signed brief → redirects to active with settlement error; `ContractDocument` stays `signed`
6. J08 — accept then Withdraw on influencer application → `WITHDRAWN`

J13/J15/J16 remain Blocked without Stripe test secrets.
