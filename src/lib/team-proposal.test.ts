import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextProposalStatus, teamFundingReady } from "./team-proposal";

describe("team proposals", () => {
  const members = [
    { creatorSlug: "a", status: "invited" },
    { creatorSlug: "b", status: "invited" },
  ];

  it("stays sent until every member accepts", () => {
    assert.equal(nextProposalStatus(members, "a", "accepted"), "sent");
  });

  it("opens only when both accept", () => {
    const afterFirst = [
      { creatorSlug: "a", status: "accepted" },
      { creatorSlug: "b", status: "invited" },
    ];
    assert.equal(nextProposalStatus(afterFirst, "b", "accepted"), "accepted");
  });

  it("closes on one decline", () => {
    assert.equal(nextProposalStatus(members, "b", "declined"), "declined");
  });

  it("blocks funding until every payout route is ready", () => {
    assert.equal(teamFundingReady({ status: "sent", payoutReady: [true, true] }).ok, false);
    assert.equal(teamFundingReady({ status: "accepted", payoutReady: [true, false] }).ok, false);
    assert.equal(teamFundingReady({ status: "accepted", payoutReady: [true] }).ok, false);
    assert.equal(teamFundingReady({ status: "accepted", payoutReady: [true, true] }).ok, true);
  });
});
