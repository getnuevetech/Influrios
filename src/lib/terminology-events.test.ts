import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalDirectoryEvent,
  LEGACY_TO_INFLUENCER_EVENTS,
  withLegacyEventMeta,
} from "./terminology-events";

describe("terminology-events", () => {
  it("maps legacy profile_viewed to influencer_profile_viewed", () => {
    assert.equal(canonicalDirectoryEvent("profile_viewed"), "influencer_profile_viewed");
    assert.equal(canonicalDirectoryEvent("search_submitted"), "influencer_search_submitted");
  });

  it("passes through already-canonical and unknown events", () => {
    assert.equal(canonicalDirectoryEvent("influencer_profile_viewed"), "influencer_profile_viewed");
    assert.equal(canonicalDirectoryEvent("custom_event"), "custom_event");
  });

  it("attaches legacyEventType meta for mapped writes", () => {
    assert.deepEqual(withLegacyEventMeta("profile_viewed", { slug: "sofia" }), {
      slug: "sofia",
      legacyEventType: "profile_viewed",
    });
    assert.deepEqual(withLegacyEventMeta("influencer_profile_viewed", { slug: "sofia" }), {
      slug: "sofia",
      legacyEventType: "profile_viewed",
    });
    assert.deepEqual(withLegacyEventMeta("influencer_invited", { id: "1" }), { id: "1" });
  });

  it("documents the legacy→canonical matrix", () => {
    assert.equal(LEGACY_TO_INFLUENCER_EVENTS.profile_viewed, "influencer_profile_viewed");
    assert.equal(LEGACY_TO_INFLUENCER_EVENTS.search_submitted, "influencer_search_submitted");
  });
});
