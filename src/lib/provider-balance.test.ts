import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { compareProviderBalances } from "./provider-balance";

describe("provider balance comparison", () => {
  it("reports a difference and does not treat it as a ledger movement", () => {
    const matched = compareProviderBalances({
      internalHeldCents: 32_000,
      internalReleasedCents: 343_000,
      internalRefundedCents: 0,
      providerHeldCents: 32_000,
      providerReleasedCents: 343_000,
      providerRefundedCents: 0,
    });
    assert.equal(matched.ok && matched.matched, true);
    const drift = compareProviderBalances({
      internalHeldCents: 32_000,
      internalReleasedCents: 343_000,
      internalRefundedCents: 0,
      providerHeldCents: 31_000,
      providerReleasedCents: 343_000,
      providerRefundedCents: 0,
    });
    assert.equal(drift.ok && drift.matched, false);
    if (!drift.ok) return;
    assert.equal(drift.heldDifferenceCents, -1_000);
    const source = readFileSync("src/lib/provider-balance.ts", "utf8");
    assert.equal(source.includes("ledgerEntry"), false);
    assert.equal(source.includes("collaborationFunding.update"), false);
    assert.equal(source.includes("provider_balance.compared"), true);
    const page = readFileSync("src/app/admin/deals/[id]/page.tsx", "utf8");
    assert.equal(page.includes("recordProviderBalanceComparison"), false);
  });
});
