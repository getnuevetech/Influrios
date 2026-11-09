import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { collectionInstructionAmount, commandMayDispatch, providerOperationKey, releaseInstructionAmount } from "./provider-outbox";

describe("provider command outbox", () => {
  it("uses one key per agreement version and operation", () => {
    const first = providerOperationKey({
      agreementVersion: 1,
      fundingId: "fund-1",
      milestoneId: "mile-1",
      operation: "release",
    });
    const again = providerOperationKey({
      agreementVersion: 1,
      fundingId: "fund-1",
      milestoneId: "mile-1",
      operation: "release",
    });
    const nextVersion = providerOperationKey({
      agreementVersion: 2,
      fundingId: "fund-1",
      milestoneId: "mile-1",
      operation: "release",
    });
    assert.equal(first, again);
    assert.notEqual(first, nextVersion);
    assert.equal(commandMayDispatch("pending", 0), true);
    assert.equal(commandMayDispatch("pending", 1), false);
    assert.equal(commandMayDispatch("dispatched", 1), false);
    assert.equal(commandMayDispatch("failed", 2), true);
    assert.equal(commandMayDispatch("failed", 3), false);
  });

  it("releases the signed influencer amount and refuses a different figure", () => {
    const signed = releaseInstructionAmount({ releasableCents: 343_000, signedInfluencerReceivesCents: 343_000 });
    assert.equal(signed.ok, true);
    if (!signed.ok) return;
    assert.equal(signed.amountCents, 343_000);
    const wrong = releaseInstructionAmount({ releasableCents: 350_000, signedInfluencerReceivesCents: 343_000 });
    assert.equal(wrong.ok, false);
    const sweep = readFileSync("src/lib/jobs.ts", "utf8");
    const claim = sweep.indexOf("claimProviderCommand");
    const send = sweep.indexOf("createReleaseOrTransfer");
    assert.ok(claim > 0 && send > claim);
    const ledger = readFileSync("src/lib/marketplace-ledger.ts", "utf8");
    assert.equal(ledger.includes("activeShareSnapshot"), false);
    const collection = collectionInstructionAmount({ fundingGrossCents: 375_000, signedBusinessPaysCents: 375_000 });
    assert.equal(collection.ok, true);
    if (!collection.ok) return;
    assert.equal(collection.amountCents, 375_000);
    const wrongCollection = collectionInstructionAmount({ fundingGrossCents: 350_000, signedBusinessPaysCents: 375_000 });
    assert.equal(wrongCollection.ok, false);
    const key = providerOperationKey({ agreementVersion: 1, fundingId: "fund-1", operation: "collection" });
    assert.equal(key, "v1:fund-1:funding:collection");
    const checkout = readFileSync("src/lib/provider-collection.ts", "utf8");
    const checkoutClaim = checkout.indexOf("claimProviderCommand");
    assert.ok(checkoutClaim > 0);
    assert.ok(checkout.indexOf("createFlutterwaveCharge({") > checkoutClaim);
    assert.ok(checkout.indexOf("createMpesaCharge({") > checkoutClaim);
    assert.ok(checkout.indexOf("openAirwallexFundingCollection({") > checkoutClaim);
    assert.equal(checkout.includes("recordProviderCommandResult"), true);
  });
});
