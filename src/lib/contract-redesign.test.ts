import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  CONTRACT_DOCUMENT_TYPES,
  fundingStatusLabel,
  signatureStatusBucket,
  signatureStatusLabel,
} from "./contract-catalog";
import {
  buildMilestoneSchedule,
  formatMilestoneScheduleBlock,
} from "./contract-milestone-schedule";
import {
  confirmParties,
  freezePartySnapshot,
} from "./contract-party-confirm";
import {
  detectFinancialInstruction,
  proposeContractClauseChange,
  templatizeClause,
} from "./contract-ai-tailor";
import {
  agreementActivityEvents,
  counterpartyName,
  displayAgreementReference,
  stripSignatureTokens,
  signingAsLabel,
} from "./contract-reader";
import { allocateAgreementReference, buildContractValues } from "./contract-document";
import { PRODUCT_SWITCHES } from "./product-switches";

describe("contract redesign catalog", () => {
  it("ships the four launch document types with funding isolation rules", () => {
    assert.equal(CONTRACT_DOCUMENT_TYPES.length, 4);
    const collab = CONTRACT_DOCUMENT_TYPES.find((row) => row.id === "collaboration");
    const nda = CONTRACT_DOCUMENT_TYPES.find((row) => row.id === "nda");
    assert.equal(collab?.linksToFunding, true);
    assert.equal(nda?.linksToFunding, false);
    assert.equal(nda?.requiresCollaboration, false);
  });

  it("keeps signature buckets separate from funding labels", () => {
    assert.equal(
      signatureStatusBucket({
        status: "signed",
        parties: [
          { status: "signed", userId: "a", email: "a@x.com" },
          { status: "signed", userId: "b", email: "b@x.com" },
        ],
        accountId: "a",
        email: "a@x.com",
      }),
      "signed",
    );
    assert.equal(signatureStatusLabel("yours"), "Needs your signature");
    assert.equal(fundingStatusLabel("held"), "Confirmed");
    assert.equal(fundingStatusLabel(null), null);
  });
});

describe("milestone schedule reconciliation", () => {
  it("allocates the ABC Holdings example without repeating gross as influencer amount", () => {
    const schedule = buildMilestoneSchedule({
      currency: "USD",
      grossCents: 420_000,
      influencerFeeCents: 63_000,
      milestones: [
        { title: "Kickoff", shareBps: 3400 },
        { title: "Draft delivery", shareBps: 3300 },
        { title: "Published work", shareBps: 3300 },
      ],
    });
    assert.equal(schedule.totals.grossCents, 420_000);
    assert.equal(schedule.totals.feeCents, 63_000);
    assert.equal(schedule.totals.netCents, 357_000);
    assert.equal(schedule.rows[0]?.grossCents, 142_800);
    assert.equal(schedule.rows[0]?.feeCents, 21_420);
    assert.equal(schedule.rows[0]?.netCents, 121_380);
    assert.equal(schedule.rows[0]?.feeLabel, "$214.20");
    assert.equal(schedule.rows[1]?.feeLabel, "$207.90");
    assert.equal(schedule.rows[1]?.netLabel, "$1,178.10");
    assert.equal(schedule.totals.feeLabel, "$630.00");
    assert.equal(schedule.totals.netLabel, "$3,570.00");
    // Displayed fees must still sum to the signed total (no silent $208 rounding).
    assert.equal(
      schedule.rows.reduce((sum, row) => sum + row.feeCents, 0),
      schedule.totals.feeCents,
    );
    const block = formatMilestoneScheduleBlock(schedule);
    assert.match(block, /Gross compensation/);
    assert.match(block, /Influencer fee/);
    assert.match(block, /Net compensation/);
    assert.match(block, /\$207\.90/);
    assert.equal(block.includes("Influencer Amount"), false);
  });
});

describe("party confirmation", () => {
  it("requires distinct legal names and records capacity", () => {
    const ok = confirmParties({
      business: {
        role: "business",
        legalName: "ABC Holdings",
        signerName: "Agboola Olomola",
        capacity: "Authorized representative",
        email: "ops@abc.example",
      },
      influencer: {
        role: "influencer",
        legalName: "Ag Olomola",
        handle: "ag-olomola-2",
        signerName: "Ag Olomola",
        capacity: "Influencer",
        email: "ag@example.com",
      },
    });
    assert.equal(ok.ok, true);
    const frozen = freezePartySnapshot(ok);
    assert.equal(frozen.business.legalName, "ABC Holdings");
    assert.equal(frozen.influencer.handle, "ag-olomola-2");
  });

  it("blocks when legal identity is missing", () => {
    const blocked = confirmParties({
      business: { role: "business", legalName: "", signerName: "A", email: "a@x.com" },
      influencer: { role: "influencer", legalName: "B", signerName: "B", email: "b@x.com" },
    });
    assert.equal(blocked.ok, false);
    assert.ok(blocked.blockers.some((row) => row.field === "legalName"));
  });
});

describe("contract AI tailor", () => {
  it("protects parties and routes money changes to quote or change order", () => {
    const parties = proposeContractClauseChange({
      section: "parties",
      original: "Business: ABC Holdings",
      instruction: "Rename the brand",
      dealSigned: false,
    });
    assert.equal(parties.kind, "blocked");

    const money = proposeContractClauseChange({
      section: "compensation",
      original: "Gross compensation $3,500",
      instruction: "Change compensation to $4,000",
      dealSigned: false,
    });
    assert.equal(money.kind, "financial_requires_quote");
    assert.equal(detectFinancialInstruction("raise the fee to $500", "fee"), true);

    const wording = proposeContractClauseChange({
      section: "deliverables",
      original: "Deliver two videos.",
      instruction: "Make them vertical, 30-45 seconds",
      dealSigned: false,
      protectedParties: { brand: "ABC Holdings", influencer: "Ag Olomola" },
    });
    assert.equal(wording.kind, "wording");
    assert.match(wording.proposed, /vertical/i);
    assert.match(templatizeClause("Pay @ag-olomola-2 $4,200.00 on 2026-11-01"), /{{influencer_handle}}/);
  });

  it("registers the admin switch", () => {
    assert.ok(PRODUCT_SWITCHES.some((row) => row.key === "contract_ai_tailor"));
  });
});

describe("reader presentation", () => {
  it("strips signature tokens and assigns a stable agreement reference", () => {
    const cleaned = stripSignatureTokens("Signed\n[[SIG_INK:1]]\n/sig1/\nDone");
    assert.equal(cleaned.includes("SIG_INK"), false);
    assert.equal(cleaned.includes("/sig1/"), false);
    assert.equal(displayAgreementReference({ id: "cmabc12345xyz", agreementRef: "" }), "IC-12345XYZ");
    assert.equal(allocateAgreementReference("cmabc12345xyz"), "IC-12345XYZ");
    assert.match(signingAsLabel({ signerName: "Agboola Olomola", entityName: "ABC Holdings" }), /on behalf of ABC Holdings/);
    assert.equal(
      counterpartyName({
        viewerIsBusiness: false,
        parties: [
          { role: "business", name: "ABC Holdings", userId: "b" },
          { role: "creator", name: "Ag Olomola", userId: "c" },
        ],
        accountId: "c",
      }),
      "ABC Holdings",
    );
    const activity = agreementActivityEvents({
      createdAt: new Date("2026-11-01T12:00:00Z"),
      updatedAt: new Date("2026-11-02T12:00:00Z"),
      status: "signed",
      parties: [
        { name: "ABC Holdings", status: "signed", signedAt: new Date("2026-11-01T15:00:00Z") },
        { name: "Ag Olomola", status: "signed", signedAt: new Date("2026-11-02T12:00:00Z") },
      ],
    });
    assert.ok(activity.some((row) => row.label === "Fully signed"));
    assert.ok(activity.some((row) => row.detail === "Ready for signature"));
  });

  it("keeps Influrios out of the contracting parties block for new values", () => {
    const values = buildContractValues({
      title: "4th Test Campaign After Pay Engine Rebuilt",
      scope: "Publish one sponsored post on X each day for 30 days.",
      commercial: "Sponsored posts",
      jurisdiction: "US",
      serviceLevel: "contracted",
      currency: "USD",
      grossLabel: "$4,200.00",
      platformFeeLabel: "$630.00",
      creatorCompensationLabel: "$3,570.00",
      businessPlatformFeeLabel: "$0.00",
      influencerPlatformFeeLabel: "$630.00",
      netCompensationLabel: "$3,570.00",
      businessName: "ABC Holdings",
      businessEmail: "ops@abc.example",
      parties: [
        { role: "business", name: "Agboola Olomola", email: "ops@abc.example" },
        { role: "creator", name: "Ag Olomola", email: "ag@example.com", creatorSlug: "ag-olomola-2", shareBps: 10_000 },
      ],
      milestones: [
        { title: "Kickoff", shareLabel: "34%", grossLabel: "$1,428.00", feeLabel: "$214.20", creatorShares: "$1,213.80" },
      ],
      feeDisclosure: "Influencer platform fee recorded on the signed schedule.",
      generatedAt: "2026-11-17T00:00:00.000Z",
      agreementId: "IC-TEST0001",
    });
    assert.equal(values.agreement_id, "IC-TEST0001");
    assert.equal(values.business_name, "ABC Holdings");
    assert.match(values.milestones_block, /Net compensation/);
    assert.equal(values.milestones_block.includes("Influencer Amount"), false);
  });
});

describe("contracts UI redesign surfaces", () => {
  it("uses Agreements and Templates tabs with Overview Document Signers Activity popup", () => {
    const page = readFileSync("src/app/collaboration/contracts/page.tsx", "utf8");
    const dialog = readFileSync("src/components/contract-agreement-dialog.tsx", "utf8");
    const formalUi = readFileSync("src/components/formal-agreement-document.tsx", "utf8");
    const markup = readFileSync("src/lib/formal-agreement-markup.ts", "utf8");
    assert.match(page, /Agreements/);
    assert.match(page, /Templates/);
    assert.match(page, /Counterparty/);
    assert.match(dialog, /Overview/);
    assert.match(dialog, /Document/);
    assert.match(dialog, /Signers/);
    assert.match(dialog, /Activity/);
    assert.match(formalUi, /\bbody\b/);
    assert.match(formalUi, /renderFormalAgreementArticleHtml/);
    assert.match(markup, /parseAgreementBodySections/);
    assert.match(markup, /Schedule A/);
    assert.match(markup, /not a contracting party/i);
    assert.match(markup, /influriosWordmarkHtml|Influrios/);
    const wordmark = readFileSync("src/components/influrios-wordmark.tsx", "utf8");
    assert.match(wordmark, /brand-gradient/);
    assert.match(wordmark, /∞/);
    assert.match(page, /Collaboration Agreement/);
    assert.match(page, /documentBody/);
    assert.match(dialog, /\bdownload\b/);
    const pdfRoute = readFileSync("src/app/collaboration/contracts/[id]/pdf/route.ts", "utf8");
    assert.match(pdfRoute, /attachment; filename=/);
    assert.equal(pdfRoute.includes("inline; filename="), false);
    const formalPdf = readFileSync("src/lib/formal-agreement-pdf.ts", "utf8");
    assert.match(formalPdf, /renderFormalAgreementPdf/);
    assert.match(formalPdf, /Schedule A/);
    assert.match(formalPdf, /Execution/);
    const chrome = readFileSync("src/lib/contract-document.ts", "utf8");
    assert.match(chrome, /renderFormalAgreementPdf/);
  });
});
