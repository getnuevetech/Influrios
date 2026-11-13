import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countryChangeOutcome,
  pendingCountryRequest,
  profileCountryAfterChange,
} from "./country-review";

describe("verified country review", () => {
  it("keeps a verified country until review instead of applying the edit", () => {
    const blocked = profileCountryAfterChange({
      identityVerified: true,
      currentCountry: "United States",
      requestedCountry: "Canada",
    });
    assert.equal(blocked.country, "United States");
    assert.equal(blocked.pendingReview, "Canada");
    assert.equal(
      countryChangeOutcome({
        identityVerified: true,
        currentCountry: "United States",
        requestedCountry: "Canada",
      }).kind,
      "review",
    );
  });

  it("applies a country edit before identity is verified", () => {
    const open = profileCountryAfterChange({
      identityVerified: false,
      currentCountry: "United States",
      requestedCountry: "Canada",
    });
    assert.equal(open.country, "Canada");
    assert.equal(open.pendingReview, null);
  });

  it("treats the latest approve or reject as the end of the request", () => {
    assert.equal(
      pendingCountryRequest([
        { action: "country_change.requested", requestedCountry: "Canada", at: "2026-01-01T00:00:00.000Z" },
        { action: "country_change.approved", requestedCountry: "Canada", at: "2026-01-02T00:00:00.000Z" },
      ]),
      null,
    );
    assert.equal(
      pendingCountryRequest([
        { action: "country_change.approved", requestedCountry: "Canada", at: "2026-01-01T00:00:00.000Z" },
        { action: "country_change.requested", requestedCountry: "Kenya", at: "2026-02-01T00:00:00.000Z" },
      ]),
      "Kenya",
    );
  });
});
