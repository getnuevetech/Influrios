import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { sidebarBadgeCounts, sidebarBadgeFor, sidebarBadgeLabel } from "./sidebar-badges";

describe("sidebar badges", () => {
  it("puts invitations and delivery on collaborations, signatures on contracts, and money on payments", () => {
    const counts = sidebarBadgeCounts({ invitations: 2, signatures: 1, work: 3, payments: 4 });
    assert.equal(counts.collaborations, 5);
    assert.equal(counts.contracts, 1);
    assert.equal(counts.payments, 4);
    assert.equal(sidebarBadgeFor("/collaboration/hub?view=collaborations", counts), 5);
    assert.equal(sidebarBadgeFor("/collaboration/business", counts), 5);
    assert.equal(sidebarBadgeFor("/collaboration/contracts", counts), 1);
    assert.equal(sidebarBadgeFor("/payments", counts), 4);
    assert.equal(sidebarBadgeFor("/creator/messages", counts), 0);
    assert.equal(sidebarBadgeLabel(12), "9+");
    assert.equal(sidebarBadgeLabel(0), "");
  });

  it("does not hang the contract count on messages", () => {
    const shell = readFileSync("src/components/account-shell.tsx", "utf8");
    assert.match(shell, /sidebarBadgeFor/);
    assert.equal(shell.includes('item.href === "/creator/messages" && unsignedContracts'), false);
    assert.equal(shell.includes("executeHeldCancellation"), false);
  });
});
