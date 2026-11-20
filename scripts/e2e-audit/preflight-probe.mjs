/**
 * Preflight isolation + provider readiness probe (read-mostly).
 * - Logs in as admin / business / influencer with AUDIT_* secrets
 * - Captures provider/mode signals without completing payments or inviting real users
 * - Optional: admin mail test send ONLY if MAIL_SINK_TO is set (allowlisted)
 * Never prints secret values.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.AUDIT_BASE_URL || "https://influrios.com";
const OUT = "/cursor/stores/self/media/e2e-audit/preflight";
const DOCS = "/cursor/stores/self/docs/e2e-audit";
const RUN_ID = process.env.AUDIT_RUN_ID || `AUDIT_${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}`;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function redact(text) {
  return String(text || "")
    .replace(/sk_(live|test)_[A-Za-z0-9]+/g, "sk_$1_[REDACTED]")
    .replace(/pk_(live|test)_[A-Za-z0-9]+/g, "pk_$1_[REDACTED]")
    .replace(/whsec_[A-Za-z0-9]+/g, "whsec_[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/password[=:]\s*\S+/gi, "password=[REDACTED]");
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true, timeout: 30000 }).catch(async () => {
    await page.screenshot({ path: file, fullPage: false, timeout: 15000 });
  });
  return file;
}

async function memberLogin(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
  return page.url();
}

async function adminLogin(page, email, password) {
  await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  // Avoid type-duplication issues seen in prior smoke: set values via evaluate
  await page.evaluate(
    ({ e, p }) => {
      const email = document.querySelector('input[name="email"]');
      const pass = document.querySelector('input[name="password"]');
      if (email) {
        email.value = e;
        email.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (pass) {
        pass.value = p;
        pass.dispatchEvent(new Event("input", { bubbles: true }));
      }
    },
    { e: email, p: password },
  );
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
  return page.url();
}

function summarizeText(text) {
  const t = redact(text).toLowerCase();
  return {
    mentionsLiveKey: /sk_live_|pk_live_/.test(t),
    mentionsTestKey: /sk_test_|pk_test_|sandbox|test mode/.test(t),
    mentionsStripe: /stripe/.test(t),
    mentionsAirwallex: /airwallex/.test(t),
    mentionsDocusign: /docusign|signing/.test(t),
    mentionsSmtp: /smtp|mail/.test(t),
    mentionsDemoPayments: /legacy_demo|demo.?payment|demo.?checkout/.test(t),
  };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  await fs.mkdir(DOCS, { recursive: true });

  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch((e) => ({ error: String(e) }));
  const adminEmail = requireEnv("AUDIT_ADMIN_EMAIL");
  const adminPass = requireEnv("AUDIT_ADMIN_PASSWORD");
  const bizEmail = requireEnv("AUDIT_BUSINESS_EMAIL");
  const bizPass = requireEnv("AUDIT_BUSINESS_PASSWORD");
  const infEmail = requireEnv("AUDIT_INFLUENCER_EMAIL");
  const infPass = requireEnv("AUDIT_INFLUENCER_PASSWORD");

  const browser = await chromium.launch({ headless: true });
  const result = {
    runId: RUN_ID,
    baseUrl: BASE,
    startedAt: new Date().toISOString(),
    health,
    adminLoginExposure: null,
    logins: {},
    providers: {},
    mail: {},
    screenshots: [],
    blockers: [],
  };

  // Public admin login exposure check (no password attempt with exposed defaults)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
    const body = await page.locator("body").innerText();
    const hasDefaultHint = /Default super admin/i.test(body);
    const hasCredentialPair = /ADMIN_SUPER_EMAIL[\s\S]{0,80}ADMIN_SUPER_PASSWORD/i.test(body);
    // Detect whether concrete values (not just env var names) appear after the colon
    const afterHint = body.split(/Default super admin/i)[1] || "";
    const looksLikeEmailShown = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(afterHint);
    result.adminLoginExposure = {
      pageShowsDefaultSuperAdminHint: hasDefaultHint,
      pageReferencesEnvVarNames: hasCredentialPair,
      pageAppearsToRenderConcreteEmail: looksLikeEmailShown,
      severity: looksLikeEmailShown ? "P0" : hasDefaultHint ? "P1" : "none",
      note: "Values not recorded. Do not attempt exposed password against live admin.",
    };
    result.screenshots.push(await shot(page, "01-admin-login-public"));
    await ctx.close();
  }

  // Admin session — provider / mail / switches (read)
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const url = await adminLogin(page, adminEmail, adminPass);
    result.logins.admin = { finalUrl: url, ok: /\/admin(?!\/login)/.test(new URL(url).pathname) };
    result.screenshots.push(await shot(page, "02-admin-home"));

    const pagesToProbe = [
      { key: "mail", path: "/admin/mail", shot: "03-admin-mail" },
      { key: "mailHealth", path: "/admin/mail/health", shot: "04-admin-mail-health" },
      { key: "jobs", path: "/admin/jobs", shot: "05-admin-jobs" },
      { key: "paymentSettings", path: "/admin/payment-settings", shot: "06-admin-payment-settings" },
      { key: "paymentProviders", path: "/admin/payment-settings?section=providers", shot: "07-admin-providers" },
      { key: "signing", path: "/admin/signing", shot: "08-admin-signing" },
      { key: "billing", path: "/admin/billing", shot: "09-admin-billing" },
      { key: "plans", path: "/admin/plans", shot: "10-admin-plans" },
      { key: "marketplace", path: "/admin/marketplace", shot: "11-admin-marketplace" },
    ];

    for (const p of pagesToProbe) {
      await page.goto(`${BASE}${p.path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1200);
      const text = await page.locator("body").innerText().catch(() => "");
      result.providers[p.key] = {
        url: page.url(),
        title: await page.title(),
        summary: summarizeText(text),
        excerpt: redact(text).slice(0, 1200),
      };
      result.screenshots.push(await shot(page, p.shot));
    }

    // Optional controlled mail test
    const sink = process.env.MAIL_SINK_TO?.trim();
    if (sink) {
      await page.goto(`${BASE}/admin/mail`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      // Try common test-send UI patterns without guessing secrets
      const testInput = page.locator('input[name="to"], input[name="email"], input[type="email"]').first();
      const testBtn = page.getByRole("button", { name: /test|send test|send/i }).first();
      if ((await testInput.count()) && (await testBtn.count())) {
        await testInput.fill(sink);
        await testBtn.click();
        await page.waitForTimeout(2500);
        result.mail.testSendAttempted = true;
        result.mail.sinkAliasDomain = sink.includes("@") ? sink.split("@")[1] : "(non-email)";
        result.mail.pageTextAfter = redact(await page.locator("body").innerText()).slice(0, 800);
        result.screenshots.push(await shot(page, "12-admin-mail-test-send"));
      } else {
        result.mail.testSendAttempted = false;
        result.mail.reason = "No obvious test-send controls found on /admin/mail";
      }
    } else {
      result.mail.testSendAttempted = false;
      result.mail.reason = "MAIL_SINK_TO not set — refusing unsolicited mail send";
      result.blockers.push({
        id: "BLK-MAIL-SINK",
        dependency: "Controlled notification sink / allowlisted audit inbox",
        affected: ["J01", "J02", "J05", "J07", "J08", "J11", "J16", "J23"],
        action: "Provide MAIL_SINK_TO (or confirm admin SMTP test recipient is an audit-only mailbox) and prove interception before invitation/signing/withdrawal/billing notification cases.",
        owner: "Operator / Ola",
      });
    }

    await ctx.close();
  }

  // Business + influencer login smoke (isolation of sessions)
  for (const [role, email, pass, expectPath] of [
    ["business", bizEmail, bizPass, "/business"],
    ["influencer", infEmail, infPass, "/creator"],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const url = await memberLogin(page, email, pass);
    result.logins[role] = {
      finalUrl: url,
      ok: new URL(url).pathname.startsWith(expectPath) || new URL(url).pathname.includes(expectPath.replace(/^\//, "")),
      path: new URL(url).pathname,
    };
    result.screenshots.push(await shot(page, `13-${role}-home`));
    // Capture billing surface read-only
    const billingPath = role === "business" ? "/business/billing" : "/billing";
    await page.goto(`${BASE}${billingPath}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1000);
    const text = await page.locator("body").innerText().catch(() => "");
    result.providers[`${role}Billing`] = {
      url: page.url(),
      summary: summarizeText(text),
      excerpt: redact(text).slice(0, 800),
    };
    result.screenshots.push(await shot(page, `14-${role}-billing`));
    await ctx.close();
  }

  // Isolation assessment (conservative)
  const auditDomains = {
    influencer: (process.env.AUDIT_INFLUENCER_EMAIL || "").split("@")[1] || null,
    business: (process.env.AUDIT_BUSINESS_EMAIL || "").split("@")[1] || null,
    admin: (process.env.AUDIT_ADMIN_EMAIL || "").split("@")[1] || null,
  };
  result.isolation = {
    dedicatedStagingHostname: !/influrios\.com$/i.test(new URL(BASE).hostname) || process.env.AUDIT_ISOLATION_CONFIRMED === "1",
    host: new URL(BASE).hostname,
    note: "influrios.com is not presumed isolated. Mutations require confirmed sandbox providers + mail sink.",
    auditAccountDomains: auditDomains,
    mailSinkConfigured: Boolean(process.env.MAIL_SINK_TO),
    isolationConfirmedEnvFlag: process.env.AUDIT_ISOLATION_CONFIRMED === "1",
  };

  if (!result.isolation.isolationConfirmedEnvFlag) {
    result.blockers.push({
      id: "BLK-ISOLATION",
      dependency: "Confirmed isolated staging DB/tenant (AUDIT_ISOLATION_CONFIRMED=1) or dedicated staging host",
      affected: ["All mutating journeys (J04–J20, withdrawals, deletions, invitations, sandbox checkout)"],
      action: "Operator confirms customer-data isolation and test-provider routing on this host, then set AUDIT_ISOLATION_CONFIRMED=1 for the audit agent — or provide a dedicated staging URL.",
      owner: "Operator / Ola",
    });
  }

  if (result.adminLoginExposure?.severity === "P0") {
    result.blockers.push({
      id: "BLK-ADMIN-CRED-EXPOSURE",
      dependency: "Remove default admin credential rendering from /admin/login",
      affected: ["Security baseline; admin auth regression"],
      action: "Hotfix: stop rendering concrete default credentials on the login page. Validate rejection via isolated auth unit/regression tests — do not attempt exposed password on live admin.",
      owner: "Engineering",
      severity: "P0",
    });
  }

  result.completedAt = new Date().toISOString();
  const outJson = path.join(DOCS, "preflight-raw.json");
  await fs.writeFile(outJson, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ok: true, outJson, blockers: result.blockers.map((b) => b.id), logins: result.logins }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(redact(e.stack || e.message || e));
  process.exit(1);
});
