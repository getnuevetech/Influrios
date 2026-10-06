import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { describe, it } from "node:test";
import { createDocuSignEnvelope, parseDocuSignWebhook, verifyDocuSignSignature } from "./docusign";

describe("DocuSign adapter", () => {
  const secret = "connect-secret";
  const body = JSON.stringify({
    event: "envelope-completed",
    data: { envelopeId: "env-1", envelopeSummary: { status: "completed" } },
  });

  it("verifies the Connect HMAC and rejects a forged body", () => {
    const signature = createHmac("sha256", secret).update(body).digest("base64");
    assert.equal(verifyDocuSignSignature(body, signature, secret), true);
    assert.equal(verifyDocuSignSignature(body + "x", signature, secret), false);
    assert.equal(verifyDocuSignSignature(body, null, secret), false);
  });

  it("parses a completed envelope and ignores a duplicate event id", () => {
    const first = parseDocuSignWebhook(body);
    const second = parseDocuSignWebhook(body);
    assert.equal(first.ok && second.ok && first.eventId === second.eventId, true);
    if (first.ok) assert.equal(first.status, "completed");
    assert.equal(parseDocuSignWebhook("{").ok, false);
  });

  it("creates an envelope and surfaces a provider error", async () => {
    const created = await createDocuSignEnvelope({
      baseUrl: "https://demo.docusign.net",
      accountId: "acct",
      accessToken: "token",
      request: {
        collaborationId: "col-1",
        title: "Launch",
        documentHtml: "<p>Terms</p>",
        parties: [{ name: "Ada", email: "ada@example.com" }],
      },
      fetchImpl: async () => new Response(JSON.stringify({ envelopeId: "env-9" }), { status: 201 }),
    });
    assert.equal(created.ok && created.envelopeId, "env-9");
    const failed = await createDocuSignEnvelope({
      baseUrl: "https://demo.docusign.net",
      accountId: "acct",
      accessToken: "token",
      request: {
        collaborationId: "col-1",
        title: "Launch",
        documentHtml: "<p>Terms</p>",
        parties: [],
      },
    });
    assert.equal(failed.ok, false);
  });
});
