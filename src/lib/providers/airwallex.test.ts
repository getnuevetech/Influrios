import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { describe, it } from "node:test";
import { createAirwallexFunding, parseAirwallexWebhook, verifyAirwallexSignature } from "./airwallex";

describe("Airwallex adapter", () => {
  const secret = "awx-secret";
  const held = JSON.stringify({
    id: "evt-1",
    name: "payment_intent.succeeded",
    data: { object: { id: "int-1", amount: 5000, metadata: { fundingId: "fund-1" } } },
  });

  it("verifies the webhook and maps hold and release without double-parsing a new id", () => {
    const signature = createHmac("sha256", secret).update(held).digest("hex");
    assert.equal(verifyAirwallexSignature(held, signature, secret), true);
    assert.equal(verifyAirwallexSignature(held, "nope", secret), false);
    const parsed = parseAirwallexWebhook(held);
    assert.equal(parsed.ok && parsed.eventType, "funding.held");
    assert.equal(parsed.ok && parsed.eventId, "evt-1");
    const again = parseAirwallexWebhook(held);
    assert.equal(again.ok && parsed.ok && again.eventId === parsed.eventId, true);
  });

  it("creates one payment with a split per milestone to the same connected account", async () => {
    let seen = "";
    const result = await createAirwallexFunding({
      baseUrl: "https://api-demo.airwallex.com",
      token: "token",
      request: {
        fundingId: "fund-1",
        amountCents: 5000,
        currency: "USD",
        holdingAccountId: "hold-acct",
        splits: [
          { milestoneId: "m1", amountCents: 2500, connectedAccountId: "acct-creator" },
          { milestoneId: "m2", amountCents: 2500, connectedAccountId: "acct-creator" },
        ],
      },
      fetchImpl: async (_url, init) => {
        seen = String(init?.body ?? "");
        return new Response(JSON.stringify({ id: "int-1", funds_split: [{ id: "s1" }, { id: "s2" }] }), { status: 201 });
      },
    });
    assert.equal(result.ok && result.splitIds.length, 2);
    assert.match(seen, /acct-creator/);
    assert.match(seen, /hold-acct/);
  });
});
