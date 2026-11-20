/**
 * Complete an open FundingDeposit gateway Checkout with Playwright + Stripe test card.
 */
import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const eq = t.indexOf("=");
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvLocal();
process.env.COLLABORATION_SANDBOX_LEDGER_HOLD = "1";

const MEDIA = "/cursor/stores/self/media/e2e-audit/local-journeys";

function db(sql: string) {
  return execSync(
    `PGPASSWORD=audit_local_only psql -h 127.0.0.1 -U influrios_audit -d influrios_audit -At -F '|' -c ${JSON.stringify(sql)}`,
    { encoding: "utf8" },
  ).trim();
}

async function main() {
  const row = db(
    `SELECT id, "fundingId", reference FROM "FundingDeposit" WHERE status='gateway_opened' AND reference LIKE 'cs_test_%' ORDER BY "createdAt" DESC LIMIT 1`,
  );
  const [depositId, fundingId, ref] = row.split("|");
  if (!ref?.startsWith("cs_test_")) throw new Error(`no open deposit: ${row}`);

  const { stripeCredentials, readStripeCheckoutSession } = await import("../../src/lib/stripe-admin");
  const creds = await stripeCredentials();
  if (!creds.ok) throw new Error("no stripe creds");
  const session = await readStripeCheckoutSession(creds.secret, ref);
  if (!session?.url) throw new Error("no session url");
  console.log(JSON.stringify({ depositId, fundingId, ref, before: session.paymentStatus }));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  await page.goto(session.url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${MEDIA}/j13r34-pay-attempt-1.png`, fullPage: true });

  for (const frame of page.frames()) {
    const inputs = await frame
      .locator("input")
      .evaluateAll((els) =>
        els.map((e) => ({
          name: e.getAttribute("name"),
          autocomplete: e.getAttribute("autocomplete"),
          placeholder: e.getAttribute("placeholder"),
          type: e.getAttribute("type"),
          id: (e as HTMLInputElement).id,
        })),
      )
      .catch(() => []);
    if (inputs.length) console.log("inputs", frame.url().slice(0, 70), inputs);
  }

  // Select Card and expand fields (Stripe accordion)
  await page.getByRole("radio", { name: /Card/i }).click({ force: true }).catch(() => {});
  await page.locator('#payment-method-accordion-item-title-card, [data-testid="card-accordion-item"]').click().catch(() => {});
  await page.locator("text=Card").nth(1).click().catch(() => {});
  await page.waitForTimeout(2500);
  // Scroll payment form into view
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await page.screenshot({ path: `${MEDIA}/j13r34-pay-attempt-2.png`, fullPage: true });

  await page.locator('input[type="email"], input[name="email"]').first().fill("audit.r3mrvlgh.business-a@example.com").catch(() => {});

  let filled = false;
  for (let attempt = 0; attempt < 5 && !filled; attempt++) {
    await page.waitForTimeout(1000);
    for (const frame of page.frames()) {
      const num = frame.locator('input[name="number"], input[autocomplete="cc-number"], input[placeholder*="1234"]');
      if (await num.count()) {
        await num.first().click({ timeout: 5000 });
        await num.first().fill("");
        await num.first().pressSequentially("4242424242424242", { delay: 30 });
        const exp = frame.locator('input[name="expiry"], input[autocomplete="cc-exp"], input[placeholder*="MM"]');
        if (await exp.count()) {
          await exp.first().click();
          await exp.first().pressSequentially("1245", { delay: 30 });
        }
        const cvc = frame.locator('input[name="cvc"], input[autocomplete="cc-csc"], input[placeholder*="CVC"]');
        if (await cvc.count()) {
          await cvc.first().click();
          await cvc.first().pressSequentially("123", { delay: 30 });
        }
        const zip = frame.locator('input[name="postalCode"], input[autocomplete="postal-code"]');
        if (await zip.count()) await zip.first().fill("94107");
        filled = true;
        console.log("filled card in frame", frame.url().slice(0, 80));
        break;
      }
    }
    if (!filled) {
      await page.getByText("Card", { exact: true }).click().catch(() => {});
    }
  }

  await page.locator('input[name="billingName"], input[placeholder*="Full name" i], input[placeholder*="Name on card" i]').first().fill("Audit Business").catch(() => {});
  await page.screenshot({ path: `${MEDIA}/j13r34-pay-attempt-filled.png`, fullPage: true });

  // Prefer exact Pay button (not Apple Pay / Link)
  const payBtn = page.getByRole("button", { name: /^Pay$/i }).or(page.locator('button:has-text("Pay"):not(:has-text("Apple"))'));
  await payBtn.first().click({ timeout: 10000 }).catch(async () => {
    await page.locator('[data-testid="hosted-payment-submit-button"]').click({ timeout: 5000 });
  });
  await page.waitForTimeout(12000);
  await page.screenshot({ path: `${MEDIA}/j13r34-pay-attempt-3.png`, fullPage: true });

  const after = await readStripeCheckoutSession(creds.secret, ref);
  console.log(JSON.stringify({ filled, after: after?.paymentStatus, pageUrl: page.url().slice(0, 120) }));

  if (after?.paymentStatus === "paid") {
    const { confirmGatewayDeposit } = await import("../../src/lib/funding-checkout");
    const conf = await confirmGatewayDeposit({
      depositId,
      fundingId,
      checkoutSessionId: ref,
      paymentStatus: "paid",
      amountCents: 5000,
      currency: "usd",
    });
    const status = db(`SELECT status FROM "CollaborationFunding" WHERE id='${fundingId}'`);
    console.log(JSON.stringify({ confirm: conf, fundingStatus: status }));
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
