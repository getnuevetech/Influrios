import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  canAdvanceSignatureStatus,
  resolveSigningMode,
  verifySigningWebhookSignature,
} from "@/lib/signing";
import { applyNativeSignatureAnchor, formatNativeAttestation, isNativeSigningCode } from "@/lib/signing/native";

describe("signing lifecycle", () => {
  it("allows queued → sent → viewed → signed", () => {
    assert.equal(canAdvanceSignatureStatus("queued", "sent"), true);
    assert.equal(canAdvanceSignatureStatus("sent", "viewed"), true);
    assert.equal(canAdvanceSignatureStatus("viewed", "signed"), true);
    assert.equal(canAdvanceSignatureStatus("signed", "voided"), false);
    assert.equal(canAdvanceSignatureStatus("queued", "signed"), false);
  });

  it("resolves mode from the admin-enabled provider only", () => {
    const empty: Record<string, string | undefined> = {};
    assert.equal(resolveSigningMode("influrios", null, empty), "native");
    assert.equal(resolveSigningMode("native", null, empty), "native");
    assert.equal(resolveSigningMode("", null, empty), "unconfigured");
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

  it("documents that enabling a signing provider disables the others", () => {
    const providers = readFileSync("src/lib/providers.ts", "utf8");
    assert.match(providers, /Signing channels are mutually exclusive/);
    assert.match(providers, /kind: "signing"/);
    assert.match(providers, /enabled: false/);
  });

  it("rejects a webhook that has no secret", () => {
    assert.equal(verifySigningWebhookSignature("{}", null, ""), false);
    assert.equal(verifySigningWebhookSignature("{}", null, "secret"), false);
    const body = "{}";
    const signature = createHmac("sha256", "secret").update(body).digest("hex");
    assert.equal(verifySigningWebhookSignature(body, signature, "secret"), true);
    assert.equal(verifySigningWebhookSignature(body, signature, "other"), false);
  });

  it("keeps DocuSign optional and does not mint a demo envelope", () => {
    const signing = readFileSync("src/lib/signing.ts", "utf8");
    const providers = readFileSync("src/lib/providers.ts", "utf8");
    const route = readFileSync("src/app/api/signing/webhook/route.ts", "utf8");
    const contract = readFileSync("src/lib/contract-document.ts", "utf8");
    assert.equal(signing.includes("demosign_"), false);
    assert.equal(signing.includes("ensureDemoSigningProvider"), false);
    assert.equal(providers.includes("demosign_"), false);
    assert.match(providers, /influrios/);
    assert.match(providers, /Influrios in-app signing/);
    assert.match(contract, /signNativeContractParty/);
    assert.match(contract, /signingChannel/);
    assert.match(route, /Nothing was signed/);
    assert.equal(route.split("applyContractEnvelopeEvent(").length - 1, 1);
  });

  it("formats native attestation and replaces signature anchors", () => {
    assert.equal(isNativeSigningCode("influrios"), true);
    assert.equal(isNativeSigningCode("docusign"), false);
    const at = new Date("2026-10-18T12:00:00.000Z");
    const line = formatNativeAttestation({
      role: "business",
      typedName: "North Co",
      email: "north@example.com",
      signedAt: at,
    });
    assert.match(line, /Signed in Influrios/);
    assert.match(line, /North Co/);
    assert.equal(applyNativeSignatureAnchor("Hello\n/sig1/\nBye", 1, line), `Hello\n${line}\nBye`);
  });
});
