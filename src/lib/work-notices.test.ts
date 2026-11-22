import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { noticeNeedsAction } from "./notice-filters";

const read = (file: string) => readFileSync(file, "utf8");

describe("work and money notices from the recorded local journey", () => {
  it("records in-app notices for work and money events even without email", () => {
    const jobs = read("src/lib/jobs.ts");
    const body = jobs.slice(jobs.indexOf("export async function notifyCollabFundingEvent("));
    assert.ok(body.indexOf("recordCollabInAppNotice(input)") < body.indexOf("mailReady()"));
    assert.match(jobs, /milestone_approved: "both"/);
  });

  it("treats approvals and completed payouts as information, submissions as tasks", () => {
    assert.equal(noticeNeedsAction("milestone_approved", "Milestone approved"), false);
    assert.equal(noticeNeedsAction("payout_completed", "Payout completed"), false);
    assert.equal(noticeNeedsAction("milestone_submitted", "Submission ready for review"), true);
  });

  it("names accepted private invitations by their agreement and counts every current collaboration", () => {
    assert.match(read("src/lib/collaboration-hub.ts"), /agreementTitle \|\| application\.note/);
    const home = read("src/lib/creator-home.ts");
    assert.match(home, /activeCollabs: currentCollaborations\.length/);
    assert.match(home, /workFirst/);
  });
});
