import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { businessApplicationLabel } from "./invitation-turn";
import { invitationNoticeSource } from "./notice-tasks";

const read = (file: string) => readFileSync(file, "utf8");

describe("applications to public requests reach both sides (recorded journey breaks)", () => {
  it("labels an open application as waiting on the business, not the influencer", () => {
    assert.equal(businessApplicationLabel({ status: "REQUESTED" }, "Ada"), "Ada applied · waiting for your decision");
    assert.equal(businessApplicationLabel({ status: "ACCEPTED" }, "Ada"), "Accepted · agreement not sent");
    assert.equal(businessApplicationLabel({ status: "DECLINED" }, "Ada"), "Declined");
  });

  it("tracks the business's application notice against the live application", () => {
    assert.deepEqual(invitationNoticeSource({ kind: "application_received", sourceId: "application_received:app1" }), {
      type: "application",
      id: "app1",
      role: "business-application",
    });
    assert.match(read("src/lib/notice-tasks.ts"), /liveAgreementNotices/);
  });

  it("notifies the business on apply and the influencer on the decision", () => {
    assert.match(read("src/app/collaboration/hub/actions.ts"), /notifyBusinessOfApplication\(createdId\)/);
    assert.match(read("src/app/collaboration/applications/actions.ts"), /notifyApplicantOfDecision/);
    const home = read("src/app/business/home/page.tsx");
    assert.match(home, /Review an application/);
    assert.match(home, /applicationTasks\.length/);
  });

  it("shows the business only Accept and Decline on an application, and correct wording to the influencer", () => {
    const page = read("src/app/collaboration/applications/[id]/page.tsx");
    assert.match(page, /status === "ACCEPTED" \|\| status === "DECLINED"/);
    assert.match(page, /The business accepted your application/);
    assert.match(read("src/components/account/business-collaborations.tsx"), /Responses \(\$\{selectedRequestApps\.length\}\)/);
  });
});
