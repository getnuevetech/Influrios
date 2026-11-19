/**
 * Complete an open J16 Stripe Checkout with test card 4242… and post signed webhook.
 * No live money. Synthetic influencer only.
 */
import { chromium } from "playwright";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvLocal();

const BASE = "http://127.0.0.1:3000";
const DOCS = "/cursor/stores/self/docs/e2e-audit";
const MEDIA = "/cursor/stores/self/media/e2e-audit/local-journeys";
const fixtures = JSON.parse(readFileSync(path.join(DOCS, "local-fixtures.json"), "utf8"));
const PASSWORD = process.env.AUDIT_LOCAL_PASSWORD || "AuditLocalPass!2026";

function db(sql: string) {
  return execSync(
    `PGPASSWORD=audit_local_only psql -h 127.0.0.1 -U influrios_audit -d influrios_audit -v ON_ERROR_STOP=1 -At -c ${JSON.stringify(sql)}`,
    { encoding: "utf8" },
  ).trim();
}

async function main() {
  const { startCheckout } = await import("../../src/lib/billing");
  const { stripeCredentials, readStripeCheckoutSession } = await import("../../src/lib/stripe-admin");
  const Stripe = (await import("stripe")).default;

  const creatorSlug = db(
    `SELECT slug FROM "Creator" c JOIN "User" u ON u.id=c."userId" WHERE u.email='${fixtures.members.influencerA}'`,
  );
  const started = await startCheckout({
    sku: "creator_plus",
    customerEmail: fixtures.members.influencerA,
    creatorSlug,
    userId: fixtures.ids.influencerA,
    interval: "month",
  });
  if (!started.ok) {
    console.log(JSON.stringify({ ok: false, started }));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
  const page = await ctx.newPage();

  // optional: login not required for hosted checkout URL
  await page.goto(started.url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${MEDIA}/j16b-checkout-open.png`, fullPage: true });

  // Select Card payment method
  const cardRadio = page.getByRole("radio", { name: /^Card$/i }).or(page.locator('input[value="card"]')).first();
  if (await cardRadio.count()) {
    await cardRadio.click({ force: true }).catch(() => {});
  } else {
    await page.getByText(/^Card$/).first().click().catch(() => {});
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${MEDIA}/j16b-card-selected.png`, fullPage: true });

  // Fill card fields — may be in iframes
  async function fillCard() {
    const candidates = [
      page.locator('input[name="cardNumber"]'),
      page.locator('input[placeholder*="1234"]'),
      page.frameLocator('iframe[name*="cardNumber"], iframe[title*="card number" i]').locator("input"),
    ];
    for (const loc of candidates) {
      if (await loc.count()) {
        await loc.first().fill("4242424242424242");
        break;
      }
    }
    // Scan all frames
    for (const frame of page.frames()) {
      const num = frame.locator('input[name="number"], input[autocomplete="cc-number"], input[placeholder*="1234"]');
      if (await num.count()) {
        await num.first().click();
        await num.first().fill("4242424242424242");
        const exp = frame.locator('input[name="expiry"], input[autocomplete="cc-exp"], input[placeholder*="MM"]');
        if (await exp.count()) await exp.first().fill("12 / 45");
        const cvc = frame.locator('input[name="cvc"], input[autocomplete="cc-csc"], input[placeholder*="CVC"]');
        if (await cvc.count()) await cvc.first().fill("123");
        const zip = frame.locator('input[name="postalCode"], input[autocomplete="postal-code"]');
        if (await zip.count()) await zip.first().fill("94107");
        return true;
      }
    }
    // Host page fields
    const hostNum = page.locator('input[name="cardNumber"], input[autocomplete="cc-number"]');
    if (await hostNum.count()) {
      await hostNum.first().fill("4242424242424242");
      await page.locator('input[name="cardExpiry"], input[autocomplete="cc-exp"]').first().fill("12 / 45").catch(() => {});
      await page.locator('input[name="cardCvc"], input[autocomplete="cc-csc"]').first().fill("123").catch(() => {});
      await page.locator('input[name="billingPostalCode"], input[autocomplete="postal-code"]').first().fill("94107").catch(() => {});
      return true;
    }
    return false;
  }

  const filled = await fillCard();
  await page.screenshot({ path: `${MEDIA}/j16b-card-filled.png`, fullPage: true });

  // Name / billing if required
  await page.locator('input[name="billingName"], input[placeholder*="Full name"]').first().fill("AUDIT Influencer A").catch(() => {});

  await page.getByRole("button", { name: /subscribe|pay|start trial/i }).first().click({ timeout: 15000 });
  await page.waitForTimeout(10000);
  await page.screenshot({ path: `${MEDIA}/j16b-after-subscribe.png`, fullPage: true });

  const stripeSessionId = db(
    `SELECT "stripeSessionId" FROM "CheckoutAttempt" WHERE id='${started.sessionId}' LIMIT 1`,
  );
  const creds = await stripeCredentials();
  if (!creds.ok) throw new Error("stripe credentials missing");
  let session = stripeSessionId ? await readStripeCheckoutSession(creds.secret, stripeSessionId) : null;

  // If still unpaid, try confirming PaymentIntent via API (test card token path)
  if (session && session.paymentStatus !== "paid" && stripeSessionId) {
    const raw = await fetch(`https://api.stripe.com/v1/checkout/sessions/${stripeSessionId}?expand[]=payment_intent`, {
      headers: { Authorization: `Bearer ${creds.secret}` },
    }).then((r) => r.json());
    const pi =
      typeof raw.payment_intent === "string"
        ? raw.payment_intent
        : raw.payment_intent?.id || raw.subscription
          ? null
          : null;
    // For subscription mode, retrieve incomplete subscription invoice payment_intent
    let paymentIntentId = pi;
    if (!paymentIntentId && raw.subscription) {
      const subId = typeof raw.subscription === "string" ? raw.subscription : raw.subscription.id;
      const sub = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}?expand[]=latest_invoice.payment_intent`, {
        headers: { Authorization: `Bearer ${creds.secret}` },
      }).then((r) => r.json());
      const inv = sub.latest_invoice;
      paymentIntentId =
        typeof inv?.payment_intent === "string" ? inv.payment_intent : inv?.payment_intent?.id || null;
    }
    if (paymentIntentId) {
      const confirmBody = new URLSearchParams();
      confirmBody.set("payment_method", "pm_card_visa");
      confirmBody.set("return_url", `${BASE}/billing/success`);
      const confirmed = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.secret}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: confirmBody,
      }).then((r) => r.json());
      console.log(
        JSON.stringify({
          confirmAttempt: true,
          piPrefix: String(paymentIntentId).slice(0, 10),
          status: confirmed.status,
          error: confirmed.error?.message || null,
        }),
      );
      session = await readStripeCheckoutSession(creds.secret, stripeSessionId);
    }
  }

  let webhook: { status: number; body: string } | null = null;
  if (session?.paymentStatus === "paid" && stripeSessionId) {
    const payloadObj = {
      id: `evt_audit_j16_${Date.now().toString(36)}`,
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: stripeSessionId,
          object: "checkout.session",
          payment_status: "paid",
          amount_total: session.amountTotal,
          currency: (session.currency || "usd").toLowerCase(),
          livemode: false,
          mode: "subscription",
          metadata: {
            localSessionId: started.sessionId,
            sku: "creator_plus",
            userId: fixtures.ids.influencerA,
            creatorSlug,
            billingInterval: "month",
          },
        },
      },
    };
    const payload = JSON.stringify(payloadObj);
    const header = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    });
    const res = await fetch(`${BASE}/api/billing/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": header },
      body: payload,
    });
    webhook = { status: res.status, body: (await res.text()).slice(0, 400) };
  }

  // DB evidence
  const attempt = db(
    `SELECT id, status, sku, "stripeSessionId" FROM "CheckoutAttempt" WHERE id='${started.sessionId}'`,
  );
  const subState = db(
    `SELECT count(*)::text FROM "SubscriptionState" WHERE "userId"='${fixtures.ids.influencerA}' OR "creatorSlug"='${creatorSlug}'`,
  );
  const processed = webhook
    ? db(`SELECT count(*)::text FROM "ProcessedWebhook" WHERE provider LIKE 'stripe%' ORDER BY "createdAt" DESC`)
    : "0";

  const out = {
    ok: session?.paymentStatus === "paid",
    filled,
    localSessionId: started.sessionId,
    stripeSessionIdPrefix: stripeSessionId?.slice(0, 12),
    paymentStatus: session?.paymentStatus ?? null,
    webhook,
    attempt,
    subscriptionRows: subState,
    processedWebhookCount: processed,
    finalUrl: page.url(),
  };
  writeFileSync(`${DOCS}/j16-stripe-pay-evidence.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  process.exit(out.ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
