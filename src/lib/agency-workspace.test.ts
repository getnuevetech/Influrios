import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agencyWorkspaceIdForOwner } from "./agency";

describe("agency workspace identity", () => {
  it("gives each owner a distinct workspace id and never the shared demo id", () => {
    const a = agencyWorkspaceIdForOwner("user_a");
    const b = agencyWorkspaceIdForOwner("user_b");
    assert.equal(a, "agency_owner_user_a");
    assert.notEqual(a, b);
    assert.equal(a.includes("agency_demo"), false);
  });
});
