> **Historical audit record.** Recorded against live `40b6288` (Nov 2026), when live collaboration deposits were closed and a simulated funding path existed. Both have since changed (Stripe Checkout funding; simulation removed). Current status of every row and root cause: [docs/remediation-status.md](../../remediation-status.md). Screenshots referenced here stay on the [`cursor/full-platform-audit-package-b6cf`](https://github.com/getnuevetech/Influrios/tree/cursor/full-platform-audit-package-b6cf/media/full-platform-audit) branch.

# IPS-19 admin slice results

**Slice:** `admin` — ADMIN CONFIG + MESSAGES + NOTIFICATIONS + INTEGRATIONS + JOBS + EMAIL  
**Target:** https://influrios.com · revision `40b6288`  
**When:** 2026-11-20  
**Evidence:** `./media/admin/`  
**Harness:** `harness-results.json`, `followup-results.json`, `deep-results.json`, `messaging-*.json`

## Scope covered

| Area | Process / INV |
|------|----------------|
| Admin config | P-27a…P-27x route smoke + UI readiness (menus, tabs, dialogs, save controls) |
| Messages | P-24 both sides via workroom `?tab=messages` + `/creator/messages` |
| Notifications | Bell, `/creator/notifications`, `/notifications`, `/account?tab=notifications`, `/collaboration/inbox` |
| Integrations | Webhook mounts INV-I-001…004/006/008; admin social/signing/search/AI surfaces |
| Jobs | `/admin/jobs` kinds + mail_test; cron endpoint auth |
| Email | `/admin/mail` + templates (79) + health; SMTP test send |
| Downloads | Accounts CSV, legal CSV, intelligence export |
| Agency | Destination checks only (Explicitly deferred product) |
| COR-SEC-01 | Noted vs open [#537](https://github.com/getnuevetech/Influrios/pull/537) — **not** expanded into R0 remediation here |

## Counts (this slice’s matrix rows)

| Status | Count |
|--------|------:|
| Pass | 144 |
| Fail | 8 |
| Blocked | 87 |
| Not tested | 28 |
| Explicitly deferred | 11 |
| **Rows in slice** | **278** |

Whole-matrix header recount after concurrent sibling edits: Pass 184 / Fail 11 / Blocked 95 / Not tested 175 / Explicitly deferred 11 (476).

## Defects

| ID | Severity | Summary | Evidence |
|----|----------|---------|----------|
| COR-SEC-01 | P0 | Public `/admin/login` still shows Default super admin email prefill + credential help line (env var names). Open PR #537 removes this; **not on live**. Do not expand R0 here. | `01-admin-login-public.png` |
| COR-09a | P1 | Admin pages render public site chrome (Home/Discover/…) above admin MAIN MENU (dual chrome). | Admin shots e.g. `02-admin-home-after-login.png` |
| ADMIN-MAIL-FAILED | P1 | Email health: **Failed mail jobs: 32** while SMTP “ready (admin)”. | `06-admin-mail-health.png`, followup |
| INV-D-003 | P2 | `/admin/intelligence/export` returns JSON (`application/json`), inventory expects CSV. | `export-INV-D-003.bin` |
| INV-J-020..022 | P2 | Jobs UI: `invitation_followup_sweep` / `quote_expiry_sweep` / `subscription_renewal_sweep` show **never** / “confirm crontab + CRON_SECRET”. | `07-admin-jobs.png`, `61-jobs-after-mail-test.png` |
| MSG-NAV | P3 | Workroom “Messages” label click can hit sidebar `/creator/messages` instead of workroom tab; `?tab=messages` works. | messaging-tab-results |

## Case highlights

### Admin login & COR-SEC-01
- **Expected:** No concrete bootstrap credentials on public login.
- **Actual:** Fail — hints still rendered on live. #537 open/unmerged. Rotation note retained; not executed.
- **Admin AUDIT login:** Pass → `/admin`.

### P-27* admin routes (INV-R-074…125)
- **Expected:** Authenticated load without 500/login bounce.
- **Actual:** **48/48** probed admin routes Pass (incl. payment-settings aliases INV-R-124/125, setup, agency CMS).
- Desktop + mobile samples: login/home/accounts/jobs/mail. Mobile accounts **no** horizontal overflow at 390 (prior COR-18 not reproduced this run).

### Admin menus / tabs / dialogs
- SIDE_GROUPS present: Main, Members, Subscriptions, Collaborations, Payments, Integrations & ops (INV-M-011…016 Pass).
- Payment sections providers/roles/routes/fees/tax/discounts/audit Pass (INV-T-015).
- Accounts tabs influencer/business/all Pass (INV-T-014).
- FAQ/stats Save controls visible; taxonomy Add opens; templates copy states **79 messages**; access/plans/accounts surfaces load. **No destructive production mutates** beyond mail test + agreement messages.

### Messages (both sides)
- Business workroom `?tab=messages`: composer + **Send message** → Pass.
- Influencer same funding workroom: sees business AUDIT ping; reply → business sees reply → **round-trip Pass**.
- `/creator/messages`: after workroom traffic shows thread content (was empty beforehand).
- Evidence: `100-biz-messages-tab.png`, `102-inf-sees-biz-message.png`, `103-inf-replied.png`, `105-biz-sees-reply.png`.

### Notifications / inbox consistency
- Bell visible (influencer): `Notifications, 2 unread`.
- Notification centre All (9) / Action required (9) — includes Read items; unread ≠ All (product copy explains). Not treated as Fail.
- Action inbox **both roles** at `/collaboration/inbox` (not `/creator/inbox` — that 404s). Tasks present (delivery/funding/invitation).
- `/notifications` resolves to notification centre for signed-in influencer.
- Account notification prefs load (influencer + business).
- Collab kind rows INV-N-010…034: only kinds observed in inbox/centre marked Pass; others remain Not tested (journey-triggered).

### Jobs
- `/admin/jobs` lists sweeps + mail kinds; Retry copy present.
- **mail_test SUCCEEDED** at `2026-11-20T22:37:08Z` after admin Send test (`?sent=started`).
- Several sweeps have historical succeeded rows; three follow-up sweeps show never / crontab warning → Fail rows.
- `POST /api/cron/sweeps` without secret → **401** (mounted, auth gate Pass as endpoint behavior).

### Email / Mailpit
- SMTP ready (admin); categories listed; no templates paused.
- Catalog **79/79** template ids listed in admin UI.
- **Mailpit:** not available on live host → delivery sink **Blocked** for templates other than smtp path.
- **smtp_test / mail_test:** Pass as SMTP-accepted job success (not Mailpit-confirmed). Distinguish: provider SMTP accept ≠ Mailpit capture.

### Integrations / webhooks
| Endpoint | Unsigned call | Mounted |
|----------|---------------|---------|
| `/api/billing/webhook` | 400 missing Stripe-Signature | yes |
| `/api/marketplace/webhook` | 400 validation | yes |
| `/api/signing/webhook` | 400 DocuSign-only | yes |
| `/api/social/meta/webhook` | 400 hub.mode | yes |
| `/api/cron/sweeps` | 401 | yes |
| `/api/health` | 200 | yes |

No forged provider-confirmed events (simulation vs confirmed distinguished).

### Downloadables
- INV-D-002 accounts CSV download Pass.
- INV-D-004 legal acceptances CSV Pass.
- INV-D-003 intelligence export JSON not CSV → Fail.
- INV-D-010 `/legal/privacy-policy` 200 Pass.
- INV-D-001 deliverables API left to collab slice (Not tested here).
- INV-D-005/006 billing invoices noted Blocked/Not tested (billing slice).

### Agency destination checks (Explicitly deferred product)
- Footer → `/agency` loads gated workspace shell (upgrade required) — usable destination.
- Views `clients|roster|campaigns|team` not 404.
- `/admin/agency` CMS loads (ops).
- `/agency/invite/invalid-token` → **404** via `notFound()` when seat missing (expected for bad token; valid-token path not exercised — no live seat token).
- Business billing Agency CTA not found on probed billing surfaces this run (destination still Explicitly deferred).
- Product depth remains **Explicitly deferred** (INV-A-080/081, INV-R-072/073, INV-M-010, INV-T-016, INV-AG-*).

## Limitations

- Live deposits closed — funding-triggered emails/notifications not newly fired.
- No Mailpit UI on live; SMTP job success only for mail_test.
- Agency product not audited beyond destinations.
- Admin CMS saves not force-written to production content (readiness + controls only) except mail test + AUDIT workroom messages.
- COR-SEC-01 fix is #537; this slice records Fail on live only.

## Media index (selected)

`01-admin-login-public.png` · `02-admin-home-after-login.png` · `03–14` admin modules · `15` mail after test · `16`/`61` jobs · `20–25` influencer notif/messages · `30–33` business · `40–41`/`94` agency · `50–56` mobile · `95–105` messaging round-trip · exports CSV/JSON · `harness-results.json`
