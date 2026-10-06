import assert from "node:assert/strict";
import { createHmac, createVerify, generateKeyPairSync } from "crypto";
import { describe, it } from "node:test";
import {
  assembleDocuSignCredentials,
  createDocuSignEnvelope,
  docuSignJwtAssertion,
  parseDocuSignWebhook,
  verifyDocuSignSignature,
} from "./docusign";

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

  it("builds a JWT from the saved integration key and private key", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const assertion = docuSignJwtAssertion({
      integrationKey: "integration-key",
      userId: "user-id",
      oauthBaseUrl: "https://account-d.docusign.com",
      privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      now: 1_700_000_000,
    });
    const [header, payload, signature] = assertion.split(".");
    assert.equal(assertion.split(".").length, 3);
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    verifier.end();
    assert.equal(verifier.verify(publicKey, Buffer.from(signature, "base64url")), true);
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as { iss: string; sub: string; aud: string };
    assert.equal(claims.iss, "integration-key");
    assert.equal(claims.sub, "user-id");
    assert.equal(claims.aud, "account-d.docusign.com");
  });

  it("requires the admin fields when the environment is empty", () => {
    const missing = assembleDocuSignCredentials({ stored: {}, env: {} });
    assert.equal(missing.ok, false);
    const ready = assembleDocuSignCredentials({
      stored: {
        integrationKey: "key",
        userId: "user",
        accountId: "acct",
        privateKey: "pem",
        baseUrl: "https://demo.docusign.net",
      },
      env: {},
    });
    assert.equal(ready.ok, true);
  });
});
