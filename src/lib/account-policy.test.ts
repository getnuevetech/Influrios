import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideGuestGate, passwordError, safeNextPath } from "./account-policy";

describe("guest gate", () => {
  const limits = { soft: 3, hard: 5 };

  it("allows a signed-in visitor past the hard limit", () => {
    assert.equal(decideGuestGate(9, limits, true), "allow");
  });

  it("softens at the soft limit and blocks at the hard limit", () => {
    assert.equal(decideGuestGate(2, limits, false), "allow");
    assert.equal(decideGuestGate(3, limits, false), "soft");
    assert.equal(decideGuestGate(4, limits, false), "soft");
    assert.equal(decideGuestGate(5, limits, false), "hard");
  });

  it("keeps the soft limit from exceeding the hard limit", () => {
    assert.equal(decideGuestGate(2, { soft: 9, hard: 2 }, false), "hard");
  });
});

describe("return path", () => {
  it("keeps an in-app path and drops off-site targets", () => {
    assert.equal(safeNextPath("/creators/sofia-martinez"), "/creators/sofia-martinez");
    assert.equal(safeNextPath("https://evil.example/creators/sofia"), "/");
    assert.equal(safeNextPath("//evil.example"), "/");
    assert.equal(safeNextPath(""), "/");
  });
});

describe("password rules", () => {
  it("rejects short passwords", () => {
    assert.equal(passwordError("short"), "Use at least 8 characters.");
    assert.equal(passwordError("long-enough"), null);
  });

  it("uses the admin-configured minimum", () => {
    assert.equal(passwordError("long-enough", 12), "Use at least 12 characters.");
    assert.equal(passwordError("long-enough-pw", 12), null);
  });
});
