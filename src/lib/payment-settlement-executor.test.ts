import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSandboxLedgerHoldTransferRef,
  readSandboxCollectionProvenance,
  buildSandboxCollectionProvenance,
  mergeSandboxCollectionProvenance,
} from "@/lib/payment-account-routing";

describe("settlement simulation gates (unit)", () => {
  it("requires persisted sandbox provenance and keeps providerE2eComplete false", () => {
    const provenance = buildSandboxCollectionProvenance({
      originOrHost: "http://127.0.0.1:3000",
      allocatedFundsDetected: false,
      treasuryDetected: false,
    });
    const snapshot = mergeSandboxCollectionProvenance({ countryCode: "US", version: "1" }, provenance);
    const read = readSandboxCollectionProvenance(snapshot);
    assert.ok(read);
    assert.equal(read?.simulation, true);
    assert.equal(read?.providerE2eComplete, false);
    // Changing ambient key mode must not rewrite frozen provenance.
    assert.equal(read?.stripeKeyModeAtOpen, "sandbox");
    assert.equal(readSandboxCollectionProvenance({ topology: "sandbox_ledger_hold", simulation: true, providerE2eComplete: true }), null);
    assert.equal(isSandboxLedgerHoldTransferRef(`sim_sandbox_ledger_hold:settlement_1`), true);
  });

  it("refuses to treat missing provenance as sandbox simulation", () => {
    assert.equal(readSandboxCollectionProvenance(null), null);
    assert.equal(readSandboxCollectionProvenance({ countryCode: "US" }), null);
    assert.equal(readSandboxCollectionProvenance({ collaborationCollection: { topology: "unavailable" } }), null);
  });
});
