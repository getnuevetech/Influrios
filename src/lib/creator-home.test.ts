import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifySocialRow,
  isClaimPlaceholderHandle,
  countByRecentDays,
  deliverableWhen,
  displayBio,
  earningsSummaryNote,
  mediaKitPhotos,
  portraitAt,
  sharedCurrency,
  visitDelta,
} from "./creator-home";

describe("creator home facts", () => {
  it("does not describe a failed earnings load as zero", () => {
    assert.equal(earningsSummaryNote({ failed: true, currency: "", cents: 0 }), "Earnings could not be loaded. This is not zero.");
    assert.equal(earningsSummaryNote({ failed: false, currency: "", cents: 0 }), "Nothing released this month.");
    assert.equal(earningsSummaryNote({ failed: false, currency: "USD", cents: 45000 }), "Released to you this month.");
  });

  it("rotates example portraits by index and labels a due deliverable", () => {
    const images = [
      { src: "/a.png", gender: "female" as const },
      { src: "/b.png", gender: "male" as const },
    ];
    assert.equal(portraitAt(images, 0)?.src, "/a.png");
    assert.equal(portraitAt(images, 1)?.gender, "male");
    assert.equal(portraitAt(images, 2)?.src, "/a.png");
    assert.equal(portraitAt([], 0), null);
    const due = deliverableWhen(new Date("2026-11-13T18:00:00Z"), new Date("2026-11-08T18:00:00Z"));
    assert.match(due, /^Deliverable due /);
  });

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
    assert.equal(live.handle, "@ag.olomola");
    const signedIn = classifySocialRow({
      id: "3",
      platform: "YOUTUBE",
      handle: "@ag.olomola",
      followers: null,
      source: "CREATOR_CLAIMED",
      refreshedAt: null,
      connectionStatus: "connected",
      lastError: null,
      slug: "ag-olomola-2",
    });
    assert.equal(signedIn.handle, "");
    assert.match(signedIn.detail ?? "", /Sync now/);
    const displayName = classifySocialRow({
      id: "4",
      platform: "X",
      handle: "@Agboola O. Olomola",
      followers: 223,
      source: "PROVIDER_SYNCED",
      refreshedAt: new Date("2026-11-08T00:00:00.000Z"),
      connectionStatus: "connected",
      lastError: null,
    });
    assert.equal(displayName.handle, "");
    assert.equal(displayName.followers, 223);
    const username = classifySocialRow({
      id: "5",
      platform: "X",
      handle: "@agboola",
      followers: 223,
      source: "PROVIDER_SYNCED",
      refreshedAt: new Date("2026-11-08T00:00:00.000Z"),
      connectionStatus: "connected",
      lastError: null,
    });
    assert.equal(username.handle, "@agboola");
    assert.equal(isClaimPlaceholderHandle("@ag.olomola", "ag-olomola-2"), true);
    const onCard = classifySocialRow({
      id: "6",
      platform: "INSTAGRAM",
      handle: "@ag.olomola",
      followers: null,
      source: "CREATOR_CLAIMED",
      refreshedAt: null,
      connectionStatus: null,
      lastError: null,
      slug: "ag-olomola-2",
    });
    assert.equal(onCard.handle, "");
    assert.equal(onCard.status, "on_card");
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
