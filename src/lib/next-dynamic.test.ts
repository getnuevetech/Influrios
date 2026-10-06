import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rethrowIfNextDynamicError } from "./next-dynamic";

describe("next dynamic errors", () => {
  it("rethrows a Next static bailout and ignores ordinary errors", () => {
    const bailout = Object.assign(new Error("Dynamic server usage"), { digest: "DYNAMIC_SERVER_USAGE" });
    assert.throws(() => rethrowIfNextDynamicError(bailout));
    assert.doesNotThrow(() => rethrowIfNextDynamicError(new Error("no database")));
    assert.doesNotThrow(() => rethrowIfNextDynamicError("scripts"));
  });
});
