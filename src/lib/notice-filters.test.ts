import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  PAYOUT_RETURNED_NOTE,
  businessAttentionDrafts,
  noticeActor,
  noticeEventLabel,
  noticeFilterFromQuery,
  noticeGroup,
  noticeKeepsWorkApproved,
  noticeMatchesFilter,
  noticeNeedsAction,
} from "./notice-filters";

describe("notification centre filters", () => {
  it("groups invitations, work and payments separately from updates", () => {
    assert.equal(noticeGroup("invitation"), "invitations");
    assert.equal(noticeGroup("agreement", "Your signature is needed"), "work");
    assert.equal(noticeGroup("deliverable"), "work");
    assert.equal(noticeGroup("funding"), "payments");
    assert.equal(noticeGroup("payout_completed"), "payments");
    assert.equal(noticeGroup("profile_tip"), "updates");
  });

  it("keeps a completed payout out of action required and a returned payout in payments", () => {
    assert.equal(noticeNeedsAction("payout_completed", "Payout completed"), false);
    assert.equal(noticeNeedsAction("payout_returned", "Payout returned"), true);
    assert.equal(noticeMatchesFilter("payments", "payout_returned"), true);
    assert.equal(noticeMatchesFilter("work", "payout_returned"), false);
    assert.equal(noticeMatchesFilter("action", "invitation", "Campaign invitation"), true);
    assert.equal(noticeKeepsWorkApproved("payout_returned"), true);
    assert.match(PAYOUT_RETURNED_NOTE, /stays approved/);
    assert.match(PAYOUT_RETURNED_NOTE, /Nothing was refunded/);
  });

  it("names the actor and event without treating a read as task completion", () => {
    assert.equal(noticeActor("invitation", "New campaign invitation"), "Business");
    assert.equal(noticeActor("invitation", "Influencers have responded to your invites."), "Influencer");
    assert.equal(noticeActor("deliverable", "Submission from Northwind"), "Northwind");
    assert.equal(noticeEventLabel("payout_returned"), "Payout returned");
    assert.equal(noticeEventLabel("agreement"), "Signature");
    assert.equal(noticeFilterFromQuery("updates"), "all");
    assert.equal(noticeFilterFromQuery("work"), "work");
    const reader = readFileSync(new URL("./account-notices.ts", import.meta.url), "utf8");
    assert.match(reader, /readAt/);
    assert.equal(reader.includes("toStatus"), false);
    assert.equal(reader.includes("createFullRefund"), false);
  });

  it("builds business attention notices for responses, signatures, funding and review", () => {
    const drafts = businessAttentionDrafts({
      pendingResponses: 2,
      contracts: [{ id: "contract-1", title: "Spring brief" }],
      funding: [{ id: "deal-1", title: "Spring brief", href: "/payments?deal=deal-1" }],
      reviews: [{ id: "work-1", title: "Spring brief", counterparty: "Northwind", href: "/collaboration/work/work-1" }],
    });
    assert.deepEqual(drafts.map((row) => row.kind), ["invitation", "agreement", "funding", "deliverable"]);
    assert.equal(drafts[0]?.title, "2 responses to review");
    assert.equal(businessAttentionDrafts({ pendingResponses: 0, contracts: [], funding: [], reviews: [] }).length, 0);
  });
});
