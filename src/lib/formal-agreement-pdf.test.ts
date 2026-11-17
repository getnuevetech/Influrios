import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { renderFormalAgreementPdf } from "./formal-agreement-pdf";
import { renderFormalAgreementDocumentHtml } from "./formal-agreement-html";
import { DEFAULT_CONTRACT_TEMPLATE, renderContractBody } from "./contract-document";

describe("formal agreement PDF", () => {
  it("mirrors Document tab structure: parties, compensation, schedule, execution", () => {
    const body = renderContractBody(DEFAULT_CONTRACT_TEMPLATE, {
      title: "4th Test Campaign After Pay Engine Rebuilt",
      scope: "Publish one sponsored post on X each day for 30 days.",
      commercial: "Sponsored Post",
      jurisdiction: "US",
      serviceLevel: "managed_campaign",
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
        {
          role: "creator",
          name: "Ag Olomola",
          email: "ag@example.com",
          creatorSlug: "ag-olomola-2",
          shareBps: 10_000,
        },
      ],
      milestones: [
        {
          title: "Kickoff",
          shareLabel: "34%",
          grossLabel: "$1,428.00",
          feeLabel: "$214.20",
          creatorShares: "$1,213.80",
        },
      ],
      feeDisclosure: "Influencer platform fee on the signed schedule.",
      generatedAt: "2026-11-10T00:25:00.000Z",
      agreementId: "IC-9BMTKC2J",
    });

    const pdf = renderFormalAgreementPdf({
      title: "Collaboration Agreement",
      campaign: "4th Test Campaign After Pay Engine Rebuilt",
      agreementRef: "IC-9BMTKC2J",
      versionLabel: "v1.0",
      body,
      compensation: {
        grossLabel: "$4,200.00",
        feeLabel: "$630.00",
        netLabel: "$3,570.00",
      },
      milestones: [
        {
          title: "Kickoff",
          shareLabel: "34%",
          grossLabel: "$1,428.00",
          feeLabel: "$214.20",
          netLabel: "$1,213.80",
        },
        {
          title: "Draft delivery",
          shareLabel: "33%",
          grossLabel: "$1,386.00",
          feeLabel: "$207.90",
          netLabel: "$1,178.10",
        },
        {
          title: "Published work",
          shareLabel: "33%",
          grossLabel: "$1,386.00",
          feeLabel: "$207.90",
          netLabel: "$1,178.10",
        },
      ],
      parties: [
        {
          role: "business",
          legalName: "ABC Holdings",
          signerName: "Agboola Olomola",
          capacity: "Authorized representative",
          signed: true,
          signedAtLabel: "November 10, 2026 at 12:27 AM UTC",
        },
        {
          role: "influencer",
          legalName: "Ag Olomola",
          handle: "@ag-olomola-2",
          signerName: "Ag Olomola",
          capacity: "Influencer",
          signed: true,
          signedAtLabel: "November 10, 2026 at 12:27 AM UTC",
        },
      ],
    });

    const raw = pdf.toString("latin1");
    assert.match(raw, /^%PDF-1.4/);
    assert.match(raw, /\(Influrios\)/);
    assert.match(raw, /Collaboration Agreement/);
    assert.match(raw, /IC-9BMTKC2J/);
    assert.match(raw, /1\. PARTIES/);
    assert.match(raw, /ABC Holdings/);
    assert.match(raw, /Platform handle:/);
    assert.match(raw, /3\. COMPENSATION/);
    assert.match(raw, /Net compensation/);
    assert.match(raw, /Schedule A - Milestones/);
    assert.match(raw, /Kickoff/);
    assert.match(raw, /Draft delivery/);
    assert.match(raw, /CAMPAIGN SCOPE/);
    assert.match(raw, /EXECUTION/);
    assert.match(raw, /Agboola Olomola/);
    assert.equal(raw.includes("INFLURIOS  |  COLLABORATION AGREEMENT"), false);
    assert.equal(raw.includes("Page endorsement"), false);

    const formalInput = {
      title: "Collaboration Agreement",
      campaign: "4th Test Campaign After Pay Engine Rebuilt",
      agreementRef: "IC-9BMTKC2J",
      versionLabel: "v1.0",
      body,
      compensation: {
        grossLabel: "$4,200.00",
        feeLabel: "$630.00",
        netLabel: "$3,570.00",
      },
      milestones: [
        {
          title: "Kickoff",
          shareLabel: "34%",
          grossLabel: "$1,428.00",
          feeLabel: "$214.20",
          netLabel: "$1,213.80",
        },
      ],
      parties: [
        {
          role: "business" as const,
          legalName: "ABC Holdings",
          signerName: "Agboola Olomola",
          capacity: "Authorized representative",
          signed: true,
          signedAtLabel: "November 10, 2026 at 12:27 AM UTC",
        },
        {
          role: "influencer" as const,
          legalName: "Ag Olomola",
          handle: "@ag-olomola-2",
          signerName: "Ag Olomola",
          capacity: "Influencer",
          signed: true,
          signedAtLabel: "November 10, 2026 at 12:27 AM UTC",
        },
      ],
    };
    const html = renderFormalAgreementDocumentHtml(formalInput);
    assert.match(html, /influrios-wordmark/);
    assert.match(html, /Influrios/);
    assert.match(html, /#2979FF/);
    assert.match(html, /∞|&#8734;|&infin;/);
    assert.match(html, /Collaboration Agreement/);
    assert.match(html, /IC-9BMTKC2J/);
    assert.match(html, /1\. Parties/);
    assert.match(html, /3\. Compensation/);
    assert.match(html, /Execution/);
    assert.match(html, /execution-grid/);
    assert.match(html, /Plus Jakarta Sans/);

    const formalUi = readFileSync("src/components/formal-agreement-document.tsx", "utf8");
    assert.match(formalUi, /FormalAgreementDocument/);
    assert.match(formalUi, /formal-agreement-markup/);
    assert.match(formalUi, /renderFormalAgreementArticleHtml/);
    const pdfRoute = readFileSync("src/app/collaboration/contracts/[id]/pdf/route.ts", "utf8");
    assert.match(pdfRoute, /attachment; filename=/);
    assert.match(pdfRoute, /buildContractChromePdf/);
    const contractDoc = readFileSync("src/lib/contract-document.ts", "utf8");
    assert.match(contractDoc, /htmlDocumentToPdf|renderFormalAgreementDocumentHtml/);
  });
});
