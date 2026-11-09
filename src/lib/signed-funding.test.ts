import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  canonicalTerms,
  repriceNeedsNewAgreement,
  contractFundingCta,
  contractFundingIdempotencyKey,
  contractMayBeDeleted,
  contractMayBeVoided,
  agreedFeeFromSources,
  describeDealProgress,
  fundedShareBps,
  parseScheduleCorrection,
  readSignedTermsSnapshot,
  sharePercentLabel,
  recoverSignedTermsFromAgreement,
  sameDealError,
  submittedTermsDiffer,
  type SignedTermsSnapshot,
} from "./signed-funding";

const snapshot: SignedTermsSnapshot = {
  version: 1,
  title: "2nd Collaboration Test",
  businessName: "North Brand",
  jurisdictionCode: "US",
  currency: "USD",
  grossCents: 150000,
  serviceLevel: "discovery",
  workspaceId: "ws_1",
  collaborationId: "col_1",
  applicationId: "app_1",
  teamProposalId: null,
  creators: [{ slug: "ada", shareBps: 10_000 }],
  milestones: [
    { title: "Delivery", shareBps: 6_000 },
    { title: "Usage", shareBps: 4_000 },
  ],
  financialPlan: { grossContractValueCents: 150000, contractCurrency: "USD" },
  payoutMethod: "",
  lockedAt: "2026-11-08T00:00:00.000Z",
};

describe("schedule correction fields", () => {
  it("requires labeled influencer and milestone shares to add up to 100", () => {
    const ok = parseScheduleCorrection({
      slugs: ["ag", ""],
      creatorPercents: ["100", ""],
      titles: ["Delivery"],
      milestonePercents: ["100"],
    });
    assert.equal(ok.ok, true);
    const short = parseScheduleCorrection({
      slugs: ["ag"],
      creatorPercents: ["60"],
      titles: ["Delivery"],
      milestonePercents: ["100"],
    });
    assert.equal(short.ok, false);
  });
});

describe("agreed fee label", () => {
  it("keeps the currency with the amount", () => {
    const fromForm = agreedFeeFromSources({ gross: "11000", currency: "USD" });
    assert.equal(fromForm.label, "$11,000");
    assert.equal(fromForm.currency, "USD");
    const fromSnapshot = agreedFeeFromSources({}, snapshot);
    assert.match(fromSnapshot.label, /1,500/);
    assert.equal(agreedFeeFromSources({}).label, "—");
  });
});

describe("recover signed commercial terms", () => {
  it("rebuilds the snapshot from the signed agreement and refuses a schedule that does not add up", () => {
    const body = [
      "Commercial Summary",
      "Currency  USD",
      "Gross Contract Value  $11,000",
      "Business  Agboola Olomola",
      "4. Milestone Schedule",
      "1. Delivery  60%  $6,600  $660  ag $5,940",
      "2. Usage  40%  $4,400  $440  ag $3,960",
      "5. Influencer Share Allocation",
      "Ag Olomola  @ag  100.00%",
      "6. Funding, Release and Payout",
    ].join("\n");
    const recovered = recoverSignedTermsFromAgreement({
      title: "2nd Collaboration Test",
      workspaceId: "ws_1",
      collaborationId: null,
      applicationId: null,
      teamProposalId: null,
      createdAt: "2026-11-08T00:00:00.000Z",
      sourceJson: { gross: "11000", currency: "USD", jurisdiction: "US", serviceLevel: "discovery" },
      renderedBody: body,
      parties: [
        { role: "business", name: "Agboola Olomola", shareBps: 0 },
        { role: "creator", name: "Ag Olomola", creatorSlug: "ag", shareBps: 10000 },
      ],
    });
    assert.equal(recovered?.grossCents, 1_100_000);
    assert.equal(recovered?.currency, "USD");
    assert.equal(recovered?.creators[0]?.slug, "ag");
    assert.equal(recovered?.milestones.length, 2);
    const rounded = recoverSignedTermsFromAgreement({
      title: "Rounded",
      sourceJson: { gross: "100", currency: "USD" },
      renderedBody: ["4. Milestone Schedule", "1. Draft  33%  $33", "2. Live  33%  $33", "3. Final  33%  $34", "5. Next"].join("\n"),
      parties: [{ role: "creator", name: "Ag", creatorSlug: "ag", shareBps: 10000 }],
    });
    assert.equal(rounded?.milestones.reduce((sum, row) => sum + row.shareBps, 0), 10_000);
    const legacy = recoverSignedTermsFromAgreement({
      title: "Spring launch",
      renderedBody: ["3. Money", "Currency: USD", "Gross contract value: $1,000.00", "4. Milestones", "1. Delivery", "   Share: 100%", "5. Creator shares"].join("\n"),
      parties: [{ role: "creator", name: "Ada", creatorSlug: "ada", shareBps: 0 }],
    });
    assert.equal(legacy?.grossCents, 100_000);
    assert.equal(legacy?.milestones[0]?.shareBps, 10_000);
    assert.equal(
      recoverSignedTermsFromAgreement({
        title: "Missing",
        renderedBody: body.replace("60%", "50%"),
        sourceJson: { gross: "11000", currency: "USD" },
        parties: [{ role: "creator", name: "Ag", creatorSlug: "ag", shareBps: 10000 }],
      }),
      null,
    );
    const apply = readFileSync("src/lib/signed-funding-apply.ts", "utf8");
    assert.match(apply, /ensureStoredCommercialTerms/);
    assert.match(apply, /contract.terms.recovered/);
  });
});

describe("milestone share on a funded deal", () => {
  it("keeps the contract percentage on each funded amount", () => {
    assert.equal(sharePercentLabel(6000), "60%");
    assert.equal(fundedShareBps(660000, 1_100_000), 6000);
    const page = readFileSync("src/app/admin/deals/[id]/page.tsx", "utf8");
    assert.match(page, /These percentages were set when the agreement was created/);
    assert.match(readFileSync("src/lib/admin-deal.ts", "utf8"), /ensureStoredCommercialTerms/);
  });
});

describe("signed funding instruction", () => {
  it("funds the stored terms and refuses a changed amount, recipient, or milestone split", () => {
    assert.equal(submittedTermsDiffer(snapshot, { workspaceId: "ws_1" }), null);
    assert.match(submittedTermsDiffer(snapshot, { workspaceId: "ws_1", grossCents: 9000 }) ?? "", /amount/i);
    assert.match(submittedTermsDiffer(snapshot, { workspaceId: "ws_1", creatorSlug: "other" }) ?? "", /influencer/i);
    assert.match(
      submittedTermsDiffer(snapshot, {
        workspaceId: "ws_1",
        customMilestones: [{ title: "Delivery", shareBps: 10_000 }],
      }) ?? "",
      /milestone/i,
    );
    assert.match(sameDealError(snapshot, { workspaceId: "ws_2" }) ?? "", /different business/i);
    assert.match(
      sameDealError(snapshot, { workspaceId: "ws_1", collaborationId: "col_2" }) ?? "",
      /different deal/i,
    );
  });

  it("keeps the signed amounts until a new agreement version is signed", () => {
    const amendment = {
      grossCents: 200000,
      currency: "USD",
      creators: [{ slug: "ada", shareBps: 10_000 }],
      milestones: [{ title: "Delivery", shareBps: 10_000 }],
      note: "Scope grew after signing",
    };
    assert.match(repriceNeedsNewAgreement(snapshot, amendment) ?? "", /fresh signatures/);
    const next = canonicalTerms(snapshot, amendment);
    assert.equal(next.grossCents, 150000);
    assert.equal(submittedTermsDiffer(next, { workspaceId: "ws_1", grossCents: 200000 })?.includes("amount"), true);
  });

  it("round-trips a snapshot and rejects a snapshot whose shares do not add up", () => {
    assert.equal(readSignedTermsSnapshot(snapshot)?.grossCents, 150000);
    assert.equal(readSignedTermsSnapshot({ ...snapshot, creators: [{ slug: "ada", shareBps: 5000 }] }), null);
  });

  it("shows start, resume, or view funding and never a second start", () => {
    assert.equal(contractFundingCta({ role: "business", status: "signed" }).kind, "start");
    const resume = contractFundingCta({ role: "business", status: "signed", fundingId: "f1", fundingStatus: "awaiting_provider" });
    assert.equal(resume.kind === "resume" ? resume.label : "", "Resume payment");
    const view = contractFundingCta({ role: "business", status: "signed", fundingId: "f1", fundingStatus: "held" });
    assert.equal(view.kind === "view" ? view.label : "", "View funding");
    assert.equal(contractFundingCta({ role: "creator", status: "signed", fundingId: "f1" }).kind, "hidden");
    assert.equal(contractFundingIdempotencyKey("doc_1"), "contract:doc_1:initial");
  });

  it("deletes only drafts and voids an unfunded signed agreement", () => {
    assert.equal(contractMayBeDeleted("draft"), true);
    assert.equal(contractMayBeDeleted("signed"), false);
    assert.equal(contractMayBeDeleted("sent"), false);
    assert.equal(contractMayBeVoided("signed", null), true);
    assert.equal(contractMayBeVoided("signed", "fund_1"), false);
    assert.equal(contractMayBeVoided("draft", null), false);
  });

  it("names provider confirmation, scheduled release, and the disputed milestone", () => {
    const waiting = describeDealProgress({
      collaborationStatus: "accepted",
      agreementStatus: "signed",
      signedCount: 2,
      partyCount: 2,
      fundingStatus: "awaiting_provider",
      currency: "USD",
      milestones: [{ id: "m1", title: "Delivery", status: "pending", amountCents: 150000, releaseScheduledAt: null }],
      disputes: [],
    });
    assert.equal(waiting.agreement, "Fully signed");
    assert.equal(waiting.funding, "Awaiting provider confirmation");
    assert.match(waiting.next, /provider confirmation/i);

    const scheduled = describeDealProgress({
      ...waiting,
      collaborationStatus: "accepted",
      fundingStatus: "held",
      milestones: [{ id: "m1", title: "Delivery", status: "approved", amountCents: 150000, releaseScheduledAt: "2026-11-09T00:00:00.000Z" }],
      disputes: [],
      agreementStatus: "signed",
      signedCount: 2,
      partyCount: 2,
      currency: "USD",
    });
    assert.equal(scheduled.delivery, "Release scheduled");

    const disputed = describeDealProgress({
      collaborationStatus: "accepted",
      agreementStatus: "signed",
      signedCount: 2,
      partyCount: 2,
      fundingStatus: "held",
      currency: "USD",
      milestones: [{ id: "m1", title: "Delivery", status: "approved", amountCents: 80000, releaseScheduledAt: null }],
      disputes: [{ milestoneId: "m1", status: "open", title: "Delivery", amountCents: 80000 }],
    });
    assert.equal(disputed.hold?.title, "Delivery");
    assert.equal(disputed.hold?.amountCents, 80000);
    assert.match(disputed.next, /on hold/i);
  });

  it("keeps the ledger read-only and the admin links on the deal page", () => {
    const ledger = readFileSync("src/lib/marketplace-ledger.ts", "utf8");
    const list = ledger.slice(ledger.indexOf("export async function listFundings"), ledger.indexOf("export async function listFundingsForCreator"));
    assert.equal(list.includes("sweepAutoApprovals"), false);
    assert.equal(list.includes("sweepDueRecurrences"), false);
    const creator = ledger.slice(ledger.indexOf("export async function listFundingsForCreator"), ledger.indexOf("export async function listFundingsForBusiness"));
    assert.equal(creator.includes("sweepAutoApprovals"), false);
    const business = ledger.slice(ledger.indexOf("export async function listFundingsForBusiness"), ledger.indexOf("export async function submitFundingMilestone"));
    assert.equal(business.includes("sweepDueRecurrences"), false);
    const action = readFileSync("src/app/collaboration/contract/actions.ts", "utf8");
    assert.match(action, /fundSignedAgreement/);
    assert.match(action, /termsSnapshot/);
    const deleter = readFileSync("src/lib/contract-document.ts", "utf8");
    assert.match(deleter, /status !== "draft"/);
    const adminContracts = readFileSync("src/app/admin/contracts/actions.ts", "utf8");
    assert.match(adminContracts, /voidContractDocument/);
    const collab = readFileSync("src/app/admin/collaborations/page.tsx", "utf8");
    assert.match(collab, /\/admin\/deals\//);
    assert.equal(collab.includes("/collaboration/records/"), false);
    const detail = readFileSync("src/app/admin/marketplace/[fundingId]/page.tsx", "utf8");
    assert.match(detail, /\/admin\/deals\//);
    assert.equal(detail.includes("/collaboration/records/"), false);
  });
});
