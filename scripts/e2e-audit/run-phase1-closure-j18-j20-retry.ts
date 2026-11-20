/**
 * Bounded retry: J18 Apply→Stripe + J20 Influrios UI→Stripe with required US State.
 * Fresh month discount code (prior AUDITPRO15M reserved). No product remediation.
 */
import { chromium, type Page } from "playwright";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvLocal();
process.env.COLLABORATION_SANDBOX_LEDGER_HOLD = "1";

const BASE = "http://127.0.0.1:3000";
const DOCS = "/cursor/stores/self/docs/e2e-audit";
const MEDIA = "/cursor/stores/self/media/e2e-audit/local-journeys";
const PASSWORD = process.env.AUDIT_LOCAL_PASSWORD || "AuditLocalPass!2026";
const fixtures = JSON.parse(readFileSync(path.join(DOCS, "local-fixtures.json"), "utf8"));
mkdirSync(MEDIA, { recursive: true });

function db(sql: string) {
  return execSync(
    `PGPASSWORD=audit_local_only psql -h 127.0.0.1 -U influrios_audit -d influrios_audit -v ON_ERROR_STOP=1 -At -F '|' -c ${JSON.stringify(sql)}`,
    { encoding: "utf8" },
  ).trim();
}

async function shot(page: Page, name: string) {
  const file = path.join(MEDIA, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true, timeout: 30000 }).catch(async () => {
    await page.screenshot({ path: file, fullPage: false });
  });
  return `local-journeys/${name}.png`;
}

async function memberLogin(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(800);
}

async function fillUsAddress(page: Page) {
  // Country already US typically; ensure State loads
  const country = page.locator("label").filter({ hasText: /^Country/i }).locator("select");
  if (await country.count()) {
    await country.selectOption({ label: "United States" }).catch(() => country.selectOption("US"));
    await page.waitForTimeout(1200);
  }
  const state = page.locator("label").filter({ hasText: /^State/i }).locator("select");
  if (await state.count()) {
    // Prefer California by label; fallback first non-empty
    const opts = await state.locator("option").allTextContents();
    const ca = opts.find((o) => /California/i.test(o));
    if (ca) await state.selectOption({ label: ca.trim() });
    else {
      const val = await state.locator("option").nth(1).getAttribute("value");
      if (val) await state.selectOption(val);
    }
    await page.waitForTimeout(400);
  }
  await page.locator('input[placeholder="Street address"]').fill("1 Market St");
  await page.locator("label").filter({ hasText: /^City/i }).locator("input").fill("San Francisco");
  await page.locator("label").filter({ hasText: /^Postal code/i }).locator("input").fill("94105");
  await page.waitForTimeout(300);
}

async function main() {
  const freshCode = `AUDITPRO15M${randomBytes(2).toString("hex").toUpperCase()}`;
  const starts = "2020-01-01 00:00:00";
  const ends = "2035-01-01 00:00:00";
  db(
    `INSERT INTO "DiscountOffer" (id, "normalizedCode", "displayCode", version, "productCharge", "discountKind", "percentBps", "fixedCents", currency, "countryCode", "planCode", "planName", "billingInterval", "serviceLevel", "startsAt", "endsAt", "totalUses", "usesPerCustomer", lifecycle, "reservedCount", "redeemedCount", "refundedCount", "createdById", "createdAt", "updatedAt") VALUES ('audit_disc_${freshCode.toLowerCase()}', '${freshCode}', '${freshCode}', 1, 'subscription', 'percentage', 1500, NULL, 'USD', 'US', 'PRO', 'Influencer Pro', 'month', '', '${starts}'::timestamp, '${ends}'::timestamp, 100, 1, 'active', 0, 0, 0, 'audit', NOW(), NOW())`,
  );

  const browser = await chromium.launch({ headless: true });
  const out: Record<string, unknown> = { freshCode, recordedAt: new Date().toISOString(), J18: {}, J20: {} };

  // ---- J18 Apply → Stripe ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
    const page = await ctx.newPage();
    await memberLogin(page, fixtures.members.influencerUnrelated);
    await page.goto(`${BASE}/billing`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Upgrade to Pro/i }).click();
    await page.waitForTimeout(1000);
    await fillUsAddress(page);
    await page.locator('input[aria-label="Discount code"]').fill(freshCode);
    await page.getByRole("button", { name: /^Apply$/i }).click();
    await page.waitForTimeout(2500);
    const applyShot = await shot(page, "j18c2-apply-month");
    const body = await page.locator("body").innerText();
    const applied = new RegExp(freshCode).test(body) && /−\$|Code /.test(body) && !/already used/i.test(body);
    // If Apply only ran preview without address, click tax preview then payment
    let taxBtn = page.getByRole("button", { name: /Continue to tax preview/i });
    if (await taxBtn.count()) {
      await taxBtn.click();
      await page.waitForTimeout(2500);
    }
    // Address may need re-fill if dialog remounted — ensure again before payment
    if (await page.locator('input[placeholder="Street address"]').count()) {
      const v = await page.locator('input[placeholder="Street address"]').inputValue();
      if (!v) await fillUsAddress(page);
      taxBtn = page.getByRole("button", { name: /Continue to tax preview/i });
      if (await taxBtn.count()) {
        await taxBtn.click();
        await page.waitForTimeout(2500);
      }
    }
    const previewShot = await shot(page, "j18c2-preview");
    const terms = page.locator('input[name="acceptSubscription"]');
    if (await terms.count()) await terms.check({ force: true }).catch(() => {});
    const payBtn = page.getByRole("button", { name: /Continue to payment/i });
    let stripeUrl = "";
    let stripeShot = "";
    let couponVisible = false;
    if (await payBtn.count()) {
      await Promise.all([page.waitForNavigation({ timeout: 120000 }).catch(() => {}), payBtn.click()]);
      await page.waitForTimeout(5000);
      stripeUrl = page.url();
      stripeShot = await shot(page, "j18c2-stripe-with-coupon");
      couponVisible = new RegExp(`${freshCode}|15%|-\$`).test(await page.locator("body").innerText());
    } else {
      stripeShot = await shot(page, "j18c2-no-pay-btn");
    }
    out.J18 = {
      freshCode,
      applyUi: applied ? "executed_successfully" : "executed_with_reproducible_failure",
      applyEvidence: [applyShot, previewShot],
      applyDetail: body.slice(0, 400),
      stripeUrl: stripeUrl.slice(0, 160),
      stripeResult: /checkout\.stripe\.com/.test(stripeUrl)
        ? "executed_successfully"
        : payBtn && (await payBtn.count()) === 0
          ? "executed_with_reproducible_failure"
          : "executed_with_reproducible_failure",
      couponVisible,
      stripeEvidence: [stripeShot],
      note: "Hosted coupon ≠ completed redemption. Prior j18p1-us-checkout.png retained as Apply-to-Stripe Pass.",
      annual: "not re-attempted beyond prior COR-03/COR-04 Fail",
      redemption: "not_executed",
    };
    await ctx.close();
  }

  // ---- J20 Influrios UI → Stripe (no hardcoded tax API) ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    const loginShot = await shot(page, "j20c2-login");
    await memberLogin(page, fixtures.members.influencerUnrelated);
    await shot(page, "j20c2-post-login");
    await page.goto(`${BASE}/billing`, { waitUntil: "domcontentloaded" });
    await shot(page, "j20c2-billing-quote");
    await page.getByRole("button", { name: /Upgrade to Plus/i }).click();
    await page.waitForTimeout(1000);
    await fillUsAddress(page);
    let taxBtn = page.getByRole("button", { name: /Continue to tax preview/i });
    if (await taxBtn.count()) {
      await taxBtn.click();
      await page.waitForTimeout(2500);
    }
    // If still tax preview needed after address
    taxBtn = page.getByRole("button", { name: /Continue to tax preview/i });
    if (await taxBtn.count()) {
      await fillUsAddress(page);
      await taxBtn.click();
      await page.waitForTimeout(2500);
    }
    const previewShot = await shot(page, "j20c2-tax-preview");
    const previewBody = await page.locator("body").innerText();
    const terms = page.locator('input[name="acceptSubscription"]');
    if (await terms.count()) await terms.check({ force: true }).catch(() => {});
    const payBtn = page.getByRole("button", { name: /Continue to payment/i });
    let stripeUrl = "";
    let hostedShot = "";
    if (await payBtn.count()) {
      await Promise.all([page.waitForNavigation({ timeout: 120000 }).catch(() => {}), payBtn.click()]);
      await page.waitForTimeout(5000);
      stripeUrl = page.url();
      hostedShot = await shot(page, "j20c2-hosted-from-ui");
    } else {
      hostedShot = await shot(page, "j20c2-no-pay");
    }
    out.J20 = {
      loginEvidence: [loginShot],
      taxPreview: /Tax|Amount due|8\.25/i.test(previewBody) ? "executed_successfully" : "executed_with_reproducible_failure",
      previewEvidence: [previewShot],
      stripeUrl: stripeUrl.slice(0, 160),
      influriosToStripe: /checkout\.stripe\.com/.test(stripeUrl) ? "executed_successfully" : "executed_with_reproducible_failure",
      hostedEvidence: [hostedShot],
      paymentComplete: "blocked_by_named_dependency (PL-03 headless Card accordion; computerUse not in this bounded pass)",
      invoiceFromUiPayment: "not_executed",
      acceptance: "Partial",
      demotion: "Prior API startCheckout(taxPercent) Pass demoted — insufficient for Influrios UI quote→payment→invoice",
    };
    await ctx.close();
  }

  await browser.close();
  writeFileSync(path.join(DOCS, "phase1-bounded-closure-j18-j20-retry.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
