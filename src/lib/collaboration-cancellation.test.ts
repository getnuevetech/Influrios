import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canExecuteHeldCancellation,
  isCancellationReason,
} from "./collaboration-cancellation";
import { marketplaceDisposition } from "./ledger";
import { fundingBadge } from "./funding-badge";
import { COLLAB_NOTIFICATION_KINDS, collabKindForMarketplaceEvent, usesInfluencerTerminology } from "./collab-notifications";
import { CANCELLATION_REASON_LABELS } from "./cancellation-matrix";

describe("W3.6 chargeback + held cancellation gates", () => {
  it("recognizes cancellation reasons including chargeback", () => {
    assert.equal(isCancellationReason("chargeback"), true);
    assert.equal(isCancellationReason("brand_after_start"), true);
    assert.equal(isCancellationReason("not_a_reason"), false);
    assert.ok(CANCELLATION_REASON_LABELS.chargeback.includes("Chargeback"));
  });

  it("allows held cancel when protected payments are on", () => {
    assert.equal(
      canExecuteHeldCancellation({
        fundingStatus: "held",
        protectedPaymentsEnabled: true,
        reason: "brand_before_start",
      }).ok,
      true,
    );
    assert.equal(
      canExecuteHeldCancellation({
        fundingStatus: "awaiting_provider",
        protectedPaymentsEnabled: true,
        reason: "brand_before_start",
      }).ok,
      false,
    );
  });

  it("keeps payment_risk paused except for chargeback ops", () => {
    assert.equal(
      canExecuteHeldCancellation({
        fundingStatus: "payment_risk",
        protectedPaymentsEnabled: true,
        reason: "chargeback",
      }).ok,
      true,
    );
    assert.equal(
      canExecuteHeldCancellation({
        fundingStatus: "payment_risk",
        protectedPaymentsEnabled: true,
        reason: "brand_after_start",
      }).ok,
      false,
    );
  });

  it("applies funding.chargeback on held and ignores duplicate payment_risk", () => {
    assert.equal(
      marketplaceDisposition({
        eventType: "funding.chargeback",
        fundingStatus: "held",
        amountCents: 10_000,
        expectedCents: 10_000,
        heldCents: 10_000,
      }),
      "apply",
    );
    assert.equal(
      marketplaceDisposition({
        eventType: "funding.chargeback",
        fundingStatus: "payment_risk",
        amountCents: 10_000,
        expectedCents: 10_000,
        heldCents: 10_000,
      }),
      "ignore",
    );
    assert.equal(
      marketplaceDisposition({
        eventType: "funding.chargeback",
        fundingStatus: "awaiting_provider",
        amountCents: 10_000,
        expectedCents: 10_000,
        heldCents: 0,
      }),
      "reject",
    );
  });

  it("blocks release while payment_risk and allows refund from payment_risk", () => {
    assert.equal(
      marketplaceDisposition({
        eventType: "payout.released",
        fundingStatus: "payment_risk",
        amountCents: 5_000,
        expectedCents: 5_000,
        heldCents: 5_000,
        milestoneStatus: "approved",
      }),
      "reject",
    );
    assert.equal(
      marketplaceDisposition({
        eventType: "payout.refunded",
        fundingStatus: "payment_risk",
        amountCents: 5_000,
        expectedCents: 5_000,
        heldCents: 5_000,
      }),
      "apply",
    );
  });

  it("surfaces Payment Risk badge and notification kind", () => {
    assert.equal(fundingBadge({ status: "payment_risk", heldCents: 1000 }), "Payment Risk");
    assert.ok(COLLAB_NOTIFICATION_KINDS.includes("payment_risk"));
    assert.equal(collabKindForMarketplaceEvent("funding.chargeback"), "payment_risk");
    assert.equal(usesInfluencerTerminology("payment_risk"), true);
  });
});
