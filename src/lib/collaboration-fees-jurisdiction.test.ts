import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";
import { saveJurisdiction } from "./marketplace-ledger";

const base = { label: "Test Zulu", currency: "USD", minorDigits: 2, providerCode: "primary", legalReviewStatus: "PENDING", fullPrefundingEnabled: true };

describe("jurisdiction editor (Marketplace settings is the only one)", () => {
  it("rejects a blank or invalid code before touching the database", async () => {
    await assert.rejects(() => saveJurisdiction({ ...base, code: "", protectedPaymentsEnabled: false, escrowTermAllowed: false }), /two-letter/);
    await assert.rejects(() => saveJurisdiction({ ...base, code: "USA", protectedPaymentsEnabled: false, escrowTermAllowed: false }), /two-letter/);
  });

  it("forces escrow off when protected payments are disabled", async () => {
    const row = await saveJurisdiction({ ...base, code: "zz", protectedPaymentsEnabled: false, escrowTermAllowed: true });
    assert.equal(row.code, "ZZ");
    assert.equal(row.protectedPaymentsEnabled, false);
    assert.equal(row.escrowTermAllowed, false);
    await prisma.collaborationJurisdiction.delete({ where: { code: "ZZ" } });
  });
});
