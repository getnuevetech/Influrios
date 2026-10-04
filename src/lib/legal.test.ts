import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LEGAL_CATALOG, documentsForTrigger } from "./legal-catalog";

describe("legal trigger routing", () => {
  it("asks general registration only for platform terms and electronic consent", () => {
    const keys = documentsForTrigger(LEGAL_CATALOG, "registration", "acceptance").map((doc) => doc.key);
    assert.deepEqual(keys.sort(), ["electronic-consent", "terms-of-service"]);
    const notices = documentsForTrigger(LEGAL_CATALOG, "registration", "acknowledgement").map((doc) => doc.key);
    assert.deepEqual(notices, ["privacy-policy"]);
    assert.equal(keys.includes("creator-terms"), false);
    assert.equal(keys.includes("business-terms"), false);
  });

  it("keeps creator terms and social integration terms on creator claim, not on OAuth", () => {
    const claim = documentsForTrigger(LEGAL_CATALOG, "creator_claim", "acceptance").map((doc) => doc.key);
    assert.deepEqual(claim.sort(), ["creator-terms", "social-platform-integration-terms"]);
    const oauth = documentsForTrigger(LEGAL_CATALOG, "social_connect", "acceptance");
    assert.equal(oauth.length, 0);
    const notice = documentsForTrigger(LEGAL_CATALOG, "social_connect", "acknowledgement").map((doc) => doc.key);
    assert.deepEqual(notice, ["connected-social-data-policy"]);
  });

  it("does not publish a single master pack key", () => {
    assert.equal(LEGAL_CATALOG.some((doc) => doc.key.includes("master")), false);
  });

  it("acknowledges marketplace fee legal pack on collaboration trigger", () => {
    const keys = documentsForTrigger(LEGAL_CATALOG, "collaboration", "acknowledgement").map((doc) => doc.key);
    assert.ok(keys.includes("marketplace-terms"));
    assert.ok(keys.includes("protected-payments-policy"));
    const marketplace = LEGAL_CATALOG.find((doc) => doc.key === "marketplace-terms");
    assert.equal(marketplace?.version, "1.2");
    assert.match(
      String(marketplace?.title ?? ""),
      /Marketplace/i,
    );
  });
});
