import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accountsBasePath, type AccountsTab } from "./admin-accounts";

describe("admin accounts helpers", () => {
  it("maps tabs to the correct admin paths", () => {
    const cases: Array<[AccountsTab, string]> = [
      ["influencer", "/admin/accounts"],
      ["all", "/admin/accounts"],
      ["admin", "/admin/accounts"],
      ["business", "/admin/business-accounts"],
    ];
    for (const [tab, path] of cases) {
      assert.equal(accountsBasePath(tab), path);
    }
  });
});
