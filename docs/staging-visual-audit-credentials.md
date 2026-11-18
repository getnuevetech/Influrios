# Influrios — staging URL & visual-audit test accounts

**Audience:** Ola + Dev AI (visual audit prep).  
**Not in scope:** Playwright screenshot pack, Payment Standard v2, **Agency** (deferred — see `preferences.md`).  
**Last secret probe:** 2026-11-18 fresh boot worker `bc-64815611-18ae-5d55-b1c9-d0f07ad9eb69` (after Ola added Cloud Agent environment secrets).

---

## 1. Staging URL

| Item | Value |
|------|--------|
| **Use this host** | **https://influrios.com** |
| Alias | `https://www.influrios.com` (same app) |

No separate staging hostname. Do not use `staging.influrios.com` (TLS name mismatch).

**Public entry points (no login):** `/`, `/discover`, `/pricing`, `/signup`, `/login`, `/claim`, `/business`, `/collaboration`, `/card`, `/admin/login`.

---

## 2. Role readiness (this audit)

| Role | Login surface | Status |
|------|---------------|--------|
| **Public** | Guest | **Ready** |
| **Influencer** | `/login` → `/creator` | **Ready** — secrets present; smoke login OK → `/creator` |
| **Business** | `/login` → `/business/home` | **Ready** — secrets present; smoke login OK → `/business/home` |
| **Admin** | `/admin/login` | **Ready** — secrets present; smoke login OK → `/admin` |
| **Agency** | `/agency` | **Deferred / out of scope** (preference: address after audit). Env names `AUDIT_AGENCY_EMAIL` / `AUDIT_AGENCY_PASSWORD` are present but unused for this audit. |

---

## 3. Secret inventory (names only — values never recorded)

### Fresh-boot probe (this worker)

| Source | Result |
|--------|--------|
| Process env `AUDIT_*` | **8 names present, all non-empty** (see list below) |
| Process env `ADMIN_SUPER_*` | **Absent** (not required — `AUDIT_ADMIN_*` used) |
| Secret type note | These arrived after a **new agent boot**. Runtime / Environment Variable secrets are required (Build-only would not appear in `process.env` for the running agent). |

**Exact audit-related secret names found in this agent process:**

- `AUDIT_INFLUENCER_EMAIL`
- `AUDIT_INFLUENCER_PASSWORD`
- `AUDIT_BUSINESS_EMAIL`
- `AUDIT_BUSINESS_PASSWORD`
- `AUDIT_ADMIN_EMAIL`
- `AUDIT_ADMIN_PASSWORD`
- `AUDIT_AGENCY_EMAIL` *(present; Agency deferred — not smoke-tested)*
- `AUDIT_AGENCY_PASSWORD` *(present; Agency deferred — not smoke-tested)*

### Login smoke-check (https://influrios.com)

| Role | Surface | Result | Final path |
|------|---------|--------|------------|
| Influencer | `/login` | **Pass** | `/creator` |
| Business | `/login` | **Pass** | `/business/home` |
| Admin | `/admin/login` | **Pass** | `/admin` |
| Agency | — | **Skipped** (deferred) | — |

No credential values were logged or written to docs.

### Expected names (reference)

| Role | Expected env names |
|------|--------------------|
| Influencer | `AUDIT_INFLUENCER_EMAIL`, `AUDIT_INFLUENCER_PASSWORD` |
| Business | `AUDIT_BUSINESS_EMAIL`, `AUDIT_BUSINESS_PASSWORD` |
| Admin | `AUDIT_ADMIN_EMAIL`, `AUDIT_ADMIN_PASSWORD` **or** `ADMIN_SUPER_EMAIL`, `ADMIN_SUPER_PASSWORD` |

Agency omitted for this audit (names may still exist in env).

**Environment:** https://cursor.com/dashboard/cloud-agents/environments/e/e31989b3-e296-11f1-8120-06b44be262b7  
Secrets must be **Runtime / Environment Variable** (not Build-only) so a fresh Cloud Agent boot injects them into `process.env`.

---

## 4. Sandbox / test-channel notes (for later Playwright)

Do **not** run real money or notify real customers. Stripe sandbox, operator SMTP, Airwallex demo, dedicated social test apps only.

---

## 5. Repo note

`src/lib/staging-fixtures.ts` remains localhost-only and is not used for public-host audit logins.
