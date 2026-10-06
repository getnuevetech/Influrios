import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { describe, it } from "node:test";
import { createFlutterwaveCharge, parseFlutterwaveWebhook, verifyFlutterwaveSignature } from "./flutterwave";
import { parseMpesaWebhook, verifyMpesaSignature } from "./mpesa";
import { readRegionalWebhook } from "./regional-charge";
import { prisma } from "../db";

const hasDbUrl = Boolean(process.env.DATABASE_URL);

describe("Flutterwave and M-Pesa charges", () => {
  const flutterwaveBody = JSON.stringify({
    data: { id: 99, tx_ref: "attempt_1", status: "successful", amount: 10 },
  });

  it("marks a fixture webhook paid only when the signature matches", () => {
    assert.equal(verifyFlutterwaveSignature("whsec", "whsec"), true);
    const verified = readRegionalWebhook("flutterwave", flutterwaveBody, "whsec", "whsec");
    assert.equal(verified.ok, true);
    if (verified.ok) {
      assert.equal(verified.charge.paid, true);
      assert.equal(verified.charge.txRef, "attempt_1");
      assert.equal(verified.charge.amountCents, 1000);
    }
    const missing = readRegionalWebhook("flutterwave", flutterwaveBody, null, "whsec");
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.status, 401);
    const parsed = parseFlutterwaveWebhook(JSON.stringify({ data: { id: 1, tx_ref: "x", status: "failed", amount: 5 } }));
    assert.equal(parsed.ok && parsed.charge.paid, false);
  });

  it("verifies an M-Pesa callback and rejects a missing signature", () => {
    const body = JSON.stringify({
      Body: { stkCallback: { CheckoutRequestID: "ws_CO_1", MerchantRequestID: "m1", ResultCode: 0, tx_ref: "fund_1" } },
    });
    const secret = "mpesa-secret";
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    const verified = readRegionalWebhook("mpesa", body, signature, secret);
    assert.equal(verified.ok, true);
    if (verified.ok) {
      assert.equal(verified.charge.paid, true);
      assert.equal(verified.charge.txRef, "fund_1");
    }
    const missing = readRegionalWebhook("mpesa", body, null, secret);
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.status, 401);
    assert.equal(verifyMpesaSignature(body, "nope", secret), false);
    const unpaid = parseMpesaWebhook(
      JSON.stringify({ Body: { stkCallback: { CheckoutRequestID: "ws_CO_2", ResultCode: 1032 } } }),
    );
    assert.equal(unpaid.ok && unpaid.charge.paid, false);
  });

  it("returns a charge link and does not report the charge paid", async () => {
    const result = await createFlutterwaveCharge({
      secret: "flw",
      txRef: "attempt_1",
      amountCents: 1000,
      currency: "NGN",
      email: "payer@example.com",
      redirectUrl: "https://example.com/back",
      fetchImpl: async () => new Response(JSON.stringify({ status: "success", data: { link: "https://checkout.flutterwave.com/pay/abc", id: 7 } }), { status: 200 }),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.link.startsWith("https://"), true);
      assert.equal("paid" in result, false);
    }
  });

  it("applies a signed checkout webhook and ignores a charge without a signature", async (t) => {
    if (!hasDbUrl) {
      t.skip("DATABASE_URL not set");
      return;
    }
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      t.skip("Postgres not reachable");
      return;
    }
    const txRef = `flw_${Date.now().toString(36)}`;
    await prisma.checkoutAttempt.create({
      data: { id: txRef, sku: "creator_plus", mode: "flutterwave", status: "open" },
    });
    const charge = parseFlutterwaveWebhook(
      JSON.stringify({ data: { id: txRef, tx_ref: txRef, status: "successful", amount: 19 } }),
    );
    assert.equal(charge.ok, true);
    if (!charge.ok) return;
    const { applyRegionalCharge } = await import("./regional-charge");
    try {
      const missing = readRegionalWebhook("flutterwave", "{}", null, "secret");
      assert.equal(missing.ok, false);
      const applied = await applyRegionalCharge(charge.charge);
      assert.equal(applied.ok, true);
      if (applied.ok && "paid" in applied) assert.equal(applied.paid, true);
      const attempt = await prisma.checkoutAttempt.findUnique({ where: { id: txRef } });
      assert.equal(attempt?.status, "completed");
      const funding = await prisma.collaborationFunding.findUnique({ where: { id: txRef } });
      assert.equal(funding, null);
    } finally {
      await prisma.processedWebhook.deleteMany({ where: { eventId: charge.charge.eventId } }).catch(() => undefined);
      await prisma.subscriptionState.deleteMany({ where: { externalId: txRef } }).catch(() => undefined);
      await prisma.checkoutAttempt.deleteMany({ where: { id: txRef } }).catch(() => undefined);
    }
  });
});
