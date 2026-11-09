import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applicationLinkPlan, classifyFundingLinks } from "./collaboration-links";

describe("collaboration link classification", () => {
  const collaborations = [
    { id: "c1", title: "Launch", recipientSlug: "maya" },
    { id: "c2", title: "Launch", recipientSlug: "maya" },
    { id: "c3", title: "Other", recipientSlug: "maya" },
  ];

  it("keeps an explicit id and does not merge two campaigns that share a title", () => {
    const findings = classifyFundingLinks(
      [
        { id: "f-linked", collaborationId: "c3", title: "Launch", creatorSlug: "maya" },
        { id: "f-ambiguous", collaborationId: null, title: "Launch", creatorSlug: "maya" },
        { id: "f-review", collaborationId: null, title: "Other", creatorSlug: "maya" },
        { id: "f-orphan", collaborationId: null, title: "Solo", creatorSlug: "maya" },
      ],
      collaborations,
    );
    assert.deepEqual(
      findings.map((row) => row.state),
      ["linked", "ambiguous", "review", "unlinked"],
    );
    assert.deepEqual(findings[1]?.candidateIds, ["c1", "c2"]);
  });

  it("creates a collaboration only when both parties are known", () => {
    assert.equal(applicationLinkPlan({ id: "a", status: "ACCEPTED", fromSlug: "brand", toSlug: "maya" }), "unlinked");
    assert.equal(applicationLinkPlan({ id: "a", status: "COLLABORATION_DRAFTED", fromSlug: "brand", toSlug: "maya" }), "create");
    assert.equal(applicationLinkPlan({ id: "a", status: "ACCEPTED", fromSlug: "maya", toSlug: null }), "unlinked");
    assert.equal(
      applicationLinkPlan({ id: "a", status: "ACCEPTED", collaborationId: "c1", fromSlug: "brand", toSlug: "maya" }),
      "keep",
    );
    assert.equal(applicationLinkPlan({ id: "a", status: "REQUESTED", fromSlug: "brand", toSlug: "maya" }), "keep");
  });
});
