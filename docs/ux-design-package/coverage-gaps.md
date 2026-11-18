# Coverage / gaps report

Companion to [coverage-matrix.md](./coverage-matrix.md) and baseline `/cursor/stores/self/docs/visual-audit/coverage.md`.

## Reviewed (appearance + basic interaction)

- Public marketing pages (desktop + mobile) including pricing monthly toggle & compare entry
- Discover demo overlays + filters/search
- Live Influencer Card via shortlink canonical slug
- Auth: login/signup empty validation; claim page
- Influencer & business shells: dashboards, inbox lists, collaborations lists, contracts lists, billing/pricing member surfaces, profile tabs
- Admin CMS, members dialogs, plans dialogs, payment-settings sections, deal detail opportunistic
- Restricted business→admin bounce
- Recordings: discover→profile; business home→discover→collab; influencer login→inbox→contracts; admin payment-settings tour

## Partial

- Mobile public: pages load but nav/login broken
- Collaborations: lists yes; popups/workrooms incomplete
- Messages: list yes; reply no
- Contracts: list yes; viewer/sign/PDF no
- Subscription UI yes; checkout totals no
- Admin KPIs/webhooks visible but correctness unverified
- Mentorship guest path unclear

## Blocked (policy / isolation)

| Workflow | Why blocked |
|----------|-------------|
| Invitation accept / decline / withdraw with notification | Would notify real customers / mutate live relationships |
| Request delete after withdraw | Depends on notification record + mutation |
| Fund collaboration / payout release / Stripe confirm | Real money risk |
| Checkout with discount + tax totals | Needs isolated mock checkout |
| Live Discover booking of non-demo influencers | Sample directory / guest gates |
| Email/SMS template sends | Customer notification policy |

## Gaps (feasible later with care — no delta captures this pass)

| Workflow | Notes |
|----------|-------|
| Request detail/edit popup from list View | Route exists; capture in dated delta when allowed |
| Active Collaborations tab + overview popup | |
| Milestone workroom `/collaboration/work/[id]` | Read-only capture preferred |
| Contract agreement dialog body | Avoid completing signature if it emails |
| Tax tab edit/preview alone | |
| Mobile menu (after fix) | After implementation |

Delta folder prepared empty: `/cursor/stores/self/media/visual-audit-deltas/2026-11-18/`.

## Deferred

| Area | Reason |
|------|--------|
| Agency member journeys (`/agency`*) | preferences.md — no Agency account creation |
| Admin Agency CMS deep workflows | Page captured only |
| Payment Standard v2 implementation | Paused per Ola |

## Commit caveat

Staging deploy SHA at capture time **unknown**. Baseline pack on main as PR #532 (`e98cea9` merge). Do not blame current `main` for staging-only visuals without SHA confirmation — see [baseline.md](./baseline.md).
