import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { currentSubmittedVersion, reviewActorAllowed, reviewVersionDecision } from "./version-review";

const history = [
  { version: 1, status: "revision_requested" },
  { version: 2, status: "submitted" },
];

describe("version review", () => {
  it("keeps version 1 when version 2 is the one under review", () => {
    assert.equal(currentSubmittedVersion(history)?.version, 2);
    assert.equal(history[0]?.status, "revision_requested");
    const decision = reviewVersionDecision({ versions: history, requestedVersion: 2, intent: "approve" });
    assert.equal(decision.ok, true);
  });

  it("rejects approval of a superseded version and a revision without an explanation", () => {
    const stale = reviewVersionDecision({ versions: history, requestedVersion: 1, intent: "approve" });
    assert.equal(stale.ok, false);
    const blank = reviewVersionDecision({ versions: history, requestedVersion: 2, intent: "revise", note: "short" });
    assert.equal(blank.ok, false);
    const revise = reviewVersionDecision({
      versions: history,
      requestedVersion: 2,
      intent: "revise",
      note: "Please replace the opening frame.",
    });
    assert.equal(revise.ok, true);
  });

  it("checks the requested version before the existing approve and revision paths", () => {
    const source = readFileSync(new URL("../app/payments/actions.ts", import.meta.url), "utf8");
    const approve = source.slice(source.indexOf("export async function actionApproveMilestone"));
    const revise = source.slice(source.indexOf("export async function actionRequestRevision"), source.indexOf("export async function actionApproveMilestone"));
    assert.ok(approve.indexOf("reviewVersionDecision") < approve.indexOf("approveFundingMilestone"));
    assert.ok(revise.indexOf("reviewVersionDecision") < revise.indexOf("requestFundingRevision"));
    assert.equal(source.includes("executeHeldCancellation"), false);
    assert.equal(approve.includes("requireBusinessFundingAccess"), true);
  });

  it("lets only the influencer submit and only the business review", () => {
    assert.equal(reviewActorAllowed("creator", "submit"), true);
    assert.equal(reviewActorAllowed("business", "submit"), false);
    assert.equal(reviewActorAllowed("creator", "approve"), false);
    assert.equal(reviewActorAllowed("business", "approve"), true);
    assert.equal(reviewActorAllowed("creator", "revise"), false);
    assert.equal(reviewActorAllowed("business", "revise"), true);
  });
});
