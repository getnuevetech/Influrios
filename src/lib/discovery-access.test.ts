import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { discoverScrollKey, domesticInviteDecision, publicProfileAllowed } from "./discovery-access";

describe("discovery access", () => {
  it("hides a restricted or unpublished card and keeps a roster profile with no card", () => {
    assert.equal(publicProfileAllowed({ profileState: "RESTRICTED", cardPublished: true }), false);
    assert.equal(publicProfileAllowed({ profileState: "CLAIMED", cardPublished: false }), false);
    assert.equal(publicProfileAllowed({ profileState: "UNCLAIMED", cardPublished: null }), true);
    assert.equal(publicProfileAllowed({ profileState: "VERIFIED", cardPublished: true }), true);
  });

  it("keeps the same scroll key when a profile opens and ignores a swapped country", () => {
    assert.equal(
      discoverScrollKey("/discover?country=Nigeria&profile=ada"),
      discoverScrollKey("/discover?country=Nigeria"),
    );
    const blocked = domesticInviteDecision({
      businessCountry: "NG",
      influencerCountry: "GB",
      selectedCountry: "NG",
      crossBorderAllowed: false,
    });
    assert.equal(blocked.ok, false);
    assert.equal(
      domesticInviteDecision({
        businessCountry: "NG",
        influencerCountry: "NG",
        selectedCountry: "GB",
        crossBorderAllowed: false,
      }).ok,
      true,
    );
    assert.equal(
      domesticInviteDecision({
        businessCountry: null,
        influencerCountry: "GB",
        selectedCountry: "NG",
        crossBorderAllowed: false,
      }).ok,
      true,
    );
  });

  it("checks publication on the public profile paths and restores the directory scroll", () => {
    const directory = readFileSync("src/lib/directory.ts", "utf8");
    const discover = readFileSync("src/app/discover/page.tsx", "utf8");
    const profile = readFileSync("src/app/creators/[slug]/page.tsx", "utf8");
    const card = readFileSync("src/app/c/[slug]/page.tsx", "utf8");
    const qr = readFileSync("src/app/api/qr/[slug]/route.ts", "utf8");
    const actions = readFileSync("src/app/collaboration/business/actions.ts", "utf8");
    assert.match(directory, /publicProfileAllowed/);
    assert.equal(directory.includes('row.profileState === "VERIFIED"'), false);
    assert.match(profile, /getDirectoryCreator/);
    assert.match(card, /getDirectoryCreator/);
    assert.ok(qr.indexOf("await getDirectoryCreator") > -1);
    assert.match(discover, /scroll=\{false\}/);
    assert.match(discover, /DiscoverScrollMemory/);
    const inviteAt = actions.indexOf("inviteCreatorsIndependently");
    assert.ok(actions.indexOf("domesticInviteDecision") < inviteAt);
    assert.equal(actions.includes("executeHeldCancellation"), false);
  });
});
