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

  it("resolves DocuSign only when the saved credentials are complete", () => {
    const empty: Record<string, string | undefined> = {};
    assert.equal(resolveSigningMode("demo", null, empty), "demo");
    assert.equal(resolveSigningMode("docusign", null, empty), "unconfigured");
    assert.equal(
      resolveSigningMode(
        "docusign",
        {
          integrationKey: "key",
          userId: "user",
          accountId: "acct",
          privateKey: "pem",
          baseUrl: "https://demo.docusign.net",
        },
        empty,
      ),
      "docusign",
    );
  });

  it("accepts unsigned demo webhooks when secret is empty", () => {
    assert.equal(verifySigningWebhookSignature("{}", null, ""), true);
    assert.equal(verifySigningWebhookSignature("{}", null, "secret"), false);
  });
});
