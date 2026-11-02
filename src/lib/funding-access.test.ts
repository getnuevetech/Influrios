import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { requireBusinessFundingAccess, type FundingAccessOk } from "./funding-access";

describe("funding access", () => {
  it("allows business audience and blocks creator for business-only mutations", () => {
    const business: FundingAccessOk = {
      ok: true,
      audience: "business",
      funding: {
        id: "f1",
        workspaceId: "ws1",
        creatorSlug: "creator-a",
        businessName: "Brand",
        status: "held",
      },
    };
    const creator: FundingAccessOk = { ...business, audience: "creator" };
    assert.equal(requireBusinessFundingAccess(business).ok, true);
    const denied = requireBusinessFundingAccess(creator);
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.match(denied.error, /business/i);
  });

  it("keeps Protected Payments behind a signed-in session and scoped lists", () => {
    const layout = readFileSync("src/app/payments/layout.tsx", "utf8");
    const page = readFileSync("src/app/payments/page.tsx", "utf8");
    const actions = readFileSync("src/app/payments/actions.ts", "utf8");
    assert.match(layout, /getAccountSession|requireBusinessSession|requireCreatorSession/);
    assert.match(page, /listFundingsForBusiness|listFundingsForCreator/);
    assert.equal(page.includes("listFundings()"), false);
    assert.equal(page.includes("actionCreateDeal"), false);
    assert.equal(page.includes("Request prefund"), false);
    assert.match(page, /signed collaboration contract|Start funding/i);
    assert.match(actions, /assertFundingAccess/);
    assert.match(actions, /requireBusinessFundingAccess|audience !== "business"/);
    assert.match(actions, /Fund from a signed/);
  });
});
