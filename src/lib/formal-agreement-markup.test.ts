import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { commercialSummaryHtml, renderFormalAgreementArticleHtml } from "./formal-agreement-markup";

const base = {
  title: "Collaboration Agreement",
  campaign: "4th Test Campaign After Pay Engine Rebuilt",
  agreementRef: "IC-9BMTKC2J",
  versionLabel: "v1.0",
  compensation: {
    grossLabel: "$4,200.00",
    feeLabel: "$630.00",
    netLabel: "$3,570.00",
  },
  commercial: {
    serviceLevel: "Managed campaign",
    currency: "USD",
    period: "Per campaign record",
  },
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
  milestones: [
    {
      title: "Kickoff",
      shareLabel: "34%",
      grossLabel: "$1,428.00",
      feeLabel: "$214.20",
      netLabel: "$1,213.80",
    },
  ],
};

describe("formal agreement commercial summary", () => {
  it("always fills Commercial Summary from structured party and money fields", () => {
    const html = commercialSummaryHtml({
      ...base,
      body: "Commercial Summary\n\n1. Parties\n",
    });
    assert.match(html, /Commercial Summary/);
    assert.match(html, /ABC Holdings/);
    assert.match(html, /\$4,200\.00/);
    assert.match(html, /Managed campaign/);
    assert.match(html, /USD/);
  });

  it("does not leave an empty Commercial Summary bar when body rows are blank", () => {
    const html = renderFormalAgreementArticleHtml({
      ...base,
      body: "Agreement purpose\nPurpose text here.\n\nCommercial Summary\n\n1. Parties\nBody parties text\n",
    });
    assert.match(html, /Commercial Summary/);
    assert.match(html, /Gross influencer compensation/);
    assert.match(html, /ABC Holdings/);
    assert.match(html, /1\. Parties/);
    assert.equal(html.includes('<div class="formal-section-body"></div>'), false);
  });

  it("keeps the contracting business name on Execution, not only the signer", () => {
    const html = renderFormalAgreementArticleHtml({
      ...base,
      body: "1. Parties\n",
    });
    assert.match(html, /For ABC Holdings/);
    assert.match(html, /Printed name: Agboola Olomola/);
  });
});
