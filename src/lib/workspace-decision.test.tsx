import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceDialogBody, WorkspaceMilestoneTable } from "../components/workspace-milestones";
import { hidesMarketingChrome } from "./chrome-routes";
import { memberDealView } from "./member-deal-money";
import {
  approveWorkspaceVersion,
  milestoneAmountColumnLabel,
  paymentHistory,
  requestWorkspaceChanges,
  submitWorkspaceVersion,
  workspaceDecision,
  workspaceSummaryLines,
  type WorkspaceMilestoneState,
} from "./workspace-decision";

const actor = { audience: "creator" as const, assigned: true };
const business = { audience: "business" as const, assigned: false };

function state(patch: Partial<WorkspaceMilestoneState> = {}): WorkspaceMilestoneState {
  return {
    fundingStatus: "held",
    milestoneStatus: "submitted",
    revisionCount: 0,
    revisionLimit: 2,
    disputeOpen: false,
    payoutConfirmed: false,
    bankPayoutConfirmed: false,
    submissions: [
      { version: 1, status: "submitted", note: "First cut", linkUrl: "https://example.com/v1", reviewNote: "" },
    ],
    ...patch,
  };
}

function rowHtml(decision: ReturnType<typeof workspaceDecision>, href: string) {
  return renderToStaticMarkup(
    <WorkspaceMilestoneTable
      amountHeading="Amount"
      rows={[
        {
          id: "m1",
          name: "Draft delivery",
          amount: "$1,178",
          workStatus: decision.workStatus,
          workTone: decision.workTone,
          paymentStatus: decision.paymentStatus,
          bankLine: decision.bankLine,
          actionLabel: decision.action.label,
          actionHref: href,
          nextActor: decision.nextActor,
          note: decision.holdReason,
        },
      ]}
    />,
  );
}

describe("workspace decision", () => {
  it("requests changes, accepts version 2, and names that version in the payment history", () => {
    const revised = requestWorkspaceChanges(state(), {
      version: 1,
      note: "Can you adjust some of the outputs well?",
    });
    assert.equal(revised.ok, true);
    if (!revised.ok) return;
    const influencer = workspaceDecision(revised.state, actor);
    assert.equal(influencer.action.kind, "submit_revision");
    assert.equal(influencer.action.label, "Submit revision");
    assert.equal(influencer.nextActor, "Next step: Submit revision");
    assert.equal(influencer.feedback?.version, 1);
    assert.match(influencer.feedback?.note ?? "", /adjust some of the outputs/);

    const submitted = submitWorkspaceVersion(revised.state, {
      note: "Adjusted the opening frames",
      linkUrl: "https://example.com/v2",
    });
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    assert.equal(submitted.state.submissions.length, 2);
    assert.equal(submitted.state.submissions[1]?.version, 2);
    assert.equal(submitted.state.submissions[1]?.status, "submitted");
    assert.equal(submitted.state.milestoneStatus, "submitted");

    const review = workspaceDecision(submitted.state, business);
    assert.equal(review.action.label, "Review version 2");
    assert.equal(review.nextActor, "Next step: Review version 2");
    assert.equal(review.action.kind, "review");
    assert.match(review.history.join("\n"), /Version 1 · Revision requested/);
    assert.match(review.history.join("\n"), /Can you adjust some of the outputs well\?/);
    assert.match(review.history.join("\n"), /Version 2 · Submitted/);
    const row = rowHtml(review, "/collaboration/work/deal?focus=m1&intent=review");
    assert.match(row, /Review version 2/);
    assert.equal(row.includes("Submit revision"), false);
    assert.equal(row.includes("Request changes"), false);
    assert.equal((row.match(/Review version 2/g) ?? []).length, 2);

    const dialog = renderToStaticMarkup(
      <WorkspaceDialogBody
        title="Review version 2"
        subtitle="Draft delivery · Version 2"
        closeHref="/collaboration/work/deal?tab=milestones"
        feedback={review.feedback}
        history={review.history}
        paymentHistory={review.paymentHistory}
        holdReason={null}
        bankLine={null}
        mode="review"
        showSubmitForm={false}
        submitLabel={null}
        reviewVersion={2}
        canRequestChanges={review.canRequestChanges}
        approveHref="/collaboration/work/deal?release=m1&version=2"
        dealId="deal"
        milestoneId="m1"
        tab="milestones"
        reviseAction={async () => undefined}
      />,
    );
    assert.match(dialog, /Feedback on version 1/);
    assert.match(dialog, /Version 1/);
    assert.match(dialog, /Version 2/);
    assert.equal(dialog.includes("Submit revision"), false);

    const approved = approveWorkspaceVersion(submitted.state, 2);
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    assert.equal(approved.state.payoutConfirmed, false);
    assert.equal(approved.state.bankPayoutConfirmed, false);
    assert.equal(approved.state.submissions.find((row) => row.version === 2)?.status, "approved");
    assert.equal(approved.state.submissions.find((row) => row.version === 1)?.status, "revision_requested");
    const history = paymentHistory(approved.state);
    assert.match(history.join("\n"), /Approved version 2/);
    assert.equal(history.some((line) => /Approved version 1/.test(line)), false);
    const released = workspaceDecision({ ...approved.state, milestoneStatus: "release_requested" }, business);
    assert.equal(released.hold, false);
    assert.equal(released.releaseVersion, 2);
    assert.equal(released.revisionVersion, 1);
    assert.match(released.paymentHistory.join("\n"), /Release requested for approved version 2/);
    assert.equal(released.paymentStatus, "Release requested");
    assert.equal(released.bankLine, null);
    assert.equal(released.action.kind, "view_details");
    assert.equal(released.nextActor, "Next step: Waiting for bank confirmation");
  });

  it("points creator and business at payout recovery after a failed bank payout", () => {
    const failed = state({
      milestoneStatus: "payout_failed",
      submissions: [
        { version: 1, status: "approved", note: "Final cut", linkUrl: "https://example.com/v1", reviewNote: "" },
      ],
    });
    const creator = workspaceDecision(failed, actor);
    assert.equal(creator.action.kind, "recover_payout");
    assert.equal(creator.action.label, "Update payout details");
    assert.equal(creator.nextActor, "Next step: Update payout details");
    if (creator.action.kind === "recover_payout") {
      assert.equal(creator.action.href, "/creator/earnings#payouts");
    }
    assert.equal(creator.paymentStatus, "Payout failed");
    const biz = workspaceDecision(failed, business);
    assert.equal(biz.action.kind, "view_payment");
    assert.equal(biz.action.label, "View payment history");
    assert.equal(biz.nextActor, "Next step: Wait for influencer payout update");
    if (biz.action.kind === "view_payment") {
      assert.equal(biz.action.href, "/payments");
    }
  });

  it("holds a release that cannot be tied to a version and shows the history", () => {
    const conflict = state({
      milestoneStatus: "release_requested",
      submissions: [
        {
          version: 1,
          status: "revision_requested",
          note: "First cut",
          linkUrl: "https://example.com/v1",
          reviewNote: "Please change the opening frame.",
        },
      ],
    });
    const decision = workspaceDecision(conflict, actor);
    assert.equal(decision.hold, true);
    assert.equal(decision.releaseVersion, null);
    assert.equal(decision.revisionVersion, 1);
    assert.equal(decision.action.kind, "view_details");
    assert.equal(decision.nextActor, null);
    assert.match(decision.holdReason ?? "", /not tied to a version/);
    const blocked = submitWorkspaceVersion(conflict, { note: "Another try at the cut", linkUrl: "https://example.com/v2" });
    assert.equal(blocked.ok, false);
    const html = rowHtml(decision, "/collaboration/work/deal?focus=m1&intent=details");
    assert.equal(html.includes("Submit revision"), false);
    assert.equal(html.includes("Next step"), false);
    assert.match(html, /Release requested/);
    assert.match(html, /Revision requested · V1/);
    assert.match(html, /View details/);
    const dialog = renderToStaticMarkup(
      <WorkspaceDialogBody
        title="Draft delivery"
        subtitle="Recorded history"
        closeHref="/collaboration/work/deal?tab=milestones"
        feedback={decision.feedback}
        history={decision.history}
        paymentHistory={decision.paymentHistory}
        holdReason={decision.holdReason}
        bankLine={decision.bankLine}
        mode="details"
        showSubmitForm={false}
        submitLabel={null}
        reviewVersion={null}
        canRequestChanges={false}
        approveHref={null}
        dealId="deal"
        milestoneId="m1"
        tab="milestones"
      />,
    );
    assert.match(dialog, /Version 1 · Revision requested/);
    assert.match(dialog, /not tied to a version/);
    assert.equal(dialog.includes("Submit version"), false);
    assert.equal(dialog.includes("Approve version"), false);
    assert.equal(dialog.includes(">Paid<"), false);
  });

  it("puts feedback before the revision fields and does not mark a click as paid", () => {
    const revised = requestWorkspaceChanges(state(), { version: 1, note: "Please replace the opening frame." });
    assert.equal(revised.ok, true);
    if (!revised.ok) return;
    const decision = workspaceDecision(revised.state, actor);
    const dialog = renderToStaticMarkup(
      <WorkspaceDialogBody
        title="Submit a revision"
        subtitle="Draft delivery · Version 2"
        closeHref="/collaboration/work/deal?tab=milestones"
        feedback={decision.feedback}
        history={decision.history}
        paymentHistory={decision.paymentHistory}
        holdReason={null}
        bankLine={null}
        mode="submit"
        showSubmitForm
        submitLabel="Submit version 2"
        reviewVersion={null}
        canRequestChanges={false}
        approveHref={null}
        dealId="deal"
        milestoneId="m1"
        tab="milestones"
        submitAction={async () => undefined}
      />,
    );
    const feedback = dialog.indexOf("Feedback on version 1");
    const link = dialog.indexOf("Deliverable link");
    const changed = dialog.indexOf("What changed?");
    const files = dialog.indexOf("Attach files");
    const submit = dialog.indexOf("Submit version 2");
    const cancel = dialog.indexOf("Cancel");
    assert.ok(feedback >= 0 && feedback < link && link < changed && changed < files && files < cancel && cancel < submit);
    assert.match(dialog, /Submitting starts the review window/);
    assert.equal(dialog.includes("Paid"), false);
  });

  it("labels the signed influencer net and the milestone column only when the stored amounts are that net", () => {
    const plan = {
      signedQuote: {
        businessPaysCents: 483_000,
        businessPlatformFeeCents: 63_000,
        grossInfluencerCompensationCents: 420_000,
        influencerReceivesCents: 357_000,
        influencerPlatformFeeCents: 63_000,
      },
    };
    const influencer = workspaceSummaryLines(
      memberDealView({ role: "influencer", grossCents: 420_000, feeCents: 63_000, plan }),
    );
    assert.equal(influencer.find((line) => line.amountCents === 357_000)?.label, "Agreed net payout");
    assert.equal(influencer.some((line) => line.label === "Net payout"), false);
    const brand = workspaceSummaryLines(memberDealView({ role: "business", grossCents: 420_000, feeCents: 63_000, plan }));
    assert.equal(brand.some((line) => line.label === "Agreed net payout"), false);
    assert.equal(
      milestoneAmountColumnLabel({ amountCents: [117_800, 121_400, 117_800], influencerReceivesCents: 357_000 }),
      "Net payout",
    );
    assert.equal(
      milestoneAmountColumnLabel({ amountCents: [140_000, 140_000, 140_000], influencerReceivesCents: 357_000 }),
      "Amount",
    );
    assert.equal(milestoneAmountColumnLabel({ amountCents: [100], influencerReceivesCents: null }), "Amount");
    const confirmed = workspaceDecision(
      state({
        milestoneStatus: "released",
        payoutConfirmed: true,
        submissions: [{ version: 1, status: "approved", note: "Final", linkUrl: "", reviewNote: "" }],
      }),
      actor,
    );
    assert.equal(confirmed.paymentStatus, "Paid");
    assert.equal(confirmed.bankLine, "Bank payout confirmed");
    const requested = workspaceDecision(state({ milestoneStatus: "release_requested", submissions: [] }), business);
    assert.equal(requested.paymentStatus, "Release requested");
    assert.equal(requested.bankLine, null);
  });

  it("keeps the workspace inside the signed-in shell and does not hardcode the sample net", () => {
    assert.equal(hidesMarketingChrome("/collaboration/work/deal"), true);
    const panel = readFileSync("src/app/collaboration/work/[fundingId]/workspace-panel.tsx", "utf8");
    const page = readFileSync("src/app/collaboration/work/[fundingId]/page.tsx", "utf8");
    assert.match(panel, /!business && funding\.status === "held"/);
    assert.match(panel, /actionAddDeliverableFiles/);
    assert.match(panel, /id="milestones"/);
    assert.match(readFileSync("src/components/workspace-milestones.tsx", "utf8"), /name="files"/);
    assert.match(page, /WorkspacePanel/);
    assert.match(page, /formatContractMoney/);
    assert.equal(page.includes("formatMoney("), false);
    assert.equal(panel.includes("3570"), false);
    assert.equal(page.includes("8%"), false);
    assert.match(panel, /recover_payout|view_payment/);
    assert.match(readFileSync("src/app/collaboration/work/[fundingId]/layout.tsx", "utf8"), /getAccountSession/);
    assert.match(readFileSync("src/app/collaboration/work/[fundingId]/messages-panel.tsx", "utf8"), /id="messages"/);
    const contractPage = readFileSync("src/app/collaboration/contracts/[id]/page.tsx", "utf8");
    assert.match(contractPage, /formatContractMoney/);
    assert.equal(contractPage.includes("formatMoney("), false);
  });
});
