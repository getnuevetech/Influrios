import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { quotePartyPlatformFee } from "./dual-platform-fees";
import { shareLines } from "./fx-share";
import { buildBusinessCommercialSnapshot, buildProviderStagingTrace, readSignedCollection } from "./payment-engine";
import { PILOT_FEE_RULES } from "./pilot-fee-rules";
import { feeLevelForSignedTerms, pilotMigrationDeactivates, resolvePaidAgreementFee } from "./paid-agreement-fee";

const AS_OF = "2026-11-09T12:00:00.000Z";
const GROSS = 350_000;

function quoteSide(serviceLevel: string, side: "business" | "influencer") {
  return quotePartyPlatformFee(
    PILOT_FEE_RULES,
    { jurisdiction: "US", serviceLevel, grossValueCents: GROSS, asOf: AS_OF },
    side,
  );
}

describe("paid agreement fee boundary", () => {
  it("prices a $3,500 US agreement from Discovery, Platform Match, and a direct invitation", () => {
    for (const stated of ["discovery", "platform_match", "contracted"]) {
      const boundary = resolvePaidAgreementFee({ statedServiceLevel: stated, grossCents: GROSS });
      assert.equal(boundary.feeServiceLevel, "contracted");
      assert.equal(boundary.freeDiscovery, false);
      if (stated === "discovery") assert.equal(boundary.originServiceLevel, "discovery");
      if (stated === "platform_match") assert.equal(boundary.originServiceLevel, "platform_match");
      if (stated === "contracted") assert.equal(boundary.originServiceLevel, "direct");

      const business = quoteSide(boundary.feeServiceLevel, "business");
      const influencer = quoteSide(boundary.feeServiceLevel, "influencer");
      assert.equal(business.ok, true);
      assert.equal(influencer.ok, true);
      if (!business.ok || !influencer.ok) return;
      assert.equal(business.feeCents, 17_500);
      assert.equal(business.totalCents, 367_500);
      assert.equal(influencer.feeCents, 8_750);
      assert.equal(influencer.totalCents, 341_250);
      assert.equal(business.rule.id, "rule_pilot_contracted_business");
      assert.notEqual(business.rule.percentBps, 8000);

      const snapshot = buildBusinessCommercialSnapshot({
        quote: business,
        influencer,
        currency: "USD",
        minorDigits: 2,
        milestoneCount: 1,
        tax: { status: "approved_zero", lines: [] },
      });
      assert.equal("ok" in snapshot, false);
      if ("ok" in snapshot) return;
      assert.equal(snapshot.businessPlatformFeeCents, 17_500);
      assert.equal(snapshot.businessPaysCents, 367_500);
      assert.equal(snapshot.influencerPlatformFeeCents, 8_750);
      assert.equal(snapshot.influencerReceivesCents, 341_250);
      assert.equal(snapshot.platformFeesTotalCents, 26_250);

      const collection = readSignedCollection({ signedQuote: snapshot }, "USD");
      assert.equal(collection && "error" in collection, false);
      if (!collection || "error" in collection) return;
      const trace = buildProviderStagingTrace({
        scenario: "payout",
        currency: "USD",
        businessPaysCents: collection.businessPaysCents,
        influencerReceivesCents: collection.influencerReceivesCents,
        platformFeesTotalCents: collection.platformFeesTotalCents,
        taxCents: 0,
        collectionRef: "col_3500",
        holdingRef: "hold_3500",
        releaseRef: "rel_3500",
        payoutRef: "pay_3500",
        holdingAvailable: true,
        beneficiaryConfirmed: true,
      });
      assert.equal("reconciled" in trace, true);
      if (!("reconciled" in trace)) return;
      assert.equal(trace.platformFeesTotalCents, 26_250);
      const legacyShare = shareLines(GROSS, [
        { label: "Influencer", shareBps: 8000 },
        { label: "Platform", shareBps: 2000 },
      ]);
      assert.equal(legacyShare?.[1]?.amountCents, 70_000);
      assert.notEqual(trace.platformFeesTotalCents, legacyShare?.[1]?.amountCents);
    }
  });

  it("keeps the $0 Discovery rules for activity with no amount", () => {
    const free = resolvePaidAgreementFee({ statedServiceLevel: "discovery", grossCents: 0 });
    assert.equal(free.freeDiscovery, true);
    assert.equal(free.feeServiceLevel, "discovery");
    assert.equal(free.originServiceLevel, "discovery");
    const stored = feeLevelForSignedTerms({ serviceLevel: "discovery", grossCents: GROSS });
    assert.equal(stored, "contracted");
    const explicit = feeLevelForSignedTerms({ serviceLevel: "discovery", feeServiceLevel: "contracted", grossCents: GROSS });
    assert.equal(explicit, "contracted");
  });

  it("deactivates only rules the paid quote can select", () => {
    const base = {
      id: "rule_custom",
      active: true,
      payer: "brand",
      purpose: "business_platform_fee",
      fundingMode: "*",
      relationshipSource: "*",
      promotionChannel: "*",
    };
    assert.equal(pilotMigrationDeactivates({ ...base, serviceLevel: "discovery", jurisdiction: "GB" }), true);
    assert.equal(pilotMigrationDeactivates({ ...base, serviceLevel: "*", jurisdiction: "NG" }), true);
    assert.equal(pilotMigrationDeactivates({ ...base, serviceLevel: "contracted", jurisdiction: "US" }), true);
    assert.equal(pilotMigrationDeactivates({ ...base, serviceLevel: "platform_match", jurisdiction: "*" }), true);
    assert.equal(pilotMigrationDeactivates({ ...base, serviceLevel: "contracted", jurisdiction: "GB" }), false);
    assert.equal(pilotMigrationDeactivates({ ...base, serviceLevel: "managed_campaign", jurisdiction: "US" }), false);
    assert.equal(pilotMigrationDeactivates({ ...base, serviceLevel: "contracted", jurisdiction: "US", fundingMode: "full" }), false);
    assert.equal(pilotMigrationDeactivates({ ...base, payer: "split", serviceLevel: "contracted", jurisdiction: "US" }), false);
    assert.equal(pilotMigrationDeactivates({ ...base, id: "rule_pilot_contracted_business", serviceLevel: "contracted", jurisdiction: "US" }), false);
    assert.equal(pilotMigrationDeactivates({ ...base, active: false, serviceLevel: "contracted", jurisdiction: "US" }), false);

    const repair = readFileSync("prisma/migrations/20261109230000_pilot_fee_rule_scope/migration.sql", "utf8");
    assert.equal(repair.includes(`"serviceLevel" IN ('discovery', '*')`), true);
    assert.equal(repair.includes(`"jurisdiction" IN ('US', '*')`), true);
    assert.equal(repair.includes("managed_intro"), false);
    assert.equal(repair.includes("SET \"active\" = true"), true);
  });
});
