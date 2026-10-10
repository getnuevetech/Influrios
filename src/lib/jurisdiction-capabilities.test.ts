import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  allowedServiceLevels,
  asLegalReviewStatus,
  capabilitiesFromJurisdictionRow,
  enteredLegalReviewStatus,
  evaluatePrefundCapabilities,
  parseApprovedProviderIds,
  providerApprovedByJurisdiction,
  scheduleKindAllowedByJurisdiction,
  serializeApprovedProviderIds,
  serviceLevelAllowedByJurisdiction,
  type JurisdictionCapabilities,
} from "./jurisdiction-capabilities";

function caps(overrides: Partial<JurisdictionCapabilities> = {}): JurisdictionCapabilities {
  return {
    protectedPaymentsEnabled: true,
    escrowTermAllowed: false,
    fullPrefundingEnabled: true,
    stagedPrefundingEnabled: false,
    recurringFundingEnabled: false,
    managedIntroductionEnabled: false,
    managedNegotiationEnabled: false,
    approvedProviderIds: [],
    legalReviewStatus: "APPROVED",
    ...overrides,
  };
}

describe("jurisdiction capability parsing", () => {
  it("normalizes legal review and provider ids", () => {
    assert.equal(asLegalReviewStatus("approved"), "APPROVED");
    assert.equal(asLegalReviewStatus("nope"), "PENDING");
    assert.equal(asLegalReviewStatus(""), "PENDING");
    assert.equal(asLegalReviewStatus(null), "PENDING");
    const missing = enteredLegalReviewStatus("");
    assert.equal(missing.ok, false);
    const chosen = enteredLegalReviewStatus("blocked");
    assert.equal(chosen.ok, true);
    if (chosen.ok) assert.equal(chosen.status, "BLOCKED");
    assert.deepEqual(parseApprovedProviderIds('["primary","wise"]'), ["primary", "wise"]);
    assert.deepEqual(parseApprovedProviderIds("primary, airwallex"), ["primary", "airwallex"]);
    assert.equal(serializeApprovedProviderIds(["Primary", "primary", "wise"]), '["primary","wise"]');
  });

  it("maps a jurisdiction row with safe defaults", () => {
    const row = capabilitiesFromJurisdictionRow({
      protectedPaymentsEnabled: true,
      escrowTermAllowed: false,
    });
    assert.equal(row.fullPrefundingEnabled, true);
    assert.equal(row.stagedPrefundingEnabled, false);
    assert.equal(row.legalReviewStatus, "PENDING");
    assert.equal(
      capabilitiesFromJurisdictionRow({
        protectedPaymentsEnabled: true,
        escrowTermAllowed: false,
        legalReviewStatus: "APPROVED",
      }).legalReviewStatus,
      "APPROVED",
    );

    const actions = readFileSync("src/app/admin/marketplace/actions.ts", "utf8");
    const page = readFileSync("src/app/admin/marketplace/page.tsx", "utf8");
    const capsSource = readFileSync("src/lib/jurisdiction-capabilities.ts", "utf8");
    assert.equal(actions.includes('?? "APPROVED"'), false);
    assert.equal(actions.includes('?? "USD"'), false);
    assert.equal(actions.includes('?? "primary"'), false);
    assert.equal(actions.includes("?? 2"), false);
    assert.equal(page.includes('defaultValue="PENDING"'), false);
    assert.equal(page.includes('defaultValue="USD"'), false);
    assert.equal(page.includes('defaultValue="primary"'), false);
    assert.equal(capsSource.includes('?? "APPROVED"'), false);
  });
});

describe("managed-mode gates (Dev §24)", () => {
  it("refuses managed intro even when a fee rule would exist", () => {
    const blocked = serviceLevelAllowedByJurisdiction(caps(), "managed_intro");
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.match(blocked.error, /not enabled/i);

    const pending = serviceLevelAllowedByJurisdiction(
      caps({ managedIntroductionEnabled: true, legalReviewStatus: "PENDING" }),
      "managed_intro",
    );
    assert.equal(pending.ok, false);

    const allowed = serviceLevelAllowedByJurisdiction(
      caps({ managedIntroductionEnabled: true }),
      "managed_intro",
    );
    assert.equal(allowed.ok, true);
  });

  it("gates managed campaign behind managedNegotiationEnabled", () => {
    const blocked = serviceLevelAllowedByJurisdiction(caps(), "managed_campaign");
    assert.equal(blocked.ok, false);
    const allowed = serviceLevelAllowedByJurisdiction(
      caps({ managedNegotiationEnabled: true }),
      "managed_campaign",
    );
    assert.equal(allowed.ok, true);
  });

  it("always allows contracted / discovery when legal review is not blocked", () => {
    assert.equal(serviceLevelAllowedByJurisdiction(caps(), "contracted").ok, true);
    assert.equal(serviceLevelAllowedByJurisdiction(caps({ legalReviewStatus: "PENDING" }), "discovery").ok, true);
    assert.equal(serviceLevelAllowedByJurisdiction(caps({ legalReviewStatus: "BLOCKED" }), "contracted").ok, false);
  });
});

describe("funding schedule + provider gates", () => {
  it("requires full / staged / recurring flags", () => {
    assert.equal(scheduleKindAllowedByJurisdiction(caps(), "once").ok, true);
    assert.equal(scheduleKindAllowedByJurisdiction(caps(), "staged").ok, false);
    assert.equal(
      scheduleKindAllowedByJurisdiction(caps({ stagedPrefundingEnabled: true }), "staged").ok,
      true,
    );
    assert.equal(scheduleKindAllowedByJurisdiction(caps(), "recurring").ok, false);
  });

  it("enforces approved provider list when non-empty", () => {
    assert.equal(providerApprovedByJurisdiction(caps(), "primary").ok, true);
    const gated = providerApprovedByJurisdiction(caps({ approvedProviderIds: ["airwallex"] }), "primary");
    assert.equal(gated.ok, false);
    assert.equal(
      providerApprovedByJurisdiction(caps({ approvedProviderIds: ["airwallex"] }), "airwallex").ok,
      true,
    );
  });
});

describe("evaluatePrefundCapabilities", () => {
  it("composes protected payments, legal review, service, schedule, and provider", () => {
    const ok = evaluatePrefundCapabilities({
      caps: caps({ managedIntroductionEnabled: true, approvedProviderIds: ["primary"] }),
      serviceLevel: "managed_intro",
      scheduleKind: "once",
      providerCode: "primary",
    });
    assert.equal(ok.ok, true);

    const noProtected = evaluatePrefundCapabilities({
      caps: caps({ protectedPaymentsEnabled: false }),
      serviceLevel: "contracted",
      scheduleKind: "once",
      providerCode: "primary",
    });
    assert.equal(noProtected.ok, false);

    const managedOff = evaluatePrefundCapabilities({
      caps: caps(),
      serviceLevel: "managed_intro",
      scheduleKind: "once",
      providerCode: "primary",
    });
    assert.equal(managedOff.ok, false);
    if (!managedOff.ok) assert.match(managedOff.error, /not enabled/i);
  });

  it("filters UI service levels", () => {
    const levels = allowedServiceLevels(caps({ managedIntroductionEnabled: true }), [
      "discovery",
      "contracted",
      "managed_intro",
      "managed_campaign",
    ]);
    assert.deepEqual(levels, ["discovery", "contracted", "managed_intro"]);
  });
});
