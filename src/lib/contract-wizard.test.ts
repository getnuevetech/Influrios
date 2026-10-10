import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildFinancialPlan,
  canFundContract,
  CONTRACT_WIZARD_STEPS,
  contractWizardFields,
  countryCodeFromLocation,
  customMilestonesGate,
  evaluatePreContractGates,
  feeRuleChangeAffectsPlan,
  isFinancialPlanLocked,
  lockFinancialPlan,
  nextContractStep,
  parseMilestoneDraftsFromForm,
  previousContractStep,
  validateMilestoneShares,
} from "./contract-wizard";

const standard = [
  { title: "Kickoff", shareBps: 3400 },
  { title: "Draft delivery", shareBps: 3300 },
  { title: "Published work", shareBps: 3300 },
];

describe("contract wizard steps", () => {
  it("walks parties → funding in order", () => {
    assert.deepEqual([...CONTRACT_WIZARD_STEPS], [
      "parties",
      "scope",
      "commercial",
      "milestones",
      "payment_readiness",
      "preview",
      "accept",
      "funding",
    ]);
    assert.equal(nextContractStep("parties"), "scope");
    assert.equal(previousContractStep("scope"), "parties");
    assert.equal(nextContractStep("funding"), null);
    assert.equal(previousContractStep("parties"), null);
  });
});

describe("milestone share validation", () => {
  it("requires 100% and non-empty titles", () => {
    assert.equal(validateMilestoneShares(standard).ok, true);
    assert.equal(validateMilestoneShares([{ title: "Only", shareBps: 10_000 }]).ok, false);
    assert.equal(validateMilestoneShares([{ title: "A", shareBps: 5000 }, { title: "B", shareBps: 4000 }]).ok, false);
    assert.equal(validateMilestoneShares([{ title: "", shareBps: 5000 }, { title: "B", shareBps: 5000 }]).ok, false);
  });
});

describe("custom milestones entitlement gate", () => {
  it("blocks custom schedules without entitlement or influencer accept", () => {
    const custom = [
      { title: "Brief", shareBps: 2500 },
      { title: "Shoot", shareBps: 2500 },
      { title: "Edit", shareBps: 2500 },
      { title: "Post", shareBps: 2500 },
    ];
    assert.equal(
      customMilestonesGate({
        entitled: false,
        usingCustom: true,
        milestones: custom,
        influencerAccepted: true,
      }).ok,
      false,
    );
    assert.equal(
      customMilestonesGate({
        entitled: true,
        usingCustom: true,
        milestones: custom,
        influencerAccepted: false,
      }).ok,
      false,
    );
    assert.equal(
      customMilestonesGate({
        entitled: true,
        usingCustom: true,
        milestones: custom,
        influencerAccepted: true,
      }).ok,
      true,
    );
  });

  it("allows standard templates without influencer accept", () => {
    assert.equal(
      customMilestonesGate({
        entitled: false,
        usingCustom: false,
        milestones: standard,
        influencerAccepted: false,
      }).ok,
      true,
    );
  });
});

describe("pre-contract ROUTE_READY gates", () => {
  it("blocks funding until identity, route, and provider are ready", () => {
    const blocked = evaluatePreContractGates({
      businessName: "Acme",
      creatorSlug: "ada",
      identityVerified: false,
      creatorCountryKnown: true,
      corridorActive: true,
      paymentRouteReady: true,
      jurisdictionProtectedPayments: true,
      marketplaceProviderReady: true,
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.status, "ROUTE_BLOCKED");
    assert.match(blocked.blockers[0] ?? "", /identity/i);

    const corridorBlocked = evaluatePreContractGates({
      businessName: "Acme",
      creatorSlug: "ada",
      identityVerified: true,
      creatorCountryKnown: true,
      corridorActive: false,
      paymentRouteReady: true,
      jurisdictionProtectedPayments: true,
      marketplaceProviderReady: true,
    });
    assert.equal(corridorBlocked.ok, false);
    assert.match(corridorBlocked.blockers.join(" "), /corridor/i);

    const ready = evaluatePreContractGates({
      businessName: "Acme",
      creatorSlug: "ada",
      identityVerified: true,
      creatorCountryKnown: true,
      corridorActive: true,
      paymentRouteReady: true,
      jurisdictionProtectedPayments: true,
      marketplaceProviderReady: true,
    });
    assert.equal(ready.ok, true);
    assert.equal(ready.status, "ROUTE_READY");
  });
});

describe("financial plan snapshot", () => {
  it("locks fee rule version and ignores later rule edits", () => {
    const plan = buildFinancialPlan({
      grossCents: 10_000_00,
      totalPlatformFeeCents: 750_00,
      feeRuleId: "rule_default_contracted",
      feeRuleVersion: 1,
      feeMethod: "percent",
      feePercentBps: 750,
      feeFixedCents: 0,
      fundingCountry: "US",
      creatorCountry: "US",
      milestones: [
        { title: "M1", shareBps: 2000 },
        { title: "M2", shareBps: 3000 },
        { title: "M3", shareBps: 3000 },
        { title: "M4", shareBps: 2000 },
      ],
      milestoneSource: "template",
    });
    assert.ok(plan);
    assert.equal(plan!.grossContractValueCents, 10_000_00);
    assert.equal(
      plan!.milestones.reduce((sum, row) => sum + row.grossCents, 0),
      10_000_00,
    );
    assert.equal(
      plan!.milestones.reduce((sum, row) => sum + row.platformFeeCents, 0),
      750_00,
    );
    assert.equal(isFinancialPlanLocked(plan), false);

    const locked = lockFinancialPlan(plan!);
    assert.equal(isFinancialPlanLocked(locked), true);
    assert.equal(feeRuleChangeAffectsPlan(locked, { id: "rule_default_contracted", version: 1 }), false);
    assert.equal(feeRuleChangeAffectsPlan(locked, { id: "rule_default_contracted", version: 2 }), true);
  });

  it("refuses funding until gates, milestones, and accept are clear", () => {
    const gates = evaluatePreContractGates({
      businessName: "Acme",
      creatorSlug: "ada",
      identityVerified: true,
      creatorCountryKnown: true,
      corridorActive: true,
      paymentRouteReady: true,
      jurisdictionProtectedPayments: true,
      marketplaceProviderReady: true,
    });
    const milestones = customMilestonesGate({
      entitled: true,
      usingCustom: false,
      milestones: standard,
      influencerAccepted: false,
    });
    assert.equal(canFundContract({ gates, milestones, accepted: false }).ok, false);
    assert.equal(canFundContract({ gates, milestones, accepted: true }).ok, true);
  });
});

describe("form helpers", () => {
  it("parses percent fields into basis points", () => {
    assert.deepEqual(
      parseMilestoneDraftsFromForm({
        titles: ["Kickoff", "Publish"],
        percents: ["40", "60"],
      }),
      [
        { title: "Kickoff", shareBps: 4000 },
        { title: "Publish", shareBps: 6000 },
      ],
    );
  });

  it("maps common country labels to ISO codes", () => {
    assert.equal(countryCodeFromLocation("USA"), "US");
    assert.equal(countryCodeFromLocation("United Kingdom"), "GB");
    assert.equal(countryCodeFromLocation("ng"), "NG");
    assert.equal(countryCodeFromLocation(""), null);
  });

  it("drops a blank milestone row", () => {
    assert.deepEqual(
      parseMilestoneDraftsFromForm({
        titles: ["Kickoff", "", "Publish"],
        percents: ["40", "", "60"],
      }),
      [
        { title: "Kickoff", shareBps: 4000 },
        { title: "Publish", shareBps: 6000 },
      ],
    );
  });
});

describe("contract wizard fields", () => {
  it("uses the creator country when it is configured and leaves the rest blank", () => {
    const fields = contractWizardFields({
      creatorCountryCode: "NG",
      jurisdictionCodes: ["US", "NG"],
    });
    assert.equal(fields.title, "");
    assert.equal(fields.scope, "");
    assert.equal(fields.commercial, "");
    assert.equal(fields.jurisdictionCode, "NG");
    assert.equal(fields.serviceLevel, "");
    assert.equal(fields.grossRaw, "");
  });

  it("does not invent a jurisdiction, amount, or service level", () => {
    const fields = contractWizardFields({});
    assert.equal(fields.jurisdictionCode, "");
    assert.equal(fields.grossRaw, "");
    assert.equal(fields.commercial, "");
    assert.equal(fields.serviceLevel, "");
  });

  it("keeps the terms that were entered", () => {
    const fields = contractWizardFields({
      title: "Spring set",
      scope: "Two reels",
      commercial: "Barter",
      jurisdiction: "gb",
      serviceLevel: "managed_intro",
      gross: "1200",
      creatorCountryCode: "NG",
      jurisdictionCodes: ["US", "NG", "GB"],
    });
    assert.equal(fields.title, "Spring set");
    assert.equal(fields.scope, "Two reels");
    assert.equal(fields.commercial, "Barter");
    assert.equal(fields.jurisdictionCode, "GB");
    assert.equal(fields.serviceLevel, "managed_intro");
    assert.equal(fields.grossRaw, "1200");
  });

  it("does not prefill a sample contract", () => {
    const files = [
      "src/app/collaboration/contract/page.tsx",
      "src/app/collaboration/contract/actions.ts",
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(text.includes("Kickoff brief"), false, file);
      assert.equal(text.includes("Deliverables, channels, usage rights, and revision limits"), false, file);
      assert.equal(text.includes('?? "5000"'), false, file);
      assert.equal(text.includes('?? "US"'), false, file);
      assert.equal(text.includes("Paid brand partnership"), false, file);
    }
  });
});
