import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { briefRecruitmentFilled } from "./business";

describe("campaign recruitment capacity", () => {
  it("closes only the brief whose seats are full", () => {
    assert.equal(briefRecruitmentFilled({ slots: 1, acceptedCount: 1 }), true);
    assert.equal(briefRecruitmentFilled({ slots: 3, acceptedCount: 1 }), false);
    assert.equal(briefRecruitmentFilled({ slots: 3, acceptedCount: 3 }), true);
    assert.equal(briefRecruitmentFilled({ slots: 0, acceptedCount: 1 }), true);
  });
});
