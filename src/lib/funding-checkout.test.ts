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
} from "./funding-checkout";
import { stripeFundingCheckoutBody } from "./stripe-admin";

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
});
