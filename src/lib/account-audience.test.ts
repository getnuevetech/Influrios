import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accountAudience,
  accountAudienceFromRole,
  isBusinessRole,
  isCreatorRole,
} from "./account-audience";

describe("account audience separation", () => {
  it("maps roles without falling back to business for creators", () => {
    assert.equal(accountAudienceFromRole("CREATOR"), "creator");
    assert.equal(accountAudienceFromRole("BUSINESS"), "business");
    assert.equal(accountAudienceFromRole("AGENCY"), "business");
    assert.equal(accountAudienceFromRole("ADMIN"), "creator");
    assert.equal(accountAudienceFromRole(null), "creator");
    assert.equal(accountAudienceFromRole(undefined), "creator");
  });

  it("exposes role predicates used by route guards", () => {
    assert.equal(isBusinessRole("BUSINESS"), true);
    assert.equal(isBusinessRole("AGENCY"), true);
    assert.equal(isBusinessRole("CREATOR"), false);
    assert.equal(isCreatorRole("CREATOR"), true);
    assert.equal(isCreatorRole("BUSINESS"), false);
  });

  it("reads audience from a session-shaped object", () => {
    assert.equal(accountAudience({ role: "CREATOR" }), "creator");
    assert.equal(accountAudience({ role: "BUSINESS" }), "business");
    assert.equal(accountAudience(null), "creator");
  });
});

describe("getWorkspace never provisions for creators", () => {
  it("documents that creator roles stay on the public workspace", async () => {
    // Behavioral coverage lives in business-tenancy tests when DATABASE_URL is set.
    assert.equal(accountAudienceFromRole("CREATOR"), "creator");
  });
});
