# Isolation & sandbox evidence (revision r2)

**Status:** Evidence gathered — **mutations still gated** on residual operator attestation below. A flag alone is not proof.

## Observed facts (read-only)

| Fact | Evidence |
|------|----------|
| Host | `https://influrios.com` (no separate staging hostname) |
| Deployed revision | from `/api/health` (see environment.md) |
| Member footprint | Admin → Accounts shows **Total Accounts = 5** (3 influencers, 2 businesses) |
| Named members visible | Influencers: Argboboy, Jenks Ag, Ag Olomola · Businesses: Richard Winfred Esi, ABC Holdings |
| AUDIT role mapping (session) | Business → ABC Holdings · Influencer → Ag Olomola · Admin → AUDIT_ADMIN |
| Stripe billing | **Stripe · Sandbox** on Admin → Billing activity |
| Collaboration gateway | Stripe Collaboration **Enabled**; Airwallex **Disabled** |
| SMS | Not sent |
| Screenshots | `/cursor/stores/self/media/e2e-audit/isolation/` |

## What this does **not** yet prove by itself

- Written attestation that **no production customer PII** shares this database beyond the 5 visible members
- That Argboboy / Jenks Ag / Richard Winfred Esi are disposable test fixtures (vs real people)

## Exact operator actions to fully unlock mutations

Complete **all** checkboxes, then reply in the Project thread (or set Cloud Agent secrets):

1. [ ] Confirm `influrios.com` DB contains **only** staging/test members (the 5 above, plus any AUDIT-seeded rows) — **no live customer tenancy**
2. [ ] Confirm AUDIT_INFLUENCER / AUDIT_BUSINESS / AUDIT_ADMIN are the allowlisted mutation + notification recipients
3. [ ] Confirm Stripe remains sandbox-only for this host (no live key fallback)
4. [ ] Optional: set `AUDIT_ISOLATION_CONFIRMED=1` **after** (1)–(3) — the flag records attestation; it is not a substitute for (1)–(3)

**Owner:** Ola / operator  
**Until then:** invite/sign/fund/payout/sub-checkout/withdraw/delete mutations stay **Blocked** (except already-proven mail test to AUDIT_ADMIN).

## Sandbox routing

Proven via UI badges/provider page (see isolation screenshots + preflight). Payment Standard v2 remains paused.
