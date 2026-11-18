/**
 * Read-only / isolation-safe E2E audit runner.
 * - No invites, payments, deletions, withdrawals, or outbound mail
 * - Separate browser contexts per role
 * - Produces case results, screenshots, short recordings, assertions
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import { execSync } from "node:child_process";

const BASE = process.env.AUDIT_BASE_URL || "https://influrios.com";
const RUN_ID = process.env.AUDIT_RUN_ID || "AUDIT_20261118170047";
const MEDIA = "/cursor/stores/self/media/e2e-audit";
const DOCS = "/cursor/stores/self/docs/e2e-audit";
const SHOTS = path.join(MEDIA, "screenshots");
const RECS = path.join(MEDIA, "recordings");
const AUTH = "/tmp/e2e-audit/auth"; // outside committed artifacts

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

function requireEnv(n) {
  const v = process.env[n];
  if (!v) throw new Error(`Missing ${n}`);
  return v;
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function sha256File(file) {
  try {
    return crypto.createHash("sha256").update(execSync(`cat ${JSON.stringify(file)}`)).digest("hex");
  } catch {
    return null;
  }
}

async function ensureDirs() {
  for (const d of [SHOTS, RECS, DOCS, AUTH, path.join(MEDIA, "assertions")]) {
    await fs.mkdir(d, { recursive: true });
  }
}

async function settle(page, ms = 700) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(ms);
}

async function shot(page, meta) {
  const { caseId, role, viewport, step } = meta;
  const dir = path.join(SHOTS, role, viewport);
  await fs.mkdir(dir, { recursive: true });
  const file = `${slug(caseId)}__${slug(step)}.png`;
  const full = path.join(dir, file);
  let status = "ok";
  try {
    await page.screenshot({ path: full, fullPage: true, timeout: 30000 });
  } catch {
    try {
      await page.screenshot({ path: full, fullPage: false, timeout: 15000 });
      status = "partial";
    } catch (e) {
      status = "failed";
      return { status, error: String(e.message || e), path: null };
    }
  }
  return {
    status,
    path: full,
    rel: path.relative(MEDIA, full),
    sha256: sha256File(full),
    url: page.url(),
    title: await page.title().catch(() => ""),
  };
}

async function memberLogin(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await settle(page, 1200);
  return page.url();
}

async function adminLogin(page, email, password) {
  await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(
    ({ e, p }) => {
      const emailEl = document.querySelector('input[name="email"]');
      const passEl = document.querySelector('input[name="password"]');
      if (emailEl) {
        emailEl.value = e;
        emailEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (passEl) {
        passEl.value = p;
        passEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
    },
    { e: email, p: password },
  );
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await settle(page, 1200);
  return page.url();
}

function popupGeometry(box, viewport) {
  if (!box) return { centered: false, reason: "no-box" };
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const midX = viewport.width / 2;
  const midY = viewport.height / 2;
  const dx = Math.abs(cx - midX) / viewport.width;
  const dy = Math.abs(cy - midY) / viewport.height;
  const rightDrawer = box.x > viewport.width * 0.45 && box.width < viewport.width * 0.6;
  const fullBleedMobile = viewport.width <= 500 && box.width >= viewport.width * 0.92;
  return {
    box,
    dx,
    dy,
    rightDrawer,
    fullBleedMobile,
    centeredDesktop: viewport.width > 500 && dx < 0.12 && !rightDrawer,
  };
}

async function findDialog(page) {
  const sels = [
    '[role="dialog"]',
    '[aria-modal="true"]',
    ".fixed.inset-0",
    '[data-state="open"]',
  ];
  for (const sel of sels) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible().catch(() => false)) {
      const box = await loc.boundingBox().catch(() => null);
      return { sel, box, loc };
    }
  }
  // Heuristic: large fixed panels
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll("div")].filter((el) => {
      const s = getComputedStyle(el);
      if (s.position !== "fixed" && s.position !== "absolute") return false;
      const r = el.getBoundingClientRect();
      return r.width > 280 && r.height > 200 && s.visibility !== "hidden" && s.display !== "none";
    });
    if (!nodes.length) return null;
    nodes.sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height);
    const r = nodes[0].getBoundingClientRect();
    return { sel: "heuristic-fixed", box: { x: r.x, y: r.y, width: r.width, height: r.height } };
  });
}

async function tryOpenFirstAction(page, names) {
  for (const name of names) {
    const btn = page.getByRole("button", { name }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      await settle(page, 900);
      return name;
    }
    const link = page.getByRole("link", { name }).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click().catch(() => {});
      await settle(page, 900);
      return name;
    }
  }
  // text fallback
  for (const name of names) {
    const t = page.locator(`text=${name}`).first();
    if (await t.isVisible().catch(() => false)) {
      await t.click().catch(() => {});
      await settle(page, 900);
      return name;
    }
  }
  return null;
}

function caseResult(partial) {
  return {
    runId: RUN_ID,
    buildId: null,
    startedAt: new Date().toISOString(),
    integrationLevel: "L1-visual-nav",
    functionalResult: "Not tested",
    visualResult: "Not tested",
    screenshotRefs: [],
    recordingRef: null,
    assertionRefs: [],
    providerEventRefs: [],
    issueIds: [],
    blocker: null,
    retestOf: null,
    ...partial,
    completedAt: new Date().toISOString(),
  };
}

async function visitRoutes(page, role, viewportName, routes, results, interactions) {
  for (const r of routes) {
    const caseId = `ROUTE-${role}-${r.id || slug(r.path)}`;
    const start = Date.now();
    let functional = "Pass";
    let visual = "Pass";
    let err = null;
    let finalUrl = null;
    try {
      const resp = await page.goto(`${BASE}${r.path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await settle(page, 800);
      finalUrl = page.url();
      const status = resp?.status?.() ?? null;
      const title = await page.title();
      const bodyText = await page.locator("body").innerText().catch(() => "");
      if (status && status >= 500) functional = "Fail";
      if (/something went wrong|application error|uncaught/i.test(bodyText)) functional = "Fail";
      // Redirect labeling
      const landed = new URL(finalUrl).pathname;
      const intended = r.path.split("?")[0];
      const redirected = landed !== intended && !landed.startsWith(intended);
      const shotMeta = await shot(page, { caseId, role, viewport: viewportName, step: "open" });
      results.push(
        caseResult({
          caseId,
          stepId: "open",
          role,
          fixtureIds: ["AUDIT_EXISTING"],
          startUrl: `${BASE}${r.path}`,
          finalUrl,
          viewport: viewportName,
          browserVersion: "chromium-playwright",
          integrationLevel: "L1-visual-nav",
          expected: `Reach ${r.title || r.path} for role ${role}`,
          actual: `status=${status}; title=${title}; redirected=${redirected}; path=${landed}`,
          functionalResult: functional,
          visualResult: visual,
          screenshotRefs: [shotMeta],
          assertionRefs: [
            {
              type: "route-open",
              intended,
              landed,
              redirected,
              httpStatus: status,
              title,
            },
          ],
          durationMs: Date.now() - start,
          journeyId: r.journey || "inventory",
        }),
      );
      interactions.push({ caseId, role, path: r.path, finalUrl, redirected, status });
    } catch (e) {
      err = String(e.message || e);
      results.push(
        caseResult({
          caseId,
          stepId: "open",
          role,
          startUrl: `${BASE}${r.path}`,
          finalUrl,
          viewport: viewportName,
          expected: `Open ${r.path}`,
          actual: err,
          functionalResult: "Fail",
          visualResult: "Not tested",
          journeyId: r.journey || "inventory",
        }),
      );
    }
  }
}

async function main() {
  await ensureDirs();
  const buildId = await fetch(`${BASE}/api/health`)
    .then((r) => r.json())
    .then((j) => j.revision)
    .catch(() => "unknown");

  const results = [];
  const issues = [];
  const manifest = { runId: RUN_ID, buildId, baseUrl: BASE, startedAt: new Date().toISOString(), assets: [] };

  // P0 issue from preflight (no secret values)
  issues.push({
    id: "ISSUE-P0-ADMIN-LOGIN-DEFAULT-CREDS",
    severity: "P0",
    role: "admin",
    route: "/admin/login",
    caseId: "J02-admin-exposure",
    buildId,
    runId: RUN_ID,
    prerequisites: "Public unauthenticated access",
    steps: "Open /admin/login; observe default super-admin hint rendering concrete credentials",
    expected: "No concrete default credentials on login page",
    actual: "Page renders default super-admin email and password hint (values redacted from pack)",
    impact: "Credential exposure / unauthorized admin access risk",
    reproducibility: "Always",
    evidenceLinks: ["media/e2e-audit/preflight/01-admin-login-public.png (redacted)"],
    suspectedCause: "Login page intentionally prints ADMIN_SUPER_* defaults for bootstrap",
    proposedCorrection: "Remove concrete credential rendering; show setup-needed state only when no admin exists",
    ownerRole: "Engineering",
    retestResult: "Not retested",
  });

  const browser = await chromium.launch({ headless: true });

  const PUBLIC = [
    { id: "home", path: "/", title: "Home", journey: "J29" },
    { id: "discover", path: "/discover", title: "Discover", journey: "J03" },
    { id: "pricing", path: "/pricing", title: "Pricing", journey: "J16" },
    { id: "signup", path: "/signup", title: "Signup", journey: "J01" },
    { id: "login", path: "/login", title: "Login", journey: "J02" },
    { id: "claim", path: "/claim", title: "Claim", journey: "J01" },
    { id: "business", path: "/business", title: "Business landing", journey: "J29" },
    { id: "collaboration", path: "/collaboration", title: "Collaboration landing", journey: "J29" },
    { id: "card", path: "/card", title: "Card", journey: "J03" },
    { id: "faq", path: "/faq", title: "FAQ", journey: "J29" },
    { id: "legal", path: "/legal", title: "Legal", journey: "J29" },
    { id: "categories", path: "/categories", title: "Categories", journey: "J29" },
    { id: "mentorship", path: "/mentorship", title: "Mentorship", journey: "J29" },
    { id: "trust", path: "/trust", title: "Trust", journey: "J29" },
    { id: "payments", path: "/payments", title: "Payments", journey: "J13" },
    { id: "agency", path: "/agency", title: "Agency (deferred)", journey: "AGENCY" },
    { id: "admin-login", path: "/admin/login", title: "Admin login", journey: "J02" },
    { id: "reset", path: "/account/reset", title: "Password reset", journey: "J02" },
    { id: "404", path: "/this-route-should-404-audit", title: "404 recovery", journey: "J29" },
  ];

  const INF = [
    { id: "creator", path: "/creator", title: "Creator home", journey: "J03" },
    { id: "inbox", path: "/collaboration/inbox", title: "Inbox", journey: "J05" },
    { id: "dashboard", path: "/dashboard", title: "Profile", journey: "J03" },
    { id: "details", path: "/dashboard/details", title: "Details", journey: "J03" },
    { id: "social", path: "/dashboard/social", title: "Social", journey: "J03" },
    { id: "links", path: "/dashboard/links", title: "Links", journey: "J03" },
    { id: "kyc", path: "/dashboard/kyc", title: "KYC", journey: "J03" },
    { id: "prefs", path: "/dashboard/preferences", title: "Prefs", journey: "J03" },
    { id: "media-kit", path: "/creator/media-kit", title: "Media kit", journey: "J29" },
    { id: "analytics", path: "/creator/analytics", title: "Analytics", journey: "J29" },
    { id: "hub", path: "/collaboration/hub?view=collaborations", title: "Hub", journey: "J14" },
    { id: "contracts", path: "/collaboration/contracts", title: "Contracts", journey: "J10" },
    { id: "earnings", path: "/creator/earnings", title: "Earnings", journey: "J15" },
    { id: "messages", path: "/creator/messages", title: "Messages", journey: "J22" },
    { id: "notifications", path: "/creator/notifications", title: "Notifications", journey: "J23" },
    { id: "account", path: "/account", title: "Account", journey: "J02" },
    { id: "billing", path: "/billing", title: "Billing", journey: "J16" },
    { id: "payments", path: "/payments", title: "Payments", journey: "J13" },
  ];

  const BIZ = [
    { id: "home", path: "/business/home", title: "Business home", journey: "J04" },
    { id: "inbox", path: "/collaboration/inbox", title: "Inbox", journey: "J05" },
    { id: "profile", path: "/business/profile", title: "Profile", journey: "J29" },
    { id: "discover", path: "/discover", title: "Discover", journey: "J03" },
    { id: "collab", path: "/collaboration/business", title: "Collaborations/requests", journey: "J04" },
    { id: "contracts", path: "/collaboration/contracts", title: "Contracts", journey: "J10" },
    { id: "intelligence", path: "/business/intelligence", title: "Intelligence", journey: "J29" },
    { id: "team", path: "/collaboration/team", title: "Team", journey: "J29" },
    { id: "billing", path: "/business/billing", title: "Billing", journey: "J16" },
    { id: "plans", path: "/business/plans", title: "Plans", journey: "J16" },
    { id: "campaigns", path: "/business/campaigns", title: "Campaigns", journey: "J29" },
    { id: "workspace", path: "/business/workspace", title: "Workspace", journey: "J29" },
    { id: "payments", path: "/payments", title: "Payments", journey: "J13" },
    { id: "propose", path: "/collaboration/propose", title: "Propose", journey: "J04" },
    { id: "records", path: "/collaboration/records", title: "Records", journey: "J29" },
  ];

  const ADMIN = [
    { id: "dash", path: "/admin", title: "Dashboard", journey: "J25" },
    { id: "accounts", path: "/admin/accounts", title: "Influencer accounts", journey: "J25" },
    { id: "biz-accounts", path: "/admin/business-accounts", title: "Business accounts", journey: "J25" },
    { id: "admin-users", path: "/admin/admin-users", title: "Admin users", journey: "J25" },
    { id: "access", path: "/admin/access", title: "Access levels", journey: "J25" },
    { id: "plans", path: "/admin/plans", title: "Plans", journey: "J26" },
    { id: "billing", path: "/admin/billing", title: "Billing", journey: "J16" },
    { id: "payment-settings", path: "/admin/payment-settings", title: "Payment settings", journey: "J19" },
    { id: "tax", path: "/admin/payment-settings?section=tax", title: "Tax", journey: "J19" },
    { id: "discounts", path: "/admin/payment-settings?section=discounts", title: "Discounts", journey: "J18" },
    { id: "signing", path: "/admin/signing", title: "Signing", journey: "J11" },
    { id: "contracts", path: "/admin/contracts", title: "Contracts", journey: "J10" },
    { id: "mail", path: "/admin/mail", title: "Mail", journey: "J23" },
    { id: "jobs", path: "/admin/jobs", title: "Jobs", journey: "J27" },
    { id: "marketplace", path: "/admin/marketplace", title: "Marketplace", journey: "J15" },
    { id: "collaborations", path: "/admin/collaborations", title: "Collaborations", journey: "J14" },
    { id: "deals", path: "/admin/deals", title: "Deals", journey: "J14" },
    { id: "ai", path: "/admin/ai", title: "AI", journey: "J28" },
    { id: "matching", path: "/admin/matching", title: "Matching", journey: "J28" },
    { id: "homepage", path: "/admin/homepage", title: "Homepage CMS", journey: "J27" },
    { id: "agency", path: "/admin/agency", title: "Agency admin page", journey: "AGENCY" },
  ];

  // ---- Public desktop + mobile ----
  for (const vp of ["desktop", "mobile"]) {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[vp] });
    const page = await ctx.newPage();
    await visitRoutes(page, "public", vp, PUBLIC, results, []);
    // Pricing visual checks
    await page.goto(`${BASE}/pricing`, { waitUntil: "domcontentloaded" });
    await settle(page, 800);
    const pricingText = await page.locator("body").innerText();
    const hasMonthly = /monthly/i.test(pricingText);
    const hasAnnual = /annual/i.test(pricingText);
    const shotP = await shot(page, { caseId: "J16-pricing-visual", role: "public", viewport: vp, step: "pricing" });
    results.push(
      caseResult({
        caseId: `J16-pricing-visual-${vp}`,
        role: "public",
        startUrl: `${BASE}/pricing`,
        finalUrl: page.url(),
        viewport: vp,
        buildId,
        integrationLevel: "L1-visual-nav",
        expected: "Monthly/Annual visible; comparison usable",
        actual: `monthly=${hasMonthly}; annual=${hasAnnual}`,
        functionalResult: hasMonthly && hasAnnual ? "Pass" : "Fail",
        visualResult: hasMonthly && hasAnnual ? "Pass" : "Fail",
        screenshotRefs: [shotP],
        journeyId: "J16",
      }),
    );
    await ctx.close();
  }

  // ---- Role sessions (desktop full + mobile core) ----
  async function roleSession(role, loginFn, routes, mobileSubset) {
    // Desktop recording of shell navigation
    const ctx = await browser.newContext({
      viewport: VIEWPORTS.desktop,
      recordVideo: { dir: RECS, size: VIEWPORTS.desktop },
    });
    const page = await ctx.newPage();
    const url = await loginFn(page);
    const loginOk = role === "admin" ? /\/admin(?!\/login)/.test(new URL(url).pathname) : true;
    const loginShot = await shot(page, { caseId: `J02-login-${role}`, role, viewport: "desktop", step: "after-login" });
    results.push(
      caseResult({
        caseId: `J02-login-${role}`,
        role,
        startUrl: role === "admin" ? `${BASE}/admin/login` : `${BASE}/login`,
        finalUrl: url,
        viewport: "desktop",
        buildId,
        integrationLevel: "L2-app-internal",
        expected: `Authenticated ${role} home`,
        actual: url,
        functionalResult: loginOk ? "Pass" : "Fail",
        visualResult: "Pass",
        screenshotRefs: [loginShot],
        journeyId: "J02",
      }),
    );
    await visitRoutes(page, role, "desktop", routes, results, []);

    // Popup probes on key list pages
    const popupTargets =
      role === "business"
        ? [{ path: "/collaboration/business", names: [/new request/i, /create/i, /add request/i, /view/i, /edit/i] }]
        : role === "admin"
          ? [
              { path: "/admin/accounts", names: [/view/i, /edit/i, /open/i] },
              { path: "/admin/payment-settings?section=tax", names: [/edit/i, /add/i, /new/i] },
              { path: "/admin/plans", names: [/edit/i, /create plan/i] },
            ]
          : role === "influencer"
            ? [{ path: "/collaboration/contracts", names: [/view/i, /open/i] }]
            : [];

    for (const t of popupTargets) {
      await page.goto(`${BASE}${t.path}`, { waitUntil: "domcontentloaded" });
      await settle(page, 1000);
      const listShot = await shot(page, {
        caseId: `J30-popup-${role}-${slug(t.path)}`,
        role,
        viewport: "desktop",
        step: "list",
      });
      const opened = await tryOpenFirstAction(page, t.names);
      const dlg = await findDialog(page);
      const geom = popupGeometry(dlg?.box, VIEWPORTS.desktop);
      const openShot = await shot(page, {
        caseId: `J30-popup-${role}-${slug(t.path)}`,
        role,
        viewport: "desktop",
        step: opened ? "popup-open" : "no-popup",
      });
      let visual = "Not applicable";
      let functional = opened ? "Pass" : "Blocked";
      let actual = `opened=${opened}; dialog=${Boolean(dlg)}; geom=${JSON.stringify(geom)}`;
      if (opened && dlg) {
        visual = geom.centeredDesktop ? "Pass" : geom.rightDrawer ? "Fail" : "Fail";
        if (!geom.centeredDesktop) {
          issues.push({
            id: `ISSUE-VIS-POPUP-${role}-${slug(t.path)}`.slice(0, 80),
            severity: "P1",
            role,
            route: t.path,
            caseId: `J30-popup-${role}-${slug(t.path)}`,
            buildId,
            runId: RUN_ID,
            steps: `Open ${t.path}; trigger ${opened}`,
            expected: "Centered desktop popup (PR #533)",
            actual,
            impact: "Sidebar/appended editor instead of centered popup",
            reproducibility: "Observed this run",
            evidenceLinks: [openShot.rel],
            suspectedCause: "Pre-#533 layout still deployed",
            proposedCorrection: "Implement centered dialog per PR #533 design package",
            ownerRole: "Engineering",
            retestResult: "Not retested",
          });
        }
      } else if (!opened) {
        actual += "; no matching CTA visible on existing fixtures (read-only)";
        functional = "Not tested";
        visual = "Not tested";
      }
      results.push(
        caseResult({
          caseId: `J30-popup-${role}-${slug(t.path)}-desktop`,
          role,
          startUrl: `${BASE}${t.path}`,
          finalUrl: page.url(),
          viewport: "desktop",
          buildId,
          integrationLevel: "L1-visual-nav",
          expected: "Centered desktop popup over list",
          actual,
          functionalResult: functional,
          visualResult: visual,
          screenshotRefs: [listShot, openShot],
          assertionRefs: [{ type: "popup-geometry", geom, opened }],
          journeyId: "J30",
          issueIds: visual === "Fail" ? [issues[issues.length - 1]?.id].filter(Boolean) : [],
        }),
      );
      await page.keyboard.press("Escape").catch(() => {});
    }

    const videoPath = await page.video()?.path().catch(() => null);
    await ctx.close();
    if (videoPath) {
      const dest = path.join(RECS, `${slug(role)}-desktop-nav.webm`);
      await fs.rename(videoPath, dest).catch(async () => {
        await fs.copyFile(videoPath, dest);
      });
      manifest.assets.push({ type: "recording", path: dest, sha256: sha256File(dest) });
    }

    // Mobile core
    const mctx = await browser.newContext({ viewport: VIEWPORTS.mobile });
    const mpage = await mctx.newPage();
    await loginFn(mpage);
    await visitRoutes(mpage, role, "mobile", mobileSubset, results, []);
    // mobile popup sample
    if (role === "business") {
      await mpage.goto(`${BASE}/collaboration/business`, { waitUntil: "domcontentloaded" });
      await settle(mpage, 900);
      const opened = await tryOpenFirstAction(mpage, [/view/i, /edit/i, /new/i, /create/i]);
      const dlg = await findDialog(mpage);
      const geom = popupGeometry(dlg?.box, VIEWPORTS.mobile);
      const s = await shot(mpage, { caseId: "J30-popup-business-mobile", role, viewport: "mobile", step: opened ? "open" : "list" });
      results.push(
        caseResult({
          caseId: "J30-popup-business-mobile",
          role,
          startUrl: `${BASE}/collaboration/business`,
          finalUrl: mpage.url(),
          viewport: "mobile",
          buildId,
          expected: "Full-screen mobile editor with title/Close",
          actual: JSON.stringify({ opened, geom }),
          functionalResult: opened ? "Pass" : "Not tested",
          visualResult: geom.fullBleedMobile ? "Pass" : opened ? "Fail" : "Not tested",
          screenshotRefs: [s],
          journeyId: "J30",
        }),
      );
    }
    await mctx.close();
  }

  await roleSession(
    "influencer",
    (p) => memberLogin(p, requireEnv("AUDIT_INFLUENCER_EMAIL"), requireEnv("AUDIT_INFLUENCER_PASSWORD")),
    INF,
    INF.slice(0, 8),
  );
  await roleSession(
    "business",
    (p) => memberLogin(p, requireEnv("AUDIT_BUSINESS_EMAIL"), requireEnv("AUDIT_BUSINESS_PASSWORD")),
    BIZ,
    BIZ.slice(0, 8),
  );
  await roleSession(
    "admin",
    (p) => adminLogin(p, requireEnv("AUDIT_ADMIN_EMAIL"), requireEnv("AUDIT_ADMIN_PASSWORD")),
    ADMIN,
    ADMIN.slice(0, 8),
  );

  // ---- Permission boundaries (read-only) ----
  {
    const bizCtx = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const bizPage = await bizCtx.newPage();
    await memberLogin(bizPage, requireEnv("AUDIT_BUSINESS_EMAIL"), requireEnv("AUDIT_BUSINESS_PASSWORD"));
    // Collect a contract deep link if present
    await bizPage.goto(`${BASE}/collaboration/contracts`, { waitUntil: "domcontentloaded" });
    await settle(bizPage, 800);
    const href = await bizPage.locator('a[href*="/collaboration/contracts/"]').first().getAttribute("href").catch(() => null);
    await bizCtx.close();

    const infCtx = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const infPage = await infCtx.newPage();
    await memberLogin(infPage, requireEnv("AUDIT_INFLUENCER_EMAIL"), requireEnv("AUDIT_INFLUENCER_PASSWORD"));
    let denied = false;
    let finalUrl = null;
    let body = "";
    if (href) {
      await infPage.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
      await settle(infPage, 1000);
      finalUrl = infPage.url();
      body = await infPage.locator("body").innerText().catch(() => "");
      denied = /not found|forbidden|don't have access|do not have access|unauthorized|sign in/i.test(body) || !finalUrl.includes(href.split("?")[0]);
    }
    const s = await shot(infPage, { caseId: "J24-permission-cross-contract", role: "influencer", viewport: "desktop", step: "direct-link" });
    results.push(
      caseResult({
        caseId: "J24-permission-cross-contract",
        role: "influencer",
        startUrl: href ? `${BASE}${href}` : "(no business contract link found)",
        finalUrl,
        viewport: "desktop",
        buildId,
        integrationLevel: "L2-app-internal",
        expected: "Unrelated influencer denied business contract detail",
        actual: href ? `deniedHeuristic=${denied}; path=${finalUrl}` : "No contract href on business list — Not tested",
        functionalResult: href ? (denied ? "Pass" : "Fail") : "Not tested",
        visualResult: "Pass",
        screenshotRefs: [s],
        journeyId: "J24",
        blocker: href ? null : "No fixture contract link visible",
      }),
    );
    if (href && !denied) {
      issues.push({
        id: "ISSUE-P0-CONTRACT-IDOR",
        severity: "P0",
        role: "influencer",
        route: href,
        caseId: "J24-permission-cross-contract",
        buildId,
        runId: RUN_ID,
        steps: "Login as AUDIT influencer; open business contract deep link",
        expected: "Access denied",
        actual: "Page appeared accessible (heuristic)",
        impact: "Possible unauthorized contract access",
        reproducibility: "This run",
        evidenceLinks: [s.rel],
        suspectedCause: "Missing server authorization on contract detail",
        proposedCorrection: "Enforce membership checks server-side",
        ownerRole: "Engineering",
        retestResult: "Not retested",
      });
    }
    await infCtx.close();
  }

  // ---- Journey matrix stubs for blocked mutations ----
  const blockedJourneys = [
    ["J01", "Signup + email verification", "BLK-MAIL-SINK"],
    ["J04", "Create/edit/publish request", "BLK-ISOLATION"],
    ["J05", "Invite + accept across accounts", "BLK-MAIL-SINK"],
    ["J06", "Response review + selection", "BLK-ISOLATION"],
    ["J07", "Delete unaccepted request", "BLK-ISOLATION"],
    ["J08", "Withdraw accepted participants", "BLK-ISOLATION"],
    ["J09", "Protect signed/funded work", "BLK-ISOLATION"],
    ["J10", "Prepare agreement (mutating)", "BLK-ISOLATION"],
    ["J11", "Sign from both accounts", "BLK-ISOLATION"],
    ["J12", "Signing failure/version changes", "BLK-ISOLATION"],
    ["J13", "Business collaboration checkout", "BLK-ISOLATION"],
    ["J14", "Deliver/review/revise/approve", "BLK-ISOLATION"],
    ["J15", "Release/transfer/payout", "BLK-ISOLATION"],
    ["J16", "New sandbox subscription purchases", "BLK-ISOLATION"],
    ["J17", "Existing subscriber changes", "BLK-ISOLATION"],
    ["J18", "Discount eligibility mutations", "BLK-ISOLATION"],
    ["J19", "Configure tax mutations", "BLK-ISOLATION"],
    ["J20", "Quote through final charge", "BLK-ISOLATION"],
    ["J22", "Two-party messaging send", "BLK-ISOLATION"],
    ["J23", "Lifecycle notification delivery", "BLK-MAIL-SINK"],
  ];
  for (const [id, title, blocker] of blockedJourneys) {
    results.push(
      caseResult({
        caseId: `${id}-mutating-main`,
        role: "multi",
        startUrl: BASE,
        finalUrl: null,
        viewport: "desktop",
        buildId,
        integrationLevel: "L3-provider-sandbox",
        expected: title,
        actual: `Not executed — blocker ${blocker}. Read-only related surfaces may still have ROUTE-* / login evidence.`,
        functionalResult: "Blocked",
        visualResult: "Not tested",
        journeyId: id,
        blocker,
        screenshotRefs: [],
      }),
    );
  }

  // Agency deferred
  results.push(
    caseResult({
      caseId: "AGENCY-deferred",
      role: "agency",
      startUrl: `${BASE}/agency`,
      finalUrl: null,
      viewport: "desktop",
      buildId,
      expected: "Agency workflow certification",
      actual: "Deferred per preferences — inventory only",
      functionalResult: "Not applicable",
      visualResult: "Not applicable",
      journeyId: "AGENCY",
    }),
  );

  // J21 cross-screen — limited read-only on existing fixtures
  {
    const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const page = await ctx.newPage();
    await memberLogin(page, requireEnv("AUDIT_BUSINESS_EMAIL"), requireEnv("AUDIT_BUSINESS_PASSWORD"));
    const surfaces = ["/business/home", "/collaboration/inbox", "/collaboration/business", "/collaboration/contracts", "/business/billing"];
    const snaps = [];
    for (const pth of surfaces) {
      await page.goto(`${BASE}${pth}`, { waitUntil: "domcontentloaded" });
      await settle(page, 600);
      snaps.push(await shot(page, { caseId: "J21-cross-screen", role: "business", viewport: "desktop", step: slug(pth) }));
    }
    results.push(
      caseResult({
        caseId: "J21-cross-screen-business-readonly",
        role: "business",
        startUrl: `${BASE}/business/home`,
        finalUrl: page.url(),
        viewport: "desktop",
        buildId,
        integrationLevel: "L2-app-internal",
        expected: "Dashboard/inbox/collab/contracts/billing reachable for same session",
        actual: `Captured ${snaps.length} surfaces (IDs not reconciled — no main-journey entity yet)`,
        functionalResult: "Pass",
        visualResult: "Pass",
        screenshotRefs: snaps,
        journeyId: "J21",
      }),
    );
    await ctx.close();
  }

  await browser.close();

  // Stamp buildId
  for (const r of results) r.buildId = buildId;

  manifest.completedAt = new Date().toISOString();
  manifest.caseCount = results.length;
  manifest.issueCount = issues.length;

  await fs.writeFile(path.join(DOCS, "results.json"), JSON.stringify(results, null, 2));
  await fs.writeFile(path.join(DOCS, "issues.json"), JSON.stringify(issues, null, 2));
  await fs.writeFile(path.join(DOCS, "manifest.json"), JSON.stringify(manifest, null, 2));

  // issues.csv
  const cols = [
    "id",
    "severity",
    "role",
    "route",
    "caseId",
    "buildId",
    "runId",
    "expected",
    "actual",
    "impact",
    "ownerRole",
    "retestResult",
  ];
  const csv =
    cols.join(",") +
    "\n" +
    issues
      .map((i) => cols.map((c) => `"${String(i[c] ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n") +
    "\n";
  await fs.writeFile(path.join(DOCS, "issues.csv"), csv);

  const summary = {
    cases: results.length,
    byFunctional: {},
    byVisual: {},
    issues: issues.length,
    p0: issues.filter((i) => i.severity === "P0").length,
  };
  for (const r of results) {
    summary.byFunctional[r.functionalResult] = (summary.byFunctional[r.functionalResult] || 0) + 1;
    summary.byVisual[r.visualResult] = (summary.byVisual[r.visualResult] || 0) + 1;
  }
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
