import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanReply, newTicketToken, statusAfterMemberReply, ticketRef, ticketStatus, tokenMatches } from "@/lib/support-tickets";

describe("support tickets", () => {
  it("formats references and normalises statuses", () => {
    assert.equal(ticketRef(1001), "S-1001");
    assert.equal(ticketStatus("resolved"), "resolved");
    assert.equal(ticketStatus("made-up"), "open");
  });

  it("only the exact emailed token opens a ticket", () => {
    const token = newTicketToken();
    assert.equal(tokenMatches(token, token), true);
    assert.equal(tokenMatches(token, token.slice(1)), false);
    assert.equal(tokenMatches(token, ""), false);
    assert.equal(tokenMatches(token, null), false);
    assert.equal(tokenMatches("", ""), false);
  });

  it("a member reply re-opens the ticket unless it is closed", () => {
    assert.equal(statusAfterMemberReply("waiting_on_member"), "open");
    assert.equal(statusAfterMemberReply("resolved"), "open");
    assert.equal(statusAfterMemberReply("closed"), null);
  });

  it("rejects empty replies", () => {
    assert.equal(cleanReply("  ").ok, false);
    assert.equal(cleanReply(" Thanks! ").ok && cleanReply(" Thanks! ").ok, true);
  });
});
