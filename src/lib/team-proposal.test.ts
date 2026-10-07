import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  creatorAmountsForMilestone,
  equalShareBps,
  nextProposalStatus,
  proposalIsExpired,
  refuseMemberRemoval,
  teamFundingReady,
  teamMatchRows,
  teamSendControl,
  wizardHrefForProposal,
  wizardParties,
} from "./team-proposal";

describe("team proposals", () => {
  const members = [
    { creatorSlug: "a", status: "invited", shareBps: 5000 },
    { creatorSlug: "b", status: "invited", shareBps: 5000 },
  ];

  it("moves to partial when one creator accepts", () => {
    assert.equal(nextProposalStatus(members, "a", "accepted"), "partial");
  });

  it("opens the wizard only when both accept", () => {
    const afterFirst = [
      { creatorSlug: "a", status: "accepted", shareBps: 5000 },
      { creatorSlug: "b", status: "invited", shareBps: 5000 },
    ];
    assert.equal(nextProposalStatus(afterFirst, "b", "accepted"), "accepted");
    const href = wizardHrefForProposal({
      id: "prop_1",
      status: "accepted",
      title: "Spring launch",
      campaignIntent: "Launch the spring set",
      members: afterFirst.map((member) =>
        member.creatorSlug === "b" ? { ...member, status: "accepted" } : member,
      ),
    });
    assert.equal(wizardParties({ status: "accepted", members: afterFirst }) , null);
    assert.match(href ?? "", /^\/collaboration\/contract\?team=prop_1/);
    assert.match(href ?? "", /creator=a/);
    assert.match(href ?? "", /scope=Launch\+the\+spring\+set/);
  });

  it("does not open the wizard when one creator declines", () => {
    assert.equal(nextProposalStatus(members, "b", "declined"), "declined");
    assert.equal(
      wizardParties({
        status: "declined",
        members: [
          { creatorSlug: "a", status: "accepted", shareBps: 5000 },
          { creatorSlug: "b", status: "declined", shareBps: 5000 },
        ],
      }),
      null,
    );
    assert.equal(
      wizardHrefForProposal({
        id: "prop_2",
        status: "declined",
        title: "Spring launch",
        campaignIntent: "Launch",
        members: [
          { creatorSlug: "a", status: "accepted", shareBps: 5000 },
          { creatorSlug: "b", status: "declined", shareBps: 5000 },
        ],
      }),
      null,
    );
  });

  it("blocks funding until every payout route is ready", () => {
    assert.equal(teamFundingReady({ status: "sent", payoutReady: [true, true] }).ok, false);
    assert.equal(teamFundingReady({ status: "partial", payoutReady: [true, true] }).ok, false);
    assert.equal(teamFundingReady({ status: "accepted", payoutReady: [true, false] }).ok, false);
    assert.equal(teamFundingReady({ status: "accepted", payoutReady: [true] }).ok, false);
    assert.equal(teamFundingReady({ status: "accepted", payoutReady: [true, true] }).ok, true);
  });

  it("splits one milestone across the frozen creator shares", () => {
    assert.deepEqual(equalShareBps(2), [5000, 5000]);
    assert.deepEqual(equalShareBps(3), [3333, 3333, 3334]);
    assert.deepEqual(
      creatorAmountsForMilestone(10_000, [
        { creatorSlug: "a", shareBps: 5000 },
        { creatorSlug: "b", shareBps: 5000 },
      ]),
      [
        { creatorSlug: "a", amountCents: 5000 },
        { creatorSlug: "b", amountCents: 5000 },
      ],
    );
  });

  it("records a business-creator team match and a creator team match", () => {
    const rows = teamMatchRows({
      workspaceId: "ws_1",
      campaignIntent: "Launch the spring set",
      members: [{ creatorSlug: "b" }, { creatorSlug: "a" }],
    });
    assert.equal(rows.filter((row) => row.matchType === "BUSINESS_CREATOR_TEAM").length, 2);
    assert.equal(rows.filter((row) => row.matchType === "CREATOR_TEAM").length, 1);
    assert.equal(rows.every((row) => row.reasons.includes("Team proposal")), true);
    assert.equal(rows[0]?.why, "Launch the spring set");
  });

  it("refuses to drop a member from a sent proposal", () => {
    const removed = refuseMemberRemoval();
    assert.equal(removed.ok, false);
    assert.match(removed.error, /new proposal/);
  });

  it("keeps guest suggestions free of a team send action", () => {
    assert.equal(teamSendControl({ audience: "guest" }).visible, false);
    assert.equal(teamSendControl({ audience: "creator" }).visible, false);
    assert.equal(teamSendControl({ audience: "business" }).visible, true);
    const landing = readFileSync(new URL("../app/collaboration/page.tsx", import.meta.url), "utf8");
    assert.equal(landing.includes("actionSendTeamProposal"), false);
    assert.equal(landing.includes("teamProposal"), false);
  });

  it("expires an unanswered proposal and leaves an accepted one open", () => {
    const past = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date("2026-02-01T00:00:00.000Z");
    assert.equal(proposalIsExpired({ status: "sent", expiresAt: past, now }), true);
    assert.equal(proposalIsExpired({ status: "accepted", expiresAt: past, now }), false);
    assert.equal(proposalIsExpired({ status: "declined", expiresAt: past, now }), false);
  });
});
