/**
 * J18+J20 completion: Influrios UI → monthly discount Apply → Stripe TEST pay →
 * success completeCheckout → redemption + invoice reconcile.
 * No hardcoded taxPercent checkout. No fabricated webhook (success page confirms via Stripe API).
 */
import { chromium, type Page, type BrowserContext } from "playwright";
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
  await page.screenshot({ path: file, fullPage: true, timeout: 45000 }).catch(async () => {
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
  const country = page.locator("label").filter({ hasText: /^Country/i }).locator("select");
  if (await country.count()) {
    await country.selectOption({ label: "United States" }).catch(() => country.selectOption("US"));
    await page.waitForTimeout(1500);
  }
  const state = page.locator("label").filter({ hasText: /^State/i }).locator("select");
  if (await state.count()) {
    const opts = await state.locator("option").allTextContents();
    const ca = opts.find((o) => /California/i.test(o));
    if (ca) await state.selectOption({ label: ca.trim() });
    else {
      const val = await state.locator("option").nth(1).getAttribute("value");
      if (val) await state.selectOption(val);
    }
  }
  await page.locator('input[placeholder="Street address"]').fill("1 Market St");
  await page.locator("label").filter({ hasText: /^City/i }).locator("input").fill("San Francisco");
  await page.locator("label").filter({ hasText: /^Postal code/i }).locator("input").fill("94105");
  await page.waitForTimeout(400);
}

async function fillStripeCard(page: Page, email: string) {
  await page.waitForTimeout(2500);
  await page.getByRole("radio", { name: /Card/i }).click({ force: true }).catch(() => {});
  await page.locator('#payment-method-accordion-item-title-card, [data-testid="card-accordion-item"]').click().catch(() => {});
  await page.getByText("Card", { exact: true }).click().catch(() => {});
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});

  await page.locator('input[type="email"], input[name="email"]').first().fill(email).catch(() => {});

  let filled = false;
  for (let attempt = 0; attempt < 8 && !filled; attempt++) {
    await page.waitForTimeout(800);
    for (const frame of page.frames()) {
      const num = frame.locator('input[name="number"], input[autocomplete="cc-number"], input[placeholder*="1234"]');
      if (await num.count()) {
        await num.first().click({ timeout: 5000 }).catch(() => {});
        await num.first().fill("").catch(() => {});
        await num.first().pressSequentially("4242424242424242", { delay: 35 }).catch(async () => {
          await num.first().fill("4242424242424242");
        });
        const exp = frame.locator('input[name="expiry"], input[autocomplete="cc-exp"], input[placeholder*="MM"]');
        if (await exp.count()) {
          await exp.first().click().catch(() => {});
          await exp.first().pressSequentially("1245", { delay: 35 }).catch(async () => {
            await exp.first().fill("12 / 45");
          });
        }
        const cvc = frame.locator('input[name="cvc"], input[autocomplete="cc-csc"], input[placeholder*="CVC"]');
        if (await cvc.count()) {
          await cvc.first().click().catch(() => {});
          await cvc.first().pressSequentially("123", { delay: 35 }).catch(async () => {
            await cvc.first().fill("123");
          });
        }
        const zip = frame.locator('input[name="postalCode"], input[autocomplete="postal-code"]');
        if (await zip.count()) await zip.first().fill("94105").catch(() => {});
        filled = true;
        break;
      }
    }
    if (!filled) {
      await page.locator('#payment-method-accordion-item-title-card').click().catch(() => {});
      await page.getByRole("radio", { name: /Card/i }).click({ force: true }).catch(() => {});
    }
  }

  await page
    .locator('input[name="billingName"], input[placeholder*="Full name" i], input[placeholder*="Name on card" i]')
    .first()
    .fill("AUDIT Unrelated")
    .catch(() => {});
  return filled;
}

async function main() {
  const email = fixtures.members.influencerUnrelated;
  const userId = fixtures.ids.influencerUnrelated;
  const freshCode = `AUDITPRO15M${randomBytes(2).toString("hex").toUpperCase()}`;
  const starts = "2020-01-01 00:00:00";
  const ends = "2035-01-01 00:00:00";
  db(
    `INSERT INTO "DiscountOffer" (id, "normalizedCode", "displayCode", version, "productCharge", "discountKind", "percentBps", "fixedCents", currency, "countryCode", "planCode", "planName", "billingInterval", "serviceLevel", "startsAt", "endsAt", "totalUses", "usesPerCustomer", lifecycle, "reservedCount", "redeemedCount", "refundedCount", "createdById", "createdAt", "updatedAt") VALUES ('audit_disc_${freshCode.toLowerCase()}', '${freshCode}', '${freshCode}', 1, 'subscription', 'percentage', 1500, NULL, 'USD', 'US', 'PRO', 'Influencer Pro', 'month', '', '${starts}'::timestamp, '${ends}'::timestamp, 100, 1, 'active', 0, 0, 0, 'audit', NOW(), NOW())`,
  );

  const report: Record<string, unknown> = {
    revision: "j18-j20-complete",
    recordedAt: new Date().toISOString(),
    freshCode,
    email,
    steps: [] as unknown[],
    failedAt: null as string | null,
  };
  const push = (id: string, result: string, detail: string, evidence: string[] = []) => {
    (report.steps as unknown[]).push({ id, result, detail, evidence });
  };

  // Prefer headed on DISPLAY=:1 for Card accordion
  const headed = Boolean(process.env.DISPLAY);
  const browser = await chromium.launch({
    headless: !headed,
    args: headed ? [] : undefined,
    channel: headed ? "chrome" : undefined,
  }).catch(() => chromium.launch({ headless: false }));

  const ctx: BrowserContext = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
  const page = await ctx.newPage();

  try {
    await memberLogin(page, email);
    push("login", "executed_successfully", page.url(), [await shot(page, "j18j20-login-done")]);

    await page.goto(`${BASE}/billing`, { waitUntil: "domcontentloaded" });
    const billingShot = await shot(page, "j18j20-billing-before");
    push("billing_quote_ui", "executed_successfully", "Opened billing", [billingShot]);

    await page.getByRole("button", { name: /Upgrade to Pro/i }).click();
    await page.waitForTimeout(1200);
    await fillUsAddress(page);
    await page.locator('input[aria-label="Discount code"]').fill(freshCode);
    await page.getByRole("button", { name: /^Apply$/i }).click();
    await page.waitForTimeout(2500);
    let taxBtn = page.getByRole("button", { name: /Continue to tax preview/i });
    if (await taxBtn.count()) {
      await taxBtn.click();
      await page.waitForTimeout(2500);
    }
    // Ensure address retained
    if (await page.locator('input[placeholder="Street address"]').count()) {
      const v = await page.locator('input[placeholder="Street address"]').inputValue();
      if (!v) {
        await fillUsAddress(page);
        taxBtn = page.getByRole("button", { name: /Continue to tax preview/i });
        if (await taxBtn.count()) {
          await taxBtn.click();
          await page.waitForTimeout(2500);
        }
      }
    }
    const previewShot = await shot(page, "j18j20-preview-applied");
    const previewBody = await page.locator("body").innerText();
    const discountApplied = new RegExp(freshCode).test(previewBody) && /−\$|Code /.test(previewBody) && !/already used/i.test(previewBody);
    if (!discountApplied) {
      report.failedAt = "apply_discount";
      push("apply_discount", "executed_with_reproducible_failure", previewBody.slice(0, 500), [previewShot]);
      writeFileSync(path.join(DOCS, "j18-j20-complete-results.json"), JSON.stringify(report, null, 2));
      await browser.close();
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    // Expected: Pro $29 - 15% = $24.65; tax 8.25% on discounted = round(2465*0.0825)=203; total 2668
    const expected = { base: 2900, discount: 435, discountedBase: 2465, tax: 203, total: 2668 };
    push("apply_discount", "executed_successfully", `Applied ${freshCode}; expected=${JSON.stringify(expected)}`, [previewShot]);

    const terms = page.locator('input[name="acceptSubscription"]');
    if (await terms.count()) await terms.check({ force: true });
    const payBtn = page.getByRole("button", { name: /Continue to payment/i });
    if (!(await payBtn.count())) {
      report.failedAt = "continue_to_payment";
      push("continue_to_payment", "executed_with_reproducible_failure", "Continue to payment missing", [await shot(page, "j18j20-no-pay")]);
      writeFileSync(path.join(DOCS, "j18-j20-complete-results.json"), JSON.stringify(report, null, 2));
      await browser.close();
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    await Promise.all([page.waitForNavigation({ timeout: 120000 }).catch(() => {}), payBtn.click()]);
    await page.waitForTimeout(4000);
    const stripeUrl = page.url();
    const hostedShot = await shot(page, "j18j20-stripe-hosted");
    if (!/checkout\.stripe\.com/.test(stripeUrl)) {
      report.failedAt = "open_stripe_checkout";
      push("open_stripe_checkout", "executed_with_reproducible_failure", stripeUrl, [hostedShot]);
      writeFileSync(path.join(DOCS, "j18-j20-complete-results.json"), JSON.stringify(report, null, 2));
      await browser.close();
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    const couponVisible = new RegExp(`${freshCode}|15%|-\$4\.35`).test(await page.locator("body").innerText());
    push("open_stripe_checkout", "executed_successfully", `url=${stripeUrl.slice(0, 100)}; couponVisible=${couponVisible}`, [hostedShot]);
    report.stripeUrl = stripeUrl;
    report.expected = expected;

    // Persist open state for computerUse fallback
    const csMatch = stripeUrl.match(/cs_test_[A-Za-z0-9]+/);
    report.stripeSessionId = csMatch?.[0] ?? null;
    writeFileSync(path.join(DOCS, "j18-j20-open-checkout.json"), JSON.stringify({ stripeUrl, stripeSessionId: report.stripeSessionId, freshCode, expected, email }, null, 2));

    const filled = await fillStripeCard(page, email);
    const filledShot = await shot(page, "j18j20-card-filled");
    push("fill_card", filled ? "executed_successfully" : "executed_with_reproducible_failure", `filled=${filled}`, [filledShot]);

    if (!filled) {
      report.failedAt = "fill_card";
      report.needsComputerUse = true;
      writeFileSync(path.join(DOCS, "j18-j20-complete-results.json"), JSON.stringify(report, null, 2));
      await browser.close();
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    await page.getByRole("button", { name: /Subscribe|Pay|Start trial/i }).first().click({ timeout: 15000 }).catch(async () => {
      await page.locator('[data-testid="hosted-payment-submit-button"]').click({ timeout: 8000 });
    });
    await page.waitForTimeout(15000);
    const afterPayShot = await shot(page, "j18j20-after-subscribe");
    const afterUrl = page.url();
    push("submit_payment", "executed_successfully", afterUrl.slice(0, 160), [afterPayShot]);

    // If still on Stripe unpaid, mark for computerUse
    const { stripeCredentials, readStripeCheckoutSession } = await import("../../src/lib/stripe-admin");
    const creds = await stripeCredentials();
    let sessionPaid = false;
    let sessionDetail: unknown = null;
    if (creds.ok && report.stripeSessionId) {
      const sess = await readStripeCheckoutSession(creds.secret, String(report.stripeSessionId));
      sessionPaid = sess?.paymentStatus === "paid";
      sessionDetail = sess;
      if (!sessionPaid) {
        // wait a bit more / poll
        for (let i = 0; i < 6 && !sessionPaid; i++) {
          await page.waitForTimeout(3000);
          const again = await readStripeCheckoutSession(creds.secret, String(report.stripeSessionId));
          sessionPaid = again?.paymentStatus === "paid";
          sessionDetail = again;
        }
      }
    }

    if (!sessionPaid) {
      report.failedAt = "stripe_payment";
      report.needsComputerUse = true;
      push(
        "stripe_payment",
        "executed_with_reproducible_failure",
        `paymentStatus not paid after headed fill; session=${JSON.stringify(sessionDetail)?.slice(0, 300)}`,
        [afterPayShot],
      );
      writeFileSync(path.join(DOCS, "j18-j20-complete-results.json"), JSON.stringify(report, null, 2));
      await browser.close();
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    push("stripe_payment", "executed_successfully", `paid; amount=${(sessionDetail as { amountTotal?: number })?.amountTotal}`, []);

    // Success page / completeCheckout — navigate if not already
    if (!/billing\/success/.test(afterUrl)) {
      // Find local checkout attempt
      const local = db(
        `SELECT id FROM "CheckoutAttempt" WHERE "userId"='${userId}' AND "stripeSessionId"='${report.stripeSessionId}' ORDER BY "createdAt" DESC LIMIT 1`,
      );
      if (local) {
        await page.goto(`${BASE}/billing/success?session_id=${report.stripeSessionId}&local=${local}`, {
          waitUntil: "domcontentloaded",
          timeout: 90000,
        });
        await page.waitForTimeout(2000);
      }
    }
    const successShot = await shot(page, "j18j20-success");
    const successBody = await page.locator("body").innerText();
    const successOk = /active|confirmed|Influencer Pro|plan is active/i.test(successBody) && !/Couldn.?t confirm/i.test(successBody);
    push("influrios_complete_checkout", successOk ? "executed_successfully" : "executed_with_reproducible_failure", successBody.slice(0, 400), [
      successShot,
    ]);
    if (!successOk) {
      report.failedAt = "influrios_complete_checkout";
      writeFileSync(path.join(DOCS, "j18-j20-complete-results.json"), JSON.stringify(report, null, 2));
      await browser.close();
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    // Verify subscription + redemption
    const sub = db(
      `SELECT status, sku, "billingInterval", "externalId" FROM "SubscriptionState" WHERE "userId"='${userId}' ORDER BY "updatedAt" DESC LIMIT 1`,
    );
    const offer = db(
      `SELECT "redeemedCount","reservedCount",lifecycle FROM "DiscountOffer" WHERE "displayCode"='${freshCode}' LIMIT 1`,
    );
    const reservation = db(
      `SELECT status, "amountCents", "baseCents", "settlementId", "providerOutcome", "consumedAt" IS NOT NULL FROM "DiscountReservation" WHERE "payerAccountId"='${userId}' AND "offerId"='audit_disc_${freshCode.toLowerCase()}' ORDER BY "createdAt" DESC LIMIT 1`,
    );
    const attempt = db(
      `SELECT id, status, "stripeSessionId" FROM "CheckoutAttempt" WHERE "userId"='${userId}' AND status='completed' ORDER BY "completedAt" DESC LIMIT 1`,
    );
    const redemptionOk = /\|1\|/.test(`|${offer}|`) || /^consumed\|/i.test(reservation) || /consumed/.test(reservation);
    // offer format redeemed|reserved|lifecycle — redeemed should be 1
    const redeemedCount = Number(offer.split("|")[0] || 0);
    const reservationConsumed = /consumed/i.test(reservation.split("|")[0] || "") || reservation.split("|").pop() === "t";
    push(
      "subscription_entitlement",
      /active\|creator_pro\|month/i.test(sub) ? "executed_successfully" : "executed_with_reproducible_failure",
      `sub=${sub}`,
      [],
    );
    push(
      "discount_redemption",
      redeemedCount >= 1 || reservationConsumed ? "executed_successfully" : "executed_with_reproducible_failure",
      `offer=${offer}; reservation=${reservation}; attempt=${attempt}`,
      [],
    );
    report.subscription = sub;
    report.discountOffer = offer;
    report.reservation = reservation;

    // Invoice reconcile via Stripe + open hosted invoice (customer-facing)
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(creds.secret);
    const full = await stripe.checkout.sessions.retrieve(String(report.stripeSessionId), {
      expand: ["invoice", "subscription", "total_details", "total_details.breakdown"],
    });
    const invId = typeof full.invoice === "string" ? full.invoice : full.invoice?.id;
    const invoice = invId ? await stripe.invoices.retrieve(invId) : null;
    const reconcile = {
      checkout: {
        amount_total: full.amount_total,
        amount_subtotal: full.amount_subtotal,
        amount_tax: full.total_details?.amount_tax ?? null,
        amount_discount: full.total_details?.amount_discount ?? null,
        payment_status: full.payment_status,
      },
      invoice: invoice
        ? {
            id: invoice.id,
            status: invoice.status,
            subtotal: invoice.subtotal,
            total: invoice.total,
            tax: invoice.tax,
            discount: (invoice as { total_discount_amounts?: { amount: number }[] }).total_discount_amounts?.[0]?.amount ?? null,
            hosted: invoice.hosted_invoice_url,
            pdf: invoice.invoice_pdf,
          }
        : null,
      expected,
      matches: {
        total: full.amount_total === expected.total || invoice?.total === expected.total,
        tax: full.total_details?.amount_tax === expected.tax || invoice?.tax === expected.tax,
        discount:
          full.total_details?.amount_discount === expected.discount ||
          (invoice as { total_discount_amounts?: { amount: number }[] } | null)?.total_discount_amounts?.[0]?.amount === expected.discount,
      },
    };
    report.reconcile = reconcile;
    let invoiceShot = "";
    if (invoice?.hosted_invoice_url) {
      await page.goto(invoice.hosted_invoice_url, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(2000);
      invoiceShot = await shot(page, "j18j20-hosted-invoice");
    }
    // Customer billing history
    await page.goto(`${BASE}/billing`, { waitUntil: "domcontentloaded" });
    const historyShot = await shot(page, "j18j20-billing-history");
    const historyBody = await page.locator("body").innerText();
    const historyOk = /Pro|completed|Billing history/i.test(historyBody) && !/No completed checkout/i.test(historyBody);

    push(
      "invoice_pdf_customer",
      invoice?.hosted_invoice_url && invoice.invoice_pdf ? "executed_successfully" : "executed_with_reproducible_failure",
      `hosted=${Boolean(invoice?.hosted_invoice_url)}; pdf=${Boolean(invoice?.invoice_pdf)}; reconcile=${JSON.stringify(reconcile.matches)}`,
      [invoiceShot, historyShot].filter(Boolean),
    );
    push(
      "billing_history_ui",
      historyOk ? "executed_successfully" : "executed_with_reproducible_failure",
      historyBody.slice(0, 300),
      [historyShot],
    );

    const allCritical = (report.steps as { id: string; result: string }[]).filter((s) =>
      [
        "apply_discount",
        "open_stripe_checkout",
        "stripe_payment",
        "influrios_complete_checkout",
        "subscription_entitlement",
        "discount_redemption",
        "invoice_pdf_customer",
      ].includes(s.id),
    );
    report.acceptance =
      allCritical.every((s) => s.result === "executed_successfully") &&
      reconcile.matches.total &&
      (reconcile.matches.tax || reconcile.matches.discount)
        ? "Pass"
        : "Fail";
    report.coverage = "Complete";
  } catch (e) {
    report.failedAt = "exception";
    push("exception", "executed_with_reproducible_failure", String(e).slice(0, 500), []);
  }

  await browser.close();
  writeFileSync(path.join(DOCS, "j18-j20-complete-results.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
