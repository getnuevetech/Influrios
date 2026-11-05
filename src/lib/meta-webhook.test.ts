import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { describe, it } from "node:test";
import {
  metaWebhookPath,
  parseMetaWebhookPayload,
  verifyMetaSubscriptionChallenge,
  verifyMetaWebhookSignature,
} from "./meta-webhook";

describe("meta webhook verification", () => {
  it("exposes a dedicated webhook path separate from OAuth callback", () => {
    assert.equal(metaWebhookPath(), "/api/social/meta/webhook");
    assert.notEqual(metaWebhookPath(), "/api/social/callback");
  });

  it("returns the hub.challenge when mode and verify token match", () => {
    const ok = verifyMetaSubscriptionChallenge({
      mode: "subscribe",
      token: "influrios-meta-verify",
      challenge: "1234567890",
      expectedToken: "influrios-meta-verify",
    });
    assert.deepEqual(ok, { ok: true, challenge: "1234567890" });
  });

  it("rejects a wrong verify token or missing challenge", () => {
    const wrong = verifyMetaSubscriptionChallenge({
      mode: "subscribe",
      token: "nope",
      challenge: "123",
      expectedToken: "influrios-meta-verify",
    });
    assert.equal(wrong.ok, false);
    if (!wrong.ok) assert.equal(wrong.status, 403);

    const missing = verifyMetaSubscriptionChallenge({
      mode: "subscribe",
      token: "influrios-meta-verify",
      challenge: null,
      expectedToken: "influrios-meta-verify",
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.status, 400);
  });

  it("validates X-Hub-Signature-256 with the app secret", () => {
    const body = JSON.stringify({ object: "instagram", entry: [] });
    const secret = "meta-app-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
    assert.equal(verifyMetaWebhookSignature(body, signature, secret), true);
    assert.equal(verifyMetaWebhookSignature(body, signature, "other"), false);
    assert.equal(verifyMetaWebhookSignature(body, null, secret), false);
  });
});

describe("meta webhook payload parsing", () => {
  it("extracts object entry field changes", () => {
    const changes = parseMetaWebhookPayload({
      object: "instagram",
      entry: [
        {
          id: "17841435186981703",
          changes: [{ field: "comments", value: { id: "comment-1", from: { id: "user-9" } } }],
        },
      ],
    });
    assert.equal(changes.length, 1);
    assert.equal(changes[0]?.object, "instagram");
    assert.equal(changes[0]?.entryId, "17841435186981703");
    assert.equal(changes[0]?.field, "comments");
  });

  it("returns an empty list for malformed bodies", () => {
    assert.deepEqual(parseMetaWebhookPayload(null), []);
    assert.deepEqual(parseMetaWebhookPayload({ object: "instagram" }), []);
  });
});
