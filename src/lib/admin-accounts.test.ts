import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accountFieldFilters, accountSearchOr, accountsBasePath, type AccountsTab } from "./admin-accounts";

describe("admin accounts helpers", () => {
  it("maps tabs to the correct admin paths", () => {
    const cases: Array<[AccountsTab, string]> = [
      ["influencer", "/admin/accounts"],
      ["all", "/admin/accounts"],
      ["business", "/admin/business-accounts"],
    ];
    for (const [tab, path] of cases) {
      assert.equal(accountsBasePath(tab), path);
    }
  });

  it("searches login email, mobile, and business contact fields", () => {
    const clauses = accountSearchOr("  ada@influrios.com  ");
    const keys = clauses.flatMap((clause) => Object.keys(clause));
    assert.ok(keys.includes("email"));
    assert.ok(keys.includes("phone"));
    assert.ok(clauses.some((clause) => "business" in clause && "contactEmail" in (clause.business as object)));
    assert.ok(clauses.some((clause) => "business" in clause && "contactPhone" in (clause.business as object)));
    assert.equal(accountSearchOr("   ").length, 0);
  });

  it("filters handle, email, and mobile as separate columns", () => {
    const filters = accountFieldFilters({ email: "ada@example.com", phone: "+1 (713) 555-0100", handle: "@ada" });
    assert.equal(filters.length, 3);
    assert.deepEqual(filters[0], { email: { contains: "ada@example.com", mode: "insensitive" } });
    assert.equal((filters[2] as { creator: { slug: { contains: string } } }).creator.slug.contains, "ada");
  });

  it("also matches a phone when the query includes formatting", () => {
    const clauses = accountSearchOr("+1 (713) 555-0100");
    assert.ok(clauses.some((clause) => clause.phone && "contains" in (clause.phone as object) && (clause.phone as { contains: string }).contains === "17135550100"));
  });
});
