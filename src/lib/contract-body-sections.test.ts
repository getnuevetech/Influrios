import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  parseAgreementBodySections,
  stripLeadingChrome,
  trimSignatureTrailer,
} from "./contract-body-sections";
import { DEFAULT_CONTRACT_TEMPLATE, renderContractBody } from "./contract-document";

describe("agreement body sections", () => {
  it("keeps every numbered clause from the approved template in the Document reader", () => {
    const body = renderContractBody(DEFAULT_CONTRACT_TEMPLATE, {
      title: "4th Test Campaign After Pay Engine Rebuilt",
      scope: "Publish one sponsored post on X each day for 30 days.",
      commercial: "Sponsored Post · Brand Awareness",
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
    assert.match(body, /19\.\s+Electronic Signature/);
    assert.match(body, /\[\[SIG_INK:1\]\]/);
    const trimmed = trimSignatureTrailer(body);
    assert.equal(trimmed.includes("[[SIG_INK"), false);
    assert.equal(/19\.\s+Electronic Signature/.test(trimmed), false);
    assert.match(trimmed, /18\.\s+Amendments/);
    assert.match(stripLeadingChrome(trimmed), /Agreement purpose/);
    const sections = parseAgreementBodySections(body);
    const headings = sections.map((section) => section.heading).filter(Boolean) as string[];
    for (let clause = 1; clause <= 18; clause += 1) {
      assert.ok(
        headings.some((heading) => new RegExp(`^${clause}\\.\\s+`).test(heading)),
        `expected clause ${clause} in Document reader sections`,
      );
    }
    assert.equal(headings.some((heading) => /^19\.\s+Electronic Signature/i.test(heading)), false);
    const formal = readFileSync("src/components/formal-agreement-document.tsx", "utf8");
    assert.match(formal, /body:/);
    assert.match(formal, /parseAgreementBodySections/);
    assert.match(formal, /ExecutionSection/);
  });
});
