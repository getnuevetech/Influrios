import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  paymentChargeBlock,
  paymentChargeKeyForDeposit,
  paymentChargeKeyForRelease,
  paymentChargeRefusal,
  setPaymentChargeSwitchForTests,
} from "./payment-charge-switches";

describe("payment and charge switches", () => {
  it("maps each deposit method and a failed payout onto its own switch", () => {
    assert.equal(paymentChargeKeyForDeposit("card"), "card_collection");
    assert.equal(paymentChargeKeyForDeposit("ach_online"), "ach_collection");
    assert.equal(paymentChargeKeyForDeposit("ach_wire"), "wire_collection");
    assert.equal(paymentChargeKeyForDeposit("check"), "check_collection");
    assert.equal(paymentChargeKeyForDeposit("cash"), null);
    assert.equal(paymentChargeKeyForRelease(null), "milestone_payout");
    assert.equal(paymentChargeKeyForRelease("failed"), "payout_retry");
    assert.equal(paymentChargeKeyForRelease("returned"), "payout_retry");
  });

  it("blocks a turned-off charge and leaves the others on", async () => {
    setPaymentChargeSwitchForTests("card_collection", false);
    const blocked = await paymentChargeBlock("card_collection");
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.equal(blocked.error, "Card charge is turned off. Nothing was charged.");
    assert.equal(paymentChargeRefusal("milestone_payout"), "Milestone payout is turned off.");
    const payout = await paymentChargeBlock("milestone_payout");
    assert.equal(payout.ok, true);
    setPaymentChargeSwitchForTests("card_collection", null);
  });

  it("checks the switch before a provider instruction is sent", () => {
    const checkout = readFileSync("src/lib/funding-checkout.ts", "utf8");
    const deposit = checkout.indexOf("export async function startFundingDeposit");
    const claim = checkout.indexOf("paymentChargeBlock", deposit);
    assert.ok(deposit > 0 && claim > deposit);
    const outbox = readFileSync("src/lib/provider-outbox.ts", "utf8");
    const command = outbox.indexOf("export async function claimProviderCommand");
    assert.ok(outbox.indexOf("paymentChargeKeyForRelease", command) > command);
    const cancellation = readFileSync("src/lib/collaboration-cancellation.ts", "utf8");
    const refund = cancellation.indexOf("createPartialRefund");
    assert.ok(cancellation.lastIndexOf("cancellation_refund", refund) > 0);
    assert.ok(cancellation.lastIndexOf("cancellation_refund", refund) < refund);
    assert.equal(readFileSync("src/app/admin/deals/actions.ts", "utf8").includes('paymentChargeBlock("fee_settlement")'), true);
    assert.equal(readFileSync("src/app/admin/fees/fees-panel.tsx", "utf8").includes("paymentChargeBlock"), false);
  });
});
