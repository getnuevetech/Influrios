# Issue register

Evidence-based findings from the staging visual audit. Severity, roles, evidence, proposed correction.

Generated: 2026-11-18T09:41:03.289Z

| ID | Severity | Roles | Title | Evidence | Proposed correction |
|----|----------|-------|-------|----------|---------------------|
| MOBILE-NAV-001 | **high** | public | Mobile marketing header hides primary nav and Log in with no menu control | At 390×844 on https://influrios.com/, header links (Home, Discover, Categories, Collaboration, For Businesses, Pricing, Log in) are in the DOM but not visible ( | Add a mobile menu (or equivalent) that surfaces primary nav + Log in. Do not rely on desktop-only header CSS that sets Log in to display:none without a replacement entry point. |
| MOBILE-LOGIN-001 | **high** | public, influencer, business | Existing users cannot reach /login from the mobile homepage header | Only login anchor on mobile home is header a[href=/login] with display:none; no other visible 'Log in' link in the first viewport/footer probe. Returning influe | Expose Log in in the mobile menu or as a persistent header text link beside Join. Keep /login reachable without knowing the URL. |
| ADMIN-KPI-001 | **medium** | admin | Admin overview shows ↓100% deltas and Active Collaborations = 0 while member apps show active work | Admin /admin Platform Overview KPI strip text: Total Influencers 3 ↓100% vs previous 30 days; Total Businesses 2 ↓100%; Active Collaborations 0. Influencer dash | Fix period-over-period math when prior window is empty/zero; align Active Collaborations definition with member collaboration states so ops overview matches reality. |
| ADMIN-WEBHOOK-001 | **medium** | admin | Marketplace webhook health flagged ATTENTION on admin dashboard | System Health & Integrations lists Marketplace webhook with status ATTENTION (nearby copy: collab_os_v1 is on). Other integrations show OPERATIONAL. Evidence: a | Investigate webhook delivery/health for marketplace on staging; either restore healthy status or surface a precise remediation link for operators. |
| DISCOVER-SAMPLE-001 | **medium** | public, business | Public Discover is sample/demo mode — live bookable profiles unavailable | Yellow banner: 'Sample directory. These profiles are presentation demos, not live partners, and cannot be booked from this page.' Profile overlays use /discover | When ready for audit of live booking UX, enable live public profiles in admin guest gates / directory settings. Until then, treat Discover booking as intentionally blocked (coverage gap for live selection). |
| CARD-VANITY-001 | **low** | public, influencer | Vanity path /c/ag 404s on primary host; shortlink inflr.me/ag resolves to /c/ag-olomola-2 | Creator card UI shows www.inflr.me/ag. https://inflr.me/ag → 200 → /c/ag-olomola-2. Direct https://influrios.com/c/ag returns Next.js 404. /creators/ag-olomola  | Either document that only inflr.me vanity slugs are valid, or add primary-host redirects from /c/{vanity} to the canonical card slug to avoid broken shares/bookmarks on influrios.com. |
| ADMIN-MOBILE-001 | **low** | admin | Admin chrome remains dense on mobile viewport (sidebar + marketing header) | admin/mobile/admin-dash.png shows full admin sidebar and marketing top nav stacked in a 390px capture; operable but heavy for phone ops review. | Consider collapsing admin sidebar into a drawer on small screens if operators are expected to use phones; otherwise document admin as desktop-first. |

## Detail

### MOBILE-NAV-001 — Mobile marketing header hides primary nav and Log in with no menu control

- Severity: **high**
- Roles: public
- URL: `https://influrios.com/`
- Evidence: At 390×844 on https://influrios.com/, header links (Home, Discover, Categories, Collaboration, For Businesses, Pricing, Log in) are in the DOM but not visible (Log in computed display:none; width/height 0). No hamburger/menu button exists. Visible header actions are logo, search→/discover, and Join Influrios→/claim only. Evidence: screenshots/public/mobile/home.png and Playwright style probe 2026-11-18.
- Proposed correction: Add a mobile menu (or equivalent) that surfaces primary nav + Log in. Do not rely on desktop-only header CSS that sets Log in to display:none without a replacement entry point.

### MOBILE-LOGIN-001 — Existing users cannot reach /login from the mobile homepage header

- Severity: **high**
- Roles: public, influencer, business
- URL: `https://influrios.com/login`
- Evidence: Only login anchor on mobile home is header a[href=/login] with display:none; no other visible 'Log in' link in the first viewport/footer probe. Returning influencers/businesses on phones have no discoverable login CTA (Join routes to /claim). Evidence: public/mobile/home.png; probe confirmed zero visible log* links.
- Proposed correction: Expose Log in in the mobile menu or as a persistent header text link beside Join. Keep /login reachable without knowing the URL.

### ADMIN-KPI-001 — Admin overview shows ↓100% deltas and Active Collaborations = 0 while member apps show active work

- Severity: **medium**
- Roles: admin
- URL: `https://influrios.com/admin`
- Evidence: Admin /admin Platform Overview KPI strip text: Total Influencers 3 ↓100% vs previous 30 days; Total Businesses 2 ↓100%; Active Collaborations 0. Influencer dashboard shows 3 active collaborations; business dashboard shows active collaborations/funded work. Evidence: admin/desktop/admin-dash.png, influencer/desktop/creator-home.png, business/desktop/biz-home.png.
- Proposed correction: Fix period-over-period math when prior window is empty/zero; align Active Collaborations definition with member collaboration states so ops overview matches reality.

### ADMIN-WEBHOOK-001 — Marketplace webhook health flagged ATTENTION on admin dashboard

- Severity: **medium**
- Roles: admin
- URL: `https://influrios.com/admin`
- Evidence: System Health & Integrations lists Marketplace webhook with status ATTENTION (nearby copy: collab_os_v1 is on). Other integrations show OPERATIONAL. Evidence: admin/desktop/admin-dash.png; body text probe.
- Proposed correction: Investigate webhook delivery/health for marketplace on staging; either restore healthy status or surface a precise remediation link for operators.

### DISCOVER-SAMPLE-001 — Public Discover is sample/demo mode — live bookable profiles unavailable

- Severity: **medium**
- Roles: public, business
- URL: `https://influrios.com/discover`
- Evidence: Yellow banner: 'Sample directory. These profiles are presentation demos, not live partners, and cannot be booked from this page.' Profile overlays use /discover?profile=demo-* with 'Demo profile… not a live influencer.' Live test influencer card is separate (/c/ag-olomola-2 via inflr.me/ag). Evidence: public/desktop/discover.png, discover-profile-demo-amara.png.
- Proposed correction: When ready for audit of live booking UX, enable live public profiles in admin guest gates / directory settings. Until then, treat Discover booking as intentionally blocked (coverage gap for live selection).

### CARD-VANITY-001 — Vanity path /c/ag 404s on primary host; shortlink inflr.me/ag resolves to /c/ag-olomola-2

- Severity: **low**
- Roles: public, influencer
- URL: `https://influrios.com/c/ag`
- Evidence: Creator card UI shows www.inflr.me/ag. https://inflr.me/ag → 200 → /c/ag-olomola-2. Direct https://influrios.com/c/ag returns Next.js 404. /creators/ag-olomola also 404. Evidence: public/desktop/live-card-ag.png (404), live-card-inflr-me-ag.png, live-card-ag-olomola-2.png.
- Proposed correction: Either document that only inflr.me vanity slugs are valid, or add primary-host redirects from /c/{vanity} to the canonical card slug to avoid broken shares/bookmarks on influrios.com.

### ADMIN-MOBILE-001 — Admin chrome remains dense on mobile viewport (sidebar + marketing header)

- Severity: **low**
- Roles: admin
- URL: `https://influrios.com/admin`
- Evidence: admin/mobile/admin-dash.png shows full admin sidebar and marketing top nav stacked in a 390px capture; operable but heavy for phone ops review.
- Proposed correction: Consider collapsing admin sidebar into a drawer on small screens if operators are expected to use phones; otherwise document admin as desktop-first.


## Review notes for Ola

- Automated heuristics catch HTTP 5xx, visible runtime errors, auth bounces, and obvious 404 copy. Visual UX debt (spacing, hierarchy, clutter) requires human review of the atlas.
- No Payment Standard v2 work was performed. Agency role was not audited.
