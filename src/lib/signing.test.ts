import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
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
    assert.equal(resolveSigningMode("demo", null, empty), "unconfigured");
    assert.equal(resolveSigningMode("demo_sign", null, empty), "unconfigured");
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

  it("rejects a webhook that has no secret", () => {
    assert.equal(verifySigningWebhookSignature("{}", null, ""), false);
    assert.equal(verifySigningWebhookSignature("{}", null, "secret"), false);
    const body = "{}";
    const signature = createHmac("sha256", "secret").update(body).digest("hex");
    assert.equal(verifySigningWebhookSignature(body, signature, "secret"), true);
    assert.equal(verifySigningWebhookSignature(body, signature, "other"), false);
  });

  it("does not mint a demo envelope or sign from a non-DocuSign body", () => {
    const signing = readFileSync("src/lib/signing.ts", "utf8");
    const providers = readFileSync("src/lib/providers.ts", "utf8");
    const route = readFileSync("src/app/api/signing/webhook/route.ts", "utf8");
    assert.equal(signing.includes("demosign_"), false);
    assert.equal(signing.includes("ensureDemoSigningProvider"), false);
    assert.equal(providers.includes("demosign_"), false);
    assert.match(providers, /DocuSign is the signing provider/);
    assert.match(route, /Nothing was signed/);
    assert.equal(route.split("applyContractEnvelopeEvent(").length - 1, 1);
  });
});
