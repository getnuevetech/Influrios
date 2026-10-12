import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  metricFreshnessLabel,
  profileNeedLines,
  profileNotePair,
  profileOfferLines,
  visibleFollowerCount,
} from "./profile-notes";

describe("profile offer, need, and metric freshness", () => {
  it("keeps a blank note blank and requires a summary for a detail", () => {
    assert.deepEqual(profileNotePair("  Tutorials  ", "  For brands  ", "Enter what you offer."), {
      summary: "Tutorials",
      details: "For brands",
    });
    assert.deepEqual(profileNotePair("", "", "Enter what you offer."), { summary: "", details: "" });
    assert.throws(() => profileNotePair("", "Only a detail", "Enter what you offer."), /Enter what you offer/);
    assert.deepEqual(profileOfferLines({ offers: [] }), []);
    assert.deepEqual(profileOfferLines({ offer: "Demo preview of a collaboration offer." }), [
      { summary: "Demo preview of a collaboration offer.", details: "" },
    ]);
    assert.deepEqual(profileNeedLines({ needs: [{ summary: "  ", details: "hidden" }] }), []);
    assert.deepEqual(profileNeedLines({ need: "Editors", needDetails: "Short form" }), [
      { summary: "Editors", details: "Short form" },
    ]);
  });

  it("shows a follower sync time only when one is stored", () => {
    assert.equal(
      metricFreshnessLabel({ source: "PROVIDER_SYNCED", refreshedAt: "2026-10-12T15:00:00.000Z" }),
      "Synced 12 Oct 2026",
    );
    assert.equal(
      metricFreshnessLabel({ source: "PLATFORM_VERIFIED", refreshedAt: "2026-10-12T00:00:00.000Z" }),
      "Verified 12 Oct 2026",
    );
    assert.equal(metricFreshnessLabel({ source: "PROVIDER_SYNCED", refreshedAt: "" }), "");
    assert.equal(metricFreshnessLabel({ source: "", refreshedAt: null }), "");
    assert.equal(visibleFollowerCount({ followers: 0, refreshedAt: "" }), null);
    assert.equal(visibleFollowerCount({ followers: 0, refreshedAt: "2026-10-12T15:00:00.000Z" }), "0");
    assert.equal(visibleFollowerCount({ followers: 1200, refreshedAt: "" }), "1.2K");
  });

  it("does not invent an offer or a sync time", () => {
    const directory = readFileSync("src/lib/directory.ts", "utf8");
    const profile = readFileSync("src/app/creators/[slug]/page.tsx", "utf8");
    const profileSave = readFileSync("src/app/claim/actions.ts", "utf8");
    const notesSave = readFileSync("src/app/dashboard/offer-actions.ts", "utf8");
    const dashboard = readFileSync("src/app/dashboard/page.tsx", "utf8");
    assert.equal(directory.includes("collaborationOffer.update"), false);
    assert.equal(directory.includes('|| "Collaboration"'), false);
    assert.match(profile, /profileOfferLines/);
    assert.match(profile, /metricFreshnessLabel/);
    const dashboardSave = profileSave.slice(
      profileSave.indexOf("export async function actionUpdateDashboardProfile"),
      profileSave.indexOf("export async function actionUpdateProfileMedia"),
    );
    assert.equal(dashboardSave.includes("offer"), false);
    assert.match(dashboard, /name="offer"/);
    assert.match(dashboard, /name="need"/);
    assert.match(notesSave, /get\("offerDetails"\)/);
    assert.match(notesSave, /get\("need"\)/);
  });
});
