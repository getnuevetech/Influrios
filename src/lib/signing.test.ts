import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAdvanceSignatureStatus,
  resolveSigningMode,
  verifySigningWebhookSignature,
} from "@/lib/signing";

describe("signing lifecycle", () => {
  it("allows queued → sent → viewed → signed", () => {
    assert.equal(canAdvanceSignatureStatus("queued", "sent"), true);
    assert.equal(canAdvanceSignatureStatus("sent", "viewed"), true);
    assert.equal(canAdvanceSignatureStatus("viewed", "signed"), true);
    assert.equal(canAdvanceSignatureStatus("signed", "voided"), false);
    assert.equal(canAdvanceSignatureStatus("queued", "signed"), false);
  });

  it("resolves demo mode unless DocuSign env is ready", () => {
    assert.equal(resolveSigningMode("demo"), "demo");
    assert.equal(resolveSigningMode("docusign"), "demo");
  });

  it("accepts unsigned demo webhooks when secret is empty", () => {
    assert.equal(verifySigningWebhookSignature("{}", null, ""), true);
    assert.equal(verifySigningWebhookSignature("{}", null, "secret"), false);
  });
});
