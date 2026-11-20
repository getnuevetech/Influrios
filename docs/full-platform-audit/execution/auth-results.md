# IPS-19 auth slice results (IPS-21)

**Slice:** `auth` · Processes **P-01…P-07** (signup, verify, login/logout, password reset, onboarding, influencer/business profiles, social, signed-in discovery)  
**Worker:** `bc-1adf640b-29b9-59db-9575-f513d6822024`  
**Executed:** 2026-11-20 · Target `https://influrios.com` (sandbox; live deposits closed)  
**Viewports:** desktop 1440×900 + mobile 390×844  
**Fixtures:** `AUDIT_INFLUENCER_*`, `AUDIT_BUSINESS_*` (no credential values recorded)  
**Evidence:** `./media/auth/`  
**Raw case log:** `media/auth/results.json`

## Slice status counts (matrix rows updated)

| Status | Count |
|--------|------:|
| **Pass** | **40** |
| **Fail** | **3** |
| **Blocked** | **21** |
| Not tested (in-scope adjacent left for later / other slices) | — |
| **Rows touched** | **64** |

Case-level harness run (before retest reclassification): 84 cases → then Fail/Blocked adjusted from retests below.

## Processes covered

| Process | Outcome |
|---------|---------|
| P-01 Signup (influencer/claim) | Pass for routes/forms/submit; claim verify/publish Blocked (mail) |
| P-02 Verify / login / logout / reset / password | Login/logout Pass; verify UI Pass; OTP + reset-token + mail Blocked |
| P-03 Business signup & terms | Form + consent Pass; welcome email Blocked |
| P-04 Onboarding reminders | Creator home + setup cues Pass |
| P-05 Profiles (influencer + business) | Tabs, details save, business profile save Pass |
| P-06 Social connections | Panel UI Pass; OAuth/webhook Blocked |
| P-07 Discovery (signed-in) | Route Pass; shortlist/card **Fail** (demo directory / COR-13) |

## Defects

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| AUTH-DEF-01 / COR-13 | P2 | Discover still **Sample directory** for signed-in business; no Shortlist CTA; no `/c/` card links → INV-A-035, INV-P-001, INV-C-008 **Fail** | `retest-P-07-discover-business.png` |
| AUTH-DEF-02 | — | Auth email delivery (verify/reset/claim/welcome/password_changed) unproven on live — no Mailpit/`MAIL_SINK` | Blocked rows INV-E-001…003,005…009; INV-J-002…004 |
| AUTH-DEF-03 | — | Provider-confirmed social OAuth + Meta webhook not executed | INV-I-005, INV-I-004 Blocked |

No product PR opened (per slice instructions).

## Key cases (expected → actual)

| Case | Expected | Actual | Status |
|------|----------|--------|--------|
| Signup validation | Empty submit blocked | Stayed on `/signup` d+m | Pass |
| Signup submit | Account + verify route | → `/account/verify?email=…` | Pass |
| Verify UI | Code + resend | Present | Pass |
| Verify OTP complete | Verified session | No mailbox | Blocked |
| Login influencer/business | Role homes | `/creator`, `/business/home` d+m | Pass |
| Bad password | Rejected | `error=Email+or+password+is+incorrect` | Pass |
| Logout | Session cleared | Desktop text + mobile `aria-label="Log out"` icon; `/dashboard`→login | Pass |
| Reset request | Accept email | `?sent=1` (mobile retest) | Pass |
| Reset complete | Token set password | No mailbox | Blocked |
| Password change form | Logged-in replace password | `/account?tab=security` has 3 password fields; `/account/password` redirects when `hasPassword` (by design) | Pass |
| Business signup surfaces | Form + terms | Present on `/business`; BUSINESS radio on `/signup` | Pass |
| Claim start | Form | Pass | Pass |
| Claim verify/publish | Draft path | Blocked (mail/draft) | Blocked |
| Setup reminders | Conditional cues | payout/setup/complete on `/creator` | Pass |
| Influencer details save | Save works | Success hint after Save | Pass |
| Business profile save | `?saved=1` | Confirmed on precise form submit | Pass |
| Social panel | Connect/refresh/disconnect | 7 action controls | Pass |
| OAuth launch | Provider connect | No launch href / consent not completed | Blocked |
| Discover shortlist | Shortlist CTA | Demo banner; shortlist=0 | **Fail** |

## Consistency (P-28 light)

After re-login, influencer `/dashboard` loads (see `p-28-consistency-relogin-dashboard.png`). After logout, `/dashboard` redirects to login.

## Retests

| Initial Fail | Retest | Final |
|--------------|--------|-------|
| INV-A-005 mobile submit timeout | Scoped form submit → `?sent=1` | Pass (request); complete still Blocked |
| INV-A-006 `/account/password` empty | By design redirect when `hasPassword`; security tab has fields | Pass |
| INV-A-003 mobile text logout | Visible `button[aria-label="Log out"]` icon works | Pass |
| INV-T-002 desktop login bounce | Contaminated by wrong Save click; fresh login Pass | Pass |
| INV-A-024 save → `/` logged out | Wrong control; precise profile form → `?saved=1` | Pass |
| P-07 shortlist | Reconfirmed demo + no Shortlist | **Fail** |

## Matrix rows updated (64)

`INV-R-002,003,005,013–019,028,031,033–037,043–047,049,050` · `INV-M-002,018` · `INV-T-001–003` · `INV-P-001,002` · `INV-A-001–006,010–018,020,023,024,035` · `INV-J-002–004` · `INV-E-001–003,005–009` · `INV-I-004,005` · `INV-C-008`

Left **Not tested** in auth-adjacent inventory (out of this pass’s mutations): e.g. `INV-A-007–009`, `INV-A-019`, `INV-A-021–022`, `INV-E-004` (admin-owned).

## Prior evidence

Prior e2e J01–J02 Pass / J03 Partial (COR-13) retained as historical only; this reopen **revalidated** on live. COR-13 still Fail for shortlist/demo directory.
