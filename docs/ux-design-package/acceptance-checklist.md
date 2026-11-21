# Acceptance checklist

Observable pass/fail per correction. Run on staging with `AUDIT_*` accounts; no real money/notifications.

| ID | Issue / package | Pass if | Fail if |
|----|-----------------|---------|---------|
| A-MOBILE-01 | MOBILE-NAV-001 | At 390×844 on `/`, menu control visible; opens to Home, Discover, Categories, Collaboration, For Businesses, Pricing | Any primary link only reachable by knowing URL |
| A-MOBILE-02 | MOBILE-LOGIN-001 | Same viewport: Log in visible in menu or header; reaches `/login` | Log in absent or `display:none` without replacement |
| A-MEMBER-MOBILE-01 | MEMBER-MOBILE-NAV-001 | Influencer & business: every sidebar destination reachable on mobile without horizontal-guessing truncated labels; Billing ≠ Payments both clear | Missing Collaboration Payments or Billing |
| A-ADMIN-MOBILE-01 | ADMIN-MOBILE-001 | Admin `<lg`: sidebar in drawer **or** documented desktop-first note in admin UI | Unusable overlap without documentation |
| A-ADMIN-CHROME-01 | DUAL-CHROME-001 | While on `/admin/*`, marketing public nav not competing with ops chrome | Full marketing link row + dense sidebar as today |
| A-ADMIN-KPI-01 | ADMIN-KPI-001 | Prior-window zero does not show −100% falsely; Active Collaborations matches agreed definition vs member apps on same fixtures | Contradictory zeros with active member work unexplained |
| A-ADMIN-HOOK-001 | ADMIN-WEBHOOK-001 | Webhook OPERATIONAL **or** ATTENTION links to remediation | ATTENTION with no next step |
| A-DISCOVER-01 | DISCOVER-SAMPLE-001 | When enabled: live influencer openable/bookable per gates; else banner remains accurate | Silent fake bookable demos |
| A-CARD-01 | CARD-VANITY-001 | Documented behavior **or** `/c/{vanity}` redirects to canonical | Broken share on primary host without docs |
| A-INBOX-01 | INBOX-DUP-001 | ≤1 open task row per fundingId+action kind | Triplicated identical tasks |
| A-BADGE-01 | BADGE-COUNT-001 | Badge matches documented semantic (attention vs active) | Unexplained mismatch |
| A-REQ-01 | REQUEST-POPUP-001 | View opens **centered** popup; list filters/scroll restored on close | Detail under table or right sidebar only |
| A-REQ-02 | Requests edit | Edit in centered popup; unsaved guard; sticky actions | Full-page only with lost list context (unless explicitly full-screen mobile) |
| A-REQ-03 | Withdraw | Accepted participant withdraw requires reason + notification record before delete available | Delete without withdraw when accepted parties exist |
| A-REQ-04 | Signed/funded | Delete disabled; cancel/close path keeps contracts/payments/history | Destructive erase of obligations |
| A-ACTIVE-01 | ACTIVE-OVERVIEW-001 | Active row opens overview popup with status, participants, next action, milestones, workroom link | No overview or sidebar-only detail |
| A-ACTIVE-02 | Workroom | Workroom link opens dedicated workspace | Missing / 404 from overview |
| A-ACTIVE-03 | Mobile active | Full-screen overview works at 390×844 | Cropped/unusable actions |
| A-MSG-01 | MSG-REPLY-001 | Unread + latest + collab context + keyboard-accessible reply | List-only dead end |
| A-CONTRACT-01 | CONTRACT-VIEW-001 | Viewer shows parties, clauses/tables, signature area; executed read-only | Placeholder soup / contradictory status with Sign enabled |
| A-TAX-01 | TAX-MODEL-001 | Create/edit tax: Country + Product/charge primary | Duplicate Applied-to + filing-owner in calc setup |
| A-TAX-02 | Tax presentation | Breakdowns show tax once; zero/exempt allowed | Forced positive tax / duplicate tax lines |
| A-TAX-03 | Preview | Admin preview base/discount/tax/total coherent | Mismatch fields |
| A-CHECKOUT-01 | CHECKOUT-TOTALS-001 | Preview totals = checkout totals with discount+tax (sandbox) | Drift between screens |
| A-PRICE-01 | Pricing §7 | Compare collapsed by default; monthly/annual available; plan-first | FAQ/impl walls above plans |
| A-AGENCY-PLAN-01 | AGENCY-PLAN-001 | Agency upgrade hidden or Coming soon while deferred | Looks purchasable with no Agency account path |
| A-TERM-01 | TERM-CREATOR-001 | Business nav uses Influencer wording for discovery | “Creators” as only customer term |
| A-FOOTER-01 | FOOTER-AGENCY-001 | Agency footer not implying live Agency workspace | Live Agency workspace link without product |
| A-CARD-FULL-01 | Influencer card §7 | Live profile shows full card scaled, no crop | Rebuilt/cropped card chrome |

## Sign-off

| Gate | Ready? |
|------|--------|
| Coverage statuses assigned | **In progress** — overstated `reviewed` rows demoted; see [coverage-matrix.md](./coverage-matrix.md) |
| Gaps/blocked vs observed defects | **Yes structure** — [coverage-gaps.md](./coverage-gaps.md) + [issue-register.md](./issue-register.md) |
| Nav map current→proposed | Draft for Ola — [navigation-map.md](./navigation-map.md) |
| Shared UI + **visual** designs | **Partial** — critical HTML/PNG mockups added; messages/pricing/card still notes-only — [designs/](./designs/) |
| Safe delta captures (requests/active/contracts/tax) | **Partial** — read-only deltas added; blocked workflows remain |
| Backlog with acceptance IDs | Draft — [implementation-backlog.md](./implementation-backlog.md) |
| **Package complete / implementation-ready** | **No** |

**Awaiting:** Ola review. Do **not** start broad redesign / product UI implementation from this PR alone.
