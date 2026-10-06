import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampSmsBody, renderCommCopy, SMS_BODY_MAX } from "./comm-templates";

describe("comm templates", () => {
  it("renders {{variables}} in email and SMS copy", () => {
    assert.equal(
      renderCommCopy("Hi {{name}}, open {{link}}", { name: "Ada", link: "https://x.test" }),
      "Hi Ada, open https://x.test",
    );
  });

  it("clamps SMS bodies to about two segments", () => {
    const long = "x".repeat(SMS_BODY_MAX + 40);
    assert.equal(clampSmsBody(long).length, SMS_BODY_MAX);
  });
});
