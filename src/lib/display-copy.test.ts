import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { isDeadSocialAvatar } from "./profile-media";

const read = (file: string) => readFileSync(file, "utf8");

describe("display and wording fixes from the live audit", () => {
  it("says influencer, not creator, in the business app and FAQ", () => {
    const home = read("src/app/business/home/page.tsx");
    for (const old of ["Discover Creators", "Saved Creators", "Suggested Creators for You", "This list does not invent"]) {
      assert.equal(home.includes(old), false, old);
    }
    assert.match(read("src/components/account-shell.tsx"), /Discover Influencers/);
    assert.match(read("src/lib/faq-catalog.ts"), /creator: "Influencers"/);
  });

  it("keeps internal and setup wording off member and public pages", () => {
    assert.equal(/admin-managed list/.test(read("src/app/dashboard/details/page.tsx")), false);
    assert.equal(/An admin turns on/.test(read("src/app/discover/page.tsx")), false);
    assert.equal(/SMTP/.test(read("src/app/account/reset/page.tsx")), false);
    assert.equal(/\ban admin\b/i.test(read("src/lib/faq-catalog.ts")), false);
  });

  it("shows people by name and handles without a doubled @", () => {
    assert.match(read("src/app/business/home/page.tsx"), /nameOf\(item\.creatorSlug\)/);
    assert.match(read("src/components/account/request-editor.tsx"), /creator\.handle\.replace\(\/\^@\+\/, ""\)/);
  });

  it("drops Facebook avatar lookups that no longer return images", () => {
    assert.equal(isDeadSocialAvatar("https://unavatar.io/facebook/jenks.ag"), true);
    assert.equal(isDeadSocialAvatar("https://unavatar.io/instagram/jenks.ag"), false);
    assert.equal(read("src/lib/claim.ts").includes("unavatar.io/facebook"), false);
  });

  it("does not nest forms in the landing editors", () => {
    for (const page of ["src/app/admin/business-landing/page.tsx", "src/app/admin/collaboration-landing/page.tsx"]) {
      assert.match(read(page), /<AdminUploadedImages\s+nested/);
    }
    assert.match(read("src/components/admin-uploaded-images.tsx"), /formAction=\{uploadAction\}/);
  });
});
