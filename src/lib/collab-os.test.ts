/**
 * L4 — Collaboration OS product switch helpers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertCollabOsV1, collabOsV1Enabled } from "./collab-os";
import { isProductSwitchKey, setProductSwitchForTests } from "./product-switches";

describe("collab_os_v1 switch (L4)", () => {
  it("is a registered product switch", () => {
    assert.equal(isProductSwitchKey("collab_os_v1"), true);
  });

  it("defaults on and can be pinned off for tests", async () => {
    setProductSwitchForTests("collab_os_v1", true);
    assert.equal(await collabOsV1Enabled(), true);
    setProductSwitchForTests("collab_os_v1", false);
    assert.equal(await collabOsV1Enabled(), false);
    await assert.rejects(() => assertCollabOsV1(), /turned off/);
    setProductSwitchForTests("collab_os_v1", null);
  });
});
