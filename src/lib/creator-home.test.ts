import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifySocialRow,
  countByRecentDays,
  displayBio,
  mediaKitPhotos,
  sharedCurrency,
  visitDelta,
} from "./creator-home";

describe("creator home facts", () => {
  it("hides claim-template bios and brand-default media", () => {
    assert.equal(
      displayBio(
        "Influencer Profile for @ag.olomola-2. Confirm specialties, bio, and location after you claim — nothing publishes until you say so.",
      ),
      "",
    );
    assert.equal(displayBio("I film weekly kitchen recipes from Accra."), "I film weekly kitchen recipes from Accra.");
    assert.deepEqual(mediaKitPhotos("/brand/avatars/male.png", "/brand/banners/rooftop-crew.png"), []);
    assert.deepEqual(mediaKitPhotos("/uploads/me.jpg", "/uploads/me.jpg"), ["/uploads/me.jpg"]);
    assert.deepEqual(mediaKitPhotos("/uploads/me.jpg", "/uploads/cover.jpg"), ["/uploads/me.jpg", "/uploads/cover.jpg"]);
  });

  it("counts a social as connected only after OAuth, and followers only after a sync", () => {
    const typed = classifySocialRow({
      id: "1",
      platform: "TIKTOK",
      handle: "@ag.olomola",
      followers: 8200,
      source: "CREATOR_CLAIMED",
      refreshedAt: null,
      connectionStatus: null,
      lastError: null,
    });
    assert.equal(typed.status, "on_card");
    assert.equal(typed.followers, null);
    const live = classifySocialRow({
      id: "2",
      platform: "YOUTUBE",
      handle: "@ag.olomola",
      followers: 4100,
      source: "PROVIDER_SYNCED",
      refreshedAt: new Date("2026-11-01T00:00:00.000Z"),
      connectionStatus: "connected",
      lastError: null,
    });
    assert.equal(live.status, "connected");
    assert.equal(live.followers, 4100);
  });

  it("builds a visit series from event times and does not invent a currency", () => {
    const now = Date.parse("2026-11-08T12:00:00.000Z");
    const series = countByRecentDays(
      [new Date("2026-11-08T01:00:00.000Z"), new Date("2026-11-07T01:00:00.000Z")],
      7,
      now,
    );
    assert.equal(series.reduce((sum, n) => sum + n, 0), 2);
    assert.equal(series[6], 1);
    assert.equal(series[5], 1);
    assert.equal(visitDelta([0, 0, 0, 0, 0, 0, 0]), null);
    assert.equal(sharedCurrency([]), "");
    assert.equal(sharedCurrency(["usd", "USD"]), "USD");
    assert.equal(sharedCurrency(["USD", "KES"]), "");
  });
});
