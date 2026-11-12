import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { prisma } from "./db";
import {
  depositMethodKind,
  manualDepositFundsAgreement,
  manualMethodReady,
  parseDepositMethod,
  readManualDepositInstructions,
  saveManualDepositInstructions,
  startFundingDeposit,
  confirmManualDeposit,
  confirmGatewayDeposit,
  fundingDepositEventDecision,
  gatewaySessionConfirmsDeposit,
} from "./funding-checkout";
import { stripeCheckoutPayment, stripeFundingCheckoutBody } from "./stripe-admin";

describe("funding deposit rules", () => {
  it("keeps manual deposits unfunded until finance confirms them", () => {
    assert.equal(parseDepositMethod("card"), "card");
    assert.equal(parseDepositMethod("wire"), null);
    assert.equal(depositMethodKind("card"), "gateway");
    assert.equal(depositMethodKind("ach_online"), "gateway");
    assert.equal(depositMethodKind("ach_wire"), "manual");
    assert.equal(depositMethodKind("check"), "manual");
    assert.equal(manualDepositFundsAgreement("manual_pending"), false);
    assert.equal(manualDepositFundsAgreement("gateway_opened"), false);
    assert.equal(manualDepositFundsAgreement("confirmed"), true);
    const blank = readManualDepositInstructions({});
    assert.equal(manualMethodReady("ach_wire", blank).ok, false);
    assert.equal(manualMethodReady("check", blank).ok, false);
    const ready = manualMethodReady("ach_wire", {
      ...blank,
      bankName: "First Bank",
      accountName: "Influrios",
      routingNumber: "021000021",
      accountNumber: "123456789",
    });
    assert.equal(ready.ok, true);
    const card = stripeFundingCheckoutBody({
      amountCents: 483000,
      currency: "USD",
      name: "Campaign",
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/cancel",
      paymentMethod: "card",
      metadata: { purpose: "funding_deposit", depositId: "dep_1" },
    });
    assert.equal(card.get("payment_method_types[0]"), "card");
    assert.equal(card.get("mode"), "payment");
    assert.equal(card.get("line_items[0][price_data][unit_amount]"), "483000");
    const ach = stripeFundingCheckoutBody({
      amountCents: 483000,
      currency: "USD",
      name: "Campaign",
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/cancel",
      paymentMethod: "us_bank_account",
      metadata: { purpose: "funding_deposit" },
    });
    assert.equal(ach.get("payment_method_types[0]"), "us_bank_account");
    const page = readFileSync("src/app/payments/page.tsx", "utf8");
    const contract = readFileSync("src/app/collaboration/contracts/[id]/page.tsx", "utf8");
    assert.equal(page.includes("/payments/checkout/"), true);
    assert.equal(contract.includes("/payments/checkout/"), true);
    assert.equal(page.includes("Stripe is the collection route"), false);
    const paid = stripeCheckoutPayment({
      id: "cs_test_paid",
      payment_status: "paid",
      amount_total: 483000,
      metadata: { depositId: "dep_1", fundingId: "fund_1", purpose: "funding_deposit" },
    });
    assert.equal(
      gatewaySessionConfirmsDeposit({ session: paid, depositId: "dep_1", fundingId: "fund_1", amountCents: 483000 }),
      true,
    );
    assert.equal(
      gatewaySessionConfirmsDeposit({
        session: paid ? { ...paid, paymentStatus: "unpaid" } : null,
        depositId: "dep_1",
        fundingId: "fund_1",
        amountCents: 483000,
      }),
      false,
    );
    assert.equal(
      gatewaySessionConfirmsDeposit({
        session: paid ? { ...paid, amountTotal: 100 } : null,
        depositId: "dep_1",
        fundingId: "fund_1",
        amountCents: 483000,
      }),
      false,
    );
    assert.equal(gatewaySessionConfirmsDeposit({ session: null, depositId: "dep_1", fundingId: "fund_1", amountCents: 483000 }), false);
    assert.equal(
      fundingDepositEventDecision({
        eventType: "checkout.session.async_payment_succeeded",
        paymentStatus: "paid",
        amountTotal: 483000,
        currency: "usd",
        sessionId: "cs_test_1",
        depositReference: "cs_test_1",
        depositAmountCents: 483000,
        depositCurrency: "USD",
      }),
      "confirm",
    );
    assert.equal(
      fundingDepositEventDecision({
        eventType: "checkout.session.completed",
        paymentStatus: "unpaid",
        amountTotal: 483000,
        currency: "USD",
        sessionId: "cs_test_1",
        depositReference: "cs_test_1",
        depositAmountCents: 483000,
        depositCurrency: "USD",
      }),
      "wait",
    );
    assert.equal(
      fundingDepositEventDecision({
        eventType: "checkout.session.async_payment_failed",
        paymentStatus: "unpaid",
        amountTotal: 483000,
        currency: "USD",
        sessionId: "cs_test_1",
        depositReference: "cs_test_1",
        depositAmountCents: 483000,
        depositCurrency: "USD",
      }),
      "fail",
    );
    assert.equal(
      fundingDepositEventDecision({
        eventType: "checkout.session.async_payment_succeeded",
        paymentStatus: "paid",
        amountTotal: 483000,
        currency: "",
        sessionId: "cs_test_1",
        depositReference: "cs_test_1",
        depositAmountCents: 483000,
        depositCurrency: "USD",
      }),
      "mismatch",
    );
  });
});

describe("funding deposit ledger", () => {
  it("records a wire as pending and funds the agreement only after finance confirms it", async () => {
    const previous = await prisma.platformSetting.findUnique({ where: { key: "marketplace.manual_deposit" } });
    const funding = await prisma.collaborationFunding.create({
      data: {
        jurisdictionCode: "US",
        businessName: "Deposit test",
        creatorSlug: "sofia-martinez",
        title: "Deposit checkout",
        grossCents: 483_000,
        feeCents: 63_000,
        feeSnapshotJson: { feeCents: 63_000 },
        serviceLevel: "contracted",
        status: "awaiting_provider",
        providerCode: "stripe",
        collectionProviderCode: "stripe",
        currency: "USD",
      },
    });
    try {
      await saveManualDepositInstructions({
        bankName: "First Bank",
        accountName: "Influrios",
        routingNumber: "021000021",
        accountNumber: "123456789",
        checkPayableTo: "Influrios",
        checkMailingAddress: "1 Market Street",
      });
      const recorded = await startFundingDeposit({
        fundingId: funding.id,
        method: "ach_wire",
        note: "Wire from the operating account",
        origin: "http://localhost:3000",
      });
      assert.equal(recorded.ok, true);
      if (!recorded.ok || recorded.kind !== "manual") return;
      assert.equal(recorded.instructions.routingNumber, "021000021");
      const waiting = await prisma.collaborationFunding.findUnique({ where: { id: funding.id } });
      assert.equal(waiting?.status, "awaiting_provider");
      const pending = await prisma.fundingDeposit.findUnique({ where: { id: recorded.depositId } });
      assert.equal(pending?.status, "manual_pending");
      const confirmed = await confirmManualDeposit({ depositId: recorded.depositId, actor: "finance@example.com" });
      assert.equal(confirmed.ok, true);
      const held = await prisma.collaborationFunding.findUnique({ where: { id: funding.id } });
      assert.equal(held?.status, "held");
      const done = await prisma.fundingDeposit.findUnique({ where: { id: recorded.depositId } });
      assert.equal(done?.status, "confirmed");
      assert.equal(done?.confirmedBy, "finance@example.com");
    } finally {
      if (previous) {
        await prisma.platformSetting.update({ where: { key: previous.key }, data: { value: previous.value ?? {} } }).catch(() => undefined);
      } else {
        await prisma.platformSetting.delete({ where: { key: "marketplace.manual_deposit" } }).catch(() => undefined);
      }
      await prisma.collaborationFunding.delete({ where: { id: funding.id } }).catch(() => undefined);
    }
  });

  it("posts the hold when Stripe reports the card checkout paid", async () => {
    const funding = await prisma.collaborationFunding.create({
      data: {
        jurisdictionCode: "US",
        businessName: "Deposit test",
        creatorSlug: "sofia-martinez",
        title: "Card deposit",
        grossCents: 483_000,
        feeCents: 63_000,
        feeSnapshotJson: { feeCents: 63_000 },
        serviceLevel: "contracted",
        status: "awaiting_provider",
        providerCode: "stripe",
        collectionProviderCode: "stripe",
        currency: "USD",
      },
    });
    const sessionId = `cs_test_${funding.id.replace(/[^A-Za-z0-9]/g, "")}`;
    const deposit = await prisma.fundingDeposit.create({
      data: {
        fundingId: funding.id,
        method: "card",
        status: "gateway_opened",
        amountCents: 483_000,
        currency: "USD",
        reference: sessionId,
      },
    });
    try {
      const unpaid = await confirmGatewayDeposit({
        depositId: deposit.id,
        fundingId: funding.id,
        checkoutSessionId: sessionId,
        paymentStatus: "unpaid",
      });
      assert.equal(unpaid.ok, false);
      assert.equal((await prisma.collaborationFunding.findUnique({ where: { id: funding.id } }))?.status, "awaiting_provider");
      const paid = await confirmGatewayDeposit({
        depositId: deposit.id,
        fundingId: funding.id,
        checkoutSessionId: sessionId,
        paymentStatus: "paid",
      });
      assert.equal(paid.ok, true);
      assert.equal((await prisma.collaborationFunding.findUnique({ where: { id: funding.id } }))?.status, "held");
      assert.equal((await prisma.fundingDeposit.findUnique({ where: { id: deposit.id } }))?.status, "confirmed");
    } finally {
      await prisma.processedWebhook.deleteMany({ where: { eventId: sessionId } }).catch(() => undefined);
      await prisma.collaborationFunding.delete({ where: { id: funding.id } }).catch(() => undefined);
    }
  });
});
