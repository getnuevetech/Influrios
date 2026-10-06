import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deleteJurisdictionGate,
  upsertJurisdictionGate,
} from "./collaboration-fees";

describe("jurisdiction gate admin", () => {
  it("rejects blank or invalid codes before touching the database", async () => {
    await assert.rejects(() => upsertJurisdictionGate({
      code: "",
      label: "Test",
      protectedPaymentsEnabled: false,
      escrowTermAllowed: false,
    }), /two-letter/);
    await assert.rejects(() => upsertJurisdictionGate({
      code: "USA",
      label: "Test",
      protectedPaymentsEnabled: false,
      escrowTermAllowed: false,
    }), /two-letter/);
    await assert.rejects(() => deleteJurisdictionGate(""), /Choose a jurisdiction/);
  });

  it("forces escrow off when protected payments are disabled", async () => {
    const row = await upsertJurisdictionGate({
      code: "zz",
      label: "Test Zulu",
      protectedPaymentsEnabled: false,
      escrowTermAllowed: true,
    });
    assert.equal(row.code, "ZZ");
    assert.equal(row.protectedPaymentsEnabled, false);
    assert.equal(row.escrowTermAllowed, false);
    await deleteJurisdictionGate("ZZ");
  });
});
