import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_CONTRACT_TEMPLATE,
  applyEnvelopeToParties,
  buildContractValues,
  fundingAllowedBySignature,
  messageVisible,
  renderContractBody,
  renderContractPdf,
  renderContractTemplate,
  signatureBlock,
} from "./contract-document";

const parties = [
  { role: "business" as const, name: "North Co", email: "north@example.com", shareBps: 0 },
  { role: "creator" as const, name: "Ada", email: "ada@example.com", creatorSlug: "ada", shareBps: 5000 },
  { role: "creator" as const, name: "Bea", email: "bea@example.com", creatorSlug: "bea", shareBps: 5000 },
];

describe("contract documents", () => {
  it("fills the template with every party and keeps an unknown variable visible", () => {
    const values = buildContractValues({
      title: "Spring launch",
      scope: "Three films",
      commercial: "Net 15",
      jurisdiction: "US",
      serviceLevel: "contracted",
      currency: "USD",
      grossLabel: "$1,000.00",
      platformFeeLabel: "$100.00",
      creatorCompensationLabel: "$900.00",
      businessName: "North Co",
      businessEmail: "north@example.com",
      parties,
      milestones: [
        {
          title: "Delivery",
          shareLabel: "100%",
          grossLabel: "$1,000.00",
          feeLabel: "$100.00",
          creatorShares: "ada $450.00, bea $450.00",
        },
      ],
      feeDisclosure: "Fee rule v3",
      generatedAt: "2026-10-07T00:00:00.000Z",
    });
    const body = renderContractBody(DEFAULT_CONTRACT_TEMPLATE + "\n{{not_a_variable}}", {
      title: "Spring launch",
      scope: "Three films",
      commercial: "Net 15",
      jurisdiction: "US",
      serviceLevel: "contracted",
      currency: "USD",
      grossLabel: "$1,000.00",
      platformFeeLabel: "$100.00",
      creatorCompensationLabel: "$900.00",
      businessName: "North Co",
      businessEmail: "north@example.com",
      parties,
      milestones: [
        {
          title: "Delivery",
          shareLabel: "100%",
          grossLabel: "$1,000.00",
          feeLabel: "$100.00",
          creatorShares: "ada $450.00, bea $450.00",
        },
      ],
      feeDisclosure: "Fee rule v3",
      generatedAt: "2026-10-07T00:00:00.000Z",
    });
    assert.match(body, /Ada/);
    assert.match(body, /Bea/);
    assert.match(body, /north@example.com/);
    assert.match(body, /ada \$450\.00/);
    assert.match(body, /\/sig1\//);
    assert.match(body, /\/sig3\//);
    assert.match(body, /\{\{not_a_variable\}\}/);
    assert.equal(renderContractTemplate("Hello {{title}}", values), "Hello Spring launch");
    assert.match(signatureBlock(parties), /\/sig2\//);
  });

  it("writes a PDF that contains the agreement text and a signature anchor", () => {
    const pdf = renderContractPdf("Spring launch\n/sig1/");
    const text = pdf.toString("utf8");
    assert.match(text, /^%PDF-1.4/);
    assert.match(text, /Spring launch/);
    assert.match(text, /\/sig1\//);
    assert.match(text, /%%EOF/);
  });

  it("allows funding only after every party is signed", () => {
    assert.equal(fundingAllowedBySignature("sent").ok, false);
    assert.equal(fundingAllowedBySignature("draft").ok, false);
    assert.equal(fundingAllowedBySignature("signed").ok, true);
    assert.equal(applyEnvelopeToParties([{ status: "pending" }, { status: "pending" }], "completed").documentStatus, "signed");
    assert.equal(applyEnvelopeToParties([{ status: "pending" }], "declined").documentStatus, "declined");
    assert.equal(applyEnvelopeToParties([{ status: "pending" }], "sent").documentStatus, "sent");
  });

  it("shows each message only to the chosen readers", () => {
    const base = {
      recipientPartyId: "party_b",
      senderUserId: "user_a",
      senderAdminId: null,
    };
    const partyA = { kind: "party" as const, userId: "user_a", partyId: "party_a" };
    const partyB = { kind: "party" as const, userId: "user_b", partyId: "party_b" };
    const superAdmin = { kind: "admin" as const, userId: "admin_1", roleId: "role_super", permissions: [] as string[] };
    const granted = { kind: "admin" as const, userId: "admin_2", roleId: "role_ops", permissions: ["contracts.message"] };
    const manager = { kind: "admin" as const, userId: "admin_3", roleId: "role_ops", permissions: ["contracts.manage"] };
    const locked = { kind: "admin" as const, userId: "admin_4", roleId: "role_content", permissions: ["contracts.view"] };

    const partyC = { kind: "party" as const, userId: "user_c", partyId: "party_c" };
    assert.equal(messageVisible({ ...base, audience: "party", viewer: partyB }), true);
    assert.equal(messageVisible({ ...base, audience: "party", senderUserId: "user_b", viewer: partyC }), false);
    assert.equal(messageVisible({ ...base, audience: "party", viewer: partyA }), true);
    assert.equal(messageVisible({ ...base, audience: "all_parties", senderUserId: "user_c", viewer: partyB }), true);
    assert.equal(messageVisible({ ...base, audience: "admin", senderUserId: "user_c", viewer: partyB }), false);
    assert.equal(messageVisible({ ...base, audience: "admin", senderUserId: "user_c", viewer: superAdmin }), true);
    assert.equal(messageVisible({ ...base, audience: "admin", senderUserId: "user_c", viewer: granted }), true);
    assert.equal(messageVisible({ ...base, audience: "admin", senderUserId: "user_c", viewer: locked }), false);
    assert.equal(messageVisible({ ...base, audience: "contract_manager", senderUserId: "user_c", viewer: manager }), true);
    assert.equal(messageVisible({ ...base, audience: "all_parties", senderUserId: "user_c", viewer: manager }), false);
  });
});
