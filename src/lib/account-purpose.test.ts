import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  operationsEarnedCents,
  splitMilestoneRelease,
} from "./account-purpose";
import {
  createMarketplaceSignedWebhookAdapter,
} from "./payment-provider-adapter";
import { marketplaceSignature, verifyMarketplaceSignature } from "./ledger";

describe("account-purpose splitMilestoneRelease", () => {
  it("uses financial plan milestone fee split when totals match", () => {
    const split = splitMilestoneRelease({
      releasableCents: 2_000,
      fundingGrossCents: 10_000,
      fundingFeeCents: 750,
      financialPlanJson: {
        milestones: [
          { title: "Kickoff", grossCents: 2_000, creatorCents: 1_850, platformFeeCents: 150 },
        ],
      },
      milestoneTitle: "Kickoff",
    });
    assert.deepEqual(split, { creatorCents: 1_850, feeCents: 150 });
  });

  it("falls back to pro-rata fee when no plan row", () => {
    const split = splitMilestoneRelease({
      releasableCents: 2_500,
      fundingGrossCents: 10_000,
      fundingFeeCents: 1_000,
    });
    assert.equal(split.feeCents, 250);
    assert.equal(split.creatorCents, 2_250);
  });

  it("operations earned counts only fee entries", () => {
    assert.equal(
      operationsEarnedCents([
        { kind: "hold", amountCents: 10_000, accountPurpose: "COLLABORATION_HOLDING" },
        { kind: "fee", amountCents: 150, accountPurpose: "OPERATIONS" },
      ]),
      150,
    );
  });
});

describe("PaymentProviderAdapter marketplace", () => {
  it("verifies and parses signed marketplace webhooks", () => {
    const adapter = createMarketplaceSignedWebhookAdapter({
      verifySignature: verifyMarketplaceSignature,
    });
    const body = JSON.stringify({
      id: "evt_1",
      type: "funding.held",
      fundingId: "fund_1",
      amountCents: 1000,
      provider: "primary",
    });
    const signature = marketplaceSignature(body, "secret");
    assert.equal(adapter.verifyWebhook(body, signature, "secret"), true);
    const parsed = adapter.parseWebhook(body);
    assert.ok(!("error" in parsed));
    if (!("error" in parsed)) {
      assert.equal(parsed.eventId, "evt_1");
      assert.equal(parsed.eventType, "funding.held");
    }
  });

  it("queues refund and cancel instructions without moving ledger money", async () => {
    const { queueProviderInstruction } = await import("./payment-provider-adapter");
    const partial = await queueProviderInstruction({
      instruction: "partial_refund",
      fundingId: "fund_test_partial",
      amountCents: 2500,
      milestoneId: "ms_1",
    });
    assert.equal(partial.ok, true);
    if (!partial.ok) return;
    assert.match(partial.reference, /^mkt_refund_/);

    const cancel = await queueProviderInstruction({
      instruction: "cancel",
      fundingId: "fund_test_cancel",
    });
    assert.equal(cancel.ok, true);
    if (!cancel.ok) return;
    assert.match(cancel.reference, /^mkt_cancel_/);

    const adapter = createMarketplaceSignedWebhookAdapter({
      verifySignature: verifyMarketplaceSignature,
    });
    const full = await adapter.createFullRefund({ fundingId: "fund_test_full" });
    assert.equal(full.ok, true);
    if (!full.ok) return;
    assert.match(full.reference, /^mkt_refund_full_/);
  });
});
