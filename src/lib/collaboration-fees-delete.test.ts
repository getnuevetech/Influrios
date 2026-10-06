import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deleteFeeRule, deleteFeeSnapshot } from "./collaboration-fees";

describe("fee rule and snapshot removal", () => {
  it("requires an id before deleting a rule or snapshot", async () => {
    await assert.rejects(() => deleteFeeRule(""), /Choose a fee rule/);
    await assert.rejects(() => deleteFeeSnapshot(""), /Choose a fee snapshot/);
  });
});
