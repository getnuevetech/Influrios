import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  rightsAfterAcceptance,
  rightsAfterPaymentRelease,
  rightsIndependentOfAcceptance,
  RIGHTS_STATUS_LABELS,
} from "./content-rights";

describe("content rights vs payment (W3.10)", () => {
  it("keeps rights pending after acceptance when activate-on is release", () => {
    const after = rightsAfterAcceptance({ activateOn: "release" });
    assert.equal(after.status, "pending");
    assert.equal(RIGHTS_STATUS_LABELS.pending, "Rights pending");
  });

  it("activates early when parties agree rights on acceptance", () => {
    const after = rightsAfterAcceptance({ activateOn: "acceptance" });
    assert.equal(after.status, "waived_early");
  });

  it("activates rights on payment release by default", () => {
    const after = rightsAfterPaymentRelease({ activateOn: "release", currentStatus: "pending" });
    assert.equal(after.shouldActivate, true);
    assert.equal(after.status, "active");
  });

  it("does not re-activate already active rights", () => {
    const after = rightsAfterPaymentRelease({ activateOn: "release", currentStatus: "active" });
    assert.equal(after.shouldActivate, false);
    assert.equal(after.status, "active");
  });

  it("treats approved+pending rights as separate from acceptance", () => {
    assert.equal(
      rightsIndependentOfAcceptance({ milestoneStatus: "approved", rightsStatus: "pending" }),
      true,
    );
  });
});
