/**
 * Phase M — remote staging evidence probe.
 * Hits a public APP URL and prints markdown-friendly rows for the runbook.
 * Does NOT call SMTP, Stripe Dashboard, or social OAuth (those need operator credentials).
 *
 * Usage:
 *   STAGING_URL=https://staging.example.com npx tsx scripts/staging-evidence-probe.ts
 *   npx tsx scripts/staging-evidence-probe.ts http://52.4.214.82
 */
type Check = {
  id: string;
  label: string;
  ok: boolean | null;
  detail: string;
  operatorOnly?: boolean;
};

function argUrl(): string {
  const fromArg = process.argv[2]?.trim();
  const fromEnv = (process.env.STAGING_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  const raw = fromArg || fromEnv || "http://127.0.0.1:3000";
  return raw.replace(/\/$/, "");
}

async function fetchText(url: string, init?: RequestInit): Promise<{ status: number; body: string; finalUrl: string }> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "influrios-staging-evidence-probe/1.0" },
    ...init,
  });
  const body = await res.text();
  return { status: res.status, body, finalUrl: res.url };
}

function includesAny(hay: string, needles: string[]) {
  const lower = hay.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

function isRawIpOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
  } catch {
    return false;
  }
}

async function main() {
  const app = argUrl();
  const checks: Check[] = [];
  const now = new Date().toISOString();

  console.log("Influrios Phase M staging evidence probe\n");
  console.log(`Target: ${app}`);
  console.log(`When:   ${now}\n`);

  const httpsOk = app.startsWith("https://");
  if (!httpsOk && isRawIpOrigin(app)) {
    checks.push({
      id: "https",
      label: "NEXT_PUBLIC_APP_URL / probe target uses HTTPS",
      ok: null,
      detail: "raw IP over http — install DNS + TLS before production; not an auto-fail",
      operatorOnly: true,
    });
  } else {
    checks.push({
      id: "https",
      label: "NEXT_PUBLIC_APP_URL / probe target uses HTTPS",
      ok: httpsOk,
      detail: httpsOk ? "https origin" : "http only — set HTTPS on staging before production cutover",
    });
  }
  // Health
  try {
    const health = await fetchText(`${app}/api/health`);
    type HealthJson = {
      ok?: boolean;
      status?: string;
      checks?: { db?: { ok?: boolean } };
      secrets?: { authConfigured?: boolean };
    };
    let parsed: HealthJson | null = null;
    try {
      parsed = JSON.parse(health.body) as HealthJson;
    } catch {
      parsed = null;
    }
    const ok = health.status === 200 && Boolean(parsed?.ok);
    const dbOk = parsed?.checks?.db?.ok;
    const authConfigured = parsed?.secrets?.authConfigured === true;
    checks.push({
      id: "health",
      label: "/api/health ok (web + db)",
      ok,
      detail: ok
        ? `status=${health.status}; db=${dbOk === false ? "fail" : "ok"}`
        : `status=${health.status}; body=${health.body.slice(0, 160)}`,
    });
    checks.push({
      id: "auth_secret",
      label: "Health secrets.authConfigured",
      ok: authConfigured,
      detail: authConfigured
        ? "AUTH_SECRET or ADMIN_SESSION_SECRET is set on the host"
        : "authConfigured is false. Set AUTH_SECRET on the host and redeploy. Phase M E0 is not met.",
    });
  } catch (error) {
    checks.push({
      id: "health",
      label: "/api/health ok (web + db)",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  // Homepage
  try {
    const home = await fetchText(`${app}/`);
    const okStatus = home.status === 200;
    const hasCategories = includesAny(home.body, ["Explore Influencer Categories", 'id="categories"']);
    const hasCollab = includesAny(home.body, ["Collaboration Matches"]);
    const categoryCarousel = includesAny(home.body, ["w-[148px]", "w-[160px]"]);
    const collabCarousel = includesAny(home.body, ["w-[280px]"]);
    checks.push({
      id: "homepage",
      label: "Homepage loads with categories + collab sections",
      ok: okStatus && hasCategories && hasCollab,
      detail: `status=${home.status}; categories=${hasCategories}; collab=${hasCollab}; categoryCarousel=${categoryCarousel}; collabCarousel=${collabCarousel}`,
    });
  } catch (error) {
    checks.push({
      id: "homepage",
      label: "Homepage loads with categories + collab sections",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  // Guest collaboration CTAs (regression for logged-in-looking guests)
  try {
    const collab = await fetchText(`${app}/collaboration`);
    const joinCta =
      includesAny(collab.body, ["Join to request matches"]) ||
      includesAny(collab.body, ["Request a Collaboration"]) ||
      includesAny(collab.body, ["Sign in to apply"]) ||
      includesAny(collab.body, ["Join as an Influencer"]);
    const legacyUpgrade =
      includesAny(collab.body, ["Upgrade from STARTER to request matches"]) ||
      /Upgrade from[\s\S]{0,40}STARTER[\s\S]{0,40}to request matches/i.test(collab.body);
    const legacyProposals = /\/collaboration\/records\?from=/.test(collab.body);
    // Guest OK when join/request CTA is present and legacy demo-viewer CTAs are absent.
    const guestOk = joinCta && !legacyUpgrade && !legacyProposals;
    checks.push({
      id: "collab_guest",
      label: "Guest /collaboration shows Join/Sign in (not plan-upgrade as demo creator)",
      ok: guestOk,
      detail: guestOk
        ? `join=${joinCta}`
        : `join=${joinCta}; legacyUpgrade=${legacyUpgrade}; legacyProposals=${legacyProposals} — pull latest main and rebuild web`,
    });
  } catch (error) {
    checks.push({
      id: "collab_guest",
      label: "Guest /collaboration shows Join/Sign in (not plan-upgrade as demo creator)",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  // Admin login surface reachable (does not authenticate)
  try {
    const admin = await fetchText(`${app}/admin/login`);
    checks.push({
      id: "admin_login",
      label: "Admin login page reachable",
      ok: admin.status === 200,
      detail: `status=${admin.status}`,
    });
  } catch (error) {
    checks.push({
      id: "admin_login",
      label: "Admin login page reachable",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  // Operator-only reminders (always null)
  for (const row of [
    ["smtp", "SMTP invite + verify + job retry"],
    ["stripe", "Stripe sandbox checkout → webhook → plan + duplicate skip"],
    ["social", "One social OAuth consent → callback + metric gate"],
    ["marketplace", "Marketplace hold → release + duplicate skip"],
    ["sms", "Twilio SMS verify template and message SID"],
    ["meili", "Meilisearch index count equals published creators"],
    ["recurring", "Recurring tranche 2 after the sweep tick"],
    ["team", "Two-creator proposal, both accepts, funding id"],
    ["esign", "DocuSign envelope completed once"],
    ["regional", "Flutterwave or M-Pesa charge paid only by webhook"],
    ["mentorship", "Paid mentorship Checkout id with no CollaborationFunding row"],
  ] as const) {
    checks.push({
      id: row[0],
      label: row[1],
      ok: null,
      detail: "operator-only — fill in docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md",
      operatorOnly: true,
    });
  }

  console.log("Webhook / callback URLs (register before §3–§6)");
  console.log(`  Stripe billing:     ${app}/api/billing/webhook`);
  console.log(`  Marketplace:        ${app}/api/marketplace/webhook`);
  console.log(`  Social OAuth:       ${app}/api/social/callback`);
  console.log(`  Signing:            ${app}/api/signing/webhook`);
  console.log(`  Sweep clock:        ${app}/api/cron/sweeps\n`);

  console.log("| Check | Result | Detail |");
  console.log("|-------|--------|--------|");
  for (const check of checks) {
    const result = check.ok === null ? "manual" : check.ok ? "pass" : "fail";
    console.log(`| ${check.label} | ${result} | ${check.detail.replace(/\|/g, "/")} |`);
  }

  const auto = checks.filter((c) => !c.operatorOnly);
  const failed = auto.filter((c) => c.ok === false);
  const passed = auto.filter((c) => c.ok === true);

  console.log(`\nAuto checks: ${passed.length} pass, ${failed.length} fail, ${auto.length} total.`);
  console.log("Operator checks still required for Phase M sign-off. A blank evidence cell is not done.");
  console.log("This script does not mark Phase M complete.\n");

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
