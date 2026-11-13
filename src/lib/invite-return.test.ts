import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { inviteTokenFromReturn, loginDestination } from "./invite-return";

describe("invite login return", () => {
  it("returns to the invite only for the named recipient", () => {
    const next = "/invite/opaque-token";
    assert.deepEqual(inviteTokenFromReturn(next), { kind: "card", token: "opaque-token" });
    assert.equal(
      loginDestination({
        next,
        accountEmail: "Ada@Example.com",
        recipientEmail: "ada@example.com",
        fallback: "/creator",
      }),
      next,
    );
    assert.equal(
      loginDestination({
        next,
        accountEmail: "other@example.com",
        recipientEmail: "ada@example.com",
        fallback: "/creator",
      }),
      "/creator",
    );
    assert.equal(
      loginDestination({
        next,
        accountEmail: "ada@example.com",
        recipientEmail: null,
        fallback: "/creator",
      }),
      "/creator",
    );
  });

  it("keeps an ordinary return path and covers agency seat invites", () => {
    assert.equal(
      loginDestination({
        next: "/dashboard",
        accountEmail: "ada@example.com",
        recipientEmail: null,
        fallback: "/creator",
      }),
      "/dashboard",
    );
    assert.deepEqual(inviteTokenFromReturn("/agency/invite/seat-token?error=1"), {
      kind: "agency",
      token: "seat-token",
    });
    assert.equal(
      loginDestination({
        next: "/agency/invite/seat-token",
        accountEmail: "ada@example.com",
        recipientEmail: "other@example.com",
        fallback: "/business",
      }),
      "/business",
    );
  });

  it("is applied after login and does not open the invite while checking", () => {
    const actions = readFileSync("src/app/account/actions.ts", "utf8");
    const lookup = readFileSync("src/lib/invite-return.ts", "utf8");
    assert.match(actions, /recipientEmailForReturn/);
    assert.match(actions, /loginDestination/);
    assert.equal(lookup.includes("openInvitation"), false);
  });
});
