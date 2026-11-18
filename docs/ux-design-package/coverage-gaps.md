# Coverage / gaps report

Companion to [coverage-matrix.md](./coverage-matrix.md), [issue-register.md](./issue-register.md), and baseline `docs/staging-visual-audit/coverage.md`.

**Package status: not complete / not implementation-ready.** Agency deferred · Payment Standard v2 paused · no product UI redesign in this PR.

Classification rules:

| Class | Meaning |
|-------|---------|
| **Observed defect** | Failure evidenced in screenshots/recordings — tracked in the issue register |
| **Partial** | Some evidence; workflow incomplete |
| **Gap** | Safe evidence still missing (can capture later without money/notifications) |
| **Blocked** | Policy / isolation forbids exercising now |
| **Deferred** | Out of scope (Agency) |

---

## Observed defects (issue register — not “untested”)

These are **known failures**, not coverage gaps:

| ID | Evidence |
|----|----------|
| MOBILE-NAV-001 / MOBILE-LOGIN-001 | `public/mobile/home.png` + style probe |
| MEMBER-MOBILE-NAV-001 | Member mobile chip chrome |
| ADMIN-KPI-001 / ADMIN-WEBHOOK-001 | `admin-dash.png` |
| DISCOVER-SAMPLE-001 | Discover sample banner / demo overlays |
| CARD-VANITY-001 | `/c/ag` 404 vs shortlink |
| INBOX-DUP-001 | Duplicate action-inbox rows |
| BADGE-COUNT-001 | Sidebar badge ≠ Active count |
| AGENCY-PLAN-001 / FOOTER-AGENCY-001 / TERM-CREATOR-001 / DUAL-CHROME-001 | Surfacing / chrome issues |

Full detail: [issue-register.md](./issue-register.md).

---

## Partial (appearance / list evidenced; workflow incomplete)

- Public marketing pages (desktop + mobile) — **except** mobile nav/login (**observed defect**)
- Discover demo overlays + filters/search; live booking still sample-gated (**blocked** for hire)
- Auth: login/signup empty validation; full registration / claim completion / reset send **not** exercised → keep **partial**, not reviewed
- Influencer & business shells: dashboards, inbox lists, collaborations lists, contracts lists, billing surfaces, profile tabs
- **Requests:** list + detail popup + edit surface now in deltas (safe); withdraw/delete **blocked**
- **Active collaborations:** list + overview/detail in deltas (safe); milestone submit still gap/blocked
- **Contracts:** list + agreement viewer in deltas (read-only); sign/PDF completion **blocked**/untested
- **Tax:** settings + add/edit form in deltas (unsaved); discount+tax checkout preview **blocked**
- Messages: list yes; reply no
- Subscription UI yes; checkout totals **blocked**
- Admin CMS / members / plans appearance; mail send not exercised
- Recordings from #532 still valid for journey context

---

## Blocked (policy / isolation)

| Workflow | Why blocked |
|----------|-------------|
| Invitation accept / decline / withdraw with notification | Would notify real customers / mutate live relationships |
| Request delete after withdraw | Depends on notification record + mutation |
| Fund collaboration / payout release / Stripe confirm | Real money risk |
| Checkout with discount + tax totals | Needs isolated mock checkout |
| Live Discover booking of non-demo influencers | Sample directory / guest gates |
| Email/SMS template sends | Customer notification policy |
| Completing contract signature when it may email / bind | Signing completion deferred |

---

## Gaps still open (safe later)

| Workflow | Notes |
|----------|-------|
| Request empty/error popup states | Detail/edit captured; empty/error still thin |
| Milestone workroom deep states | Prefer read-only; no submit |
| Contract PDF download proof | Optional if non-destructive |
| Tax preview totals with discount in sandbox | Needs isolated checkout |
| Mobile menu (after chrome fix) | Capture after MOBILE-NAV fix ships |

Delta folder: [`media/visual-audit-deltas/2026-11-18/`](../../media/visual-audit-deltas/2026-11-18/) (safe captures added this revision).

---

## Deferred

| Area | Reason |
|------|--------|
| Agency member journeys (`/agency`*) | preferences.md — no Agency account creation |
| Admin Agency CMS deep workflows | Page captured only |
| Payment Standard v2 implementation | Paused per Ola |

---

## Commit caveat

Staging deploy SHA at capture time **unknown**. Baseline pack on main as PR #532. Do not blame current `main` for staging-only visuals without SHA confirmation — see [baseline.md](./baseline.md).
