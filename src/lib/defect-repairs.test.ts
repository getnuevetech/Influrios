import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { countedActiveFundingIds } from "@/lib/collaboration-hub";

describe("identified defect repairs", () => {
  it("keeps a completed profile from wearing the verification icon", () => {
    const home = readFileSync("src/app/business/home/page.tsx", "utf8");
    const profileChip = home.slice(home.indexOf("trust.profile === \"Profile complete\""), home.indexOf("trust.showVerifiedBadge"));
    assert.equal(profileChip.includes("IconVerified"), false);
    assert.match(home, /profileUnavailable: Boolean\(profileLoad\.incident\)/);
    assert.match(home, /filter=open/);
    assert.match(home, /scope=active/);
    assert.match(home, /id="shortlist"/);
  });

  it("counts the same active collaborations the filtered list shows", () => {
    const ids = countedActiveFundingIds([
      { id: "open", status: "held", milestones: [{ status: "approved" }] },
      { id: "done", status: "completed", milestones: [{ status: "released" }] },
    ]);
    assert.deepEqual(ids, ["open"]);
    const records = readFileSync("src/app/collaboration/records/page.tsx", "utf8");
    assert.match(records, /countedActiveFundingIds/);
    assert.match(records, /scope === "active"/);
  });

  it("uses the shared dialog for invitation review and keeps duplicate-role success outside the catch", () => {
    const invitation = readFileSync("src/components/account/invitation-review.tsx", "utf8");
    assert.match(invitation, /AccountDialog/);
    assert.equal(invitation.includes('className="fixed inset-0 z-50"'), false);
    const admin = readFileSync("src/app/admin/actions-auth.ts", "utf8");
    const start = admin.indexOf("export async function actionDuplicateRole");
    const body = admin.slice(start, admin.indexOf("function isNavigationError"));
    const redirectAt = body.lastIndexOf("redirect(");
    const catchAt = body.lastIndexOf("} catch");
    assert.ok(redirectAt > catchAt);
    const button = readFileSync("src/components/admin-access-levels-ui.tsx", "utf8");
    assert.match(button, /disabled=\{pending\}/);
  });
});
