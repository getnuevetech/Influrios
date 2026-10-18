import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_CONTRACT_TEMPLATE,
  asciiForPdf,
  applyEnvelopeToParties,
  buildContractValues,
  classifyContractPdfLines,
  contractMessageNotifyEmails,
  contractStageEmailCopy,
  displayServiceLevel,
  fundingAllowedBySignature,
  messageVisible,
  renderContractBody,
  renderContractPdf,
  renderContractTemplate,
  resolveContractPartyForAccount,
  signatureBlock,
  wrapContractLines,
} from "./contract-document";
import { applyNativeSignatureAnchor, formatNativeAttestation } from "./signing/native";

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
    assert.match(text, /Helvetica-Bold/);
  });

  it("keeps newlines when mapping Unicode so PDF text is not a wall of question marks", () => {
    const sample = "COLLABORATION AGREEMENT\n\n1. Parties\nBusiness · North — Ada\n";
    assert.equal(asciiForPdf(sample).includes("\n"), true);
    assert.equal(asciiForPdf(sample).includes("?"), false);
    assert.match(asciiForPdf(sample), /Business - North - Ada/);
    const wrapped = wrapContractLines(sample);
    assert.ok(wrapped.includes("COLLABORATION AGREEMENT"));
    assert.ok(wrapped.includes("1. Parties"));
    assert.ok(wrapped.some((line) => line === ""));
    const classified = classifyContractPdfLines(sample);
    assert.equal(classified[0]?.style, "title");
    assert.ok(classified.some((line) => line.style === "heading" && line.text.startsWith("1. Parties")));
    const pdf = renderContractPdf(sample);
    const raw = pdf.toString("latin1");
    assert.match(raw, /COLLABORATION AGREEMENT/);
    assert.match(raw, /1\. Parties/);
    assert.equal(/\?\?/.test(raw.replace(/%PDF[\s\S]*?obj/g, "")), false);
  });

  it("allows funding only after every party is signed", () => {
    assert.equal(fundingAllowedBySignature("sent").ok, false);
    assert.equal(fundingAllowedBySignature("draft").ok, false);
    assert.equal(fundingAllowedBySignature("signed").ok, true);
    const blocked = fundingAllowedBySignature("sent");
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.match(blocked.error, /every party/);
    assert.equal(applyEnvelopeToParties([{ status: "pending" }, { status: "pending" }], "completed").documentStatus, "signed");
    assert.equal(applyEnvelopeToParties([{ status: "pending" }], "declined").documentStatus, "declined");
    assert.equal(applyEnvelopeToParties([{ status: "pending" }], "sent").documentStatus, "sent");
  });

  it("describes in-app signing in the default template and stamps native attestations", () => {
    assert.match(DEFAULT_CONTRACT_TEMPLATE, /19\. Electronic Signature/);
    assert.match(DEFAULT_CONTRACT_TEMPLATE, /page-endorsement initials/);
    assert.match(DEFAULT_CONTRACT_TEMPLATE, /Commercial Summary/);
    const stamped = applyNativeSignatureAnchor(
      "Agreement\nBusiness  North  north@example.com  Pending Signature\n[[SIG_INK:1]]\n/sig1/\n",
      1,
      formatNativeAttestation({
        role: "business",
        typedName: "North Co",
        email: "north@example.com",
        signedAt: new Date("2026-10-18T12:00:00.000Z"),
      }),
    );
    assert.match(stamped, /Signed in Influrios/);
    assert.match(stamped, /Page endorsement initials/);
    assert.equal(stamped.includes("[[SIG:"), false);
    assert.match(stamped, /\[\[SIG_INK:1\]\]/);
    assert.equal(stamped.includes("/sig1/"), false);
    assert.match(stamped, /Signed\s*\n\s*\[\[SIG_INK:1\]\]/);
    assert.equal(/Pending Signature/.test(stamped), false);
  });

  it("draws signature ink and page endorsement markers into the PDF stream", () => {
    const body = "COLLABORATION AGREEMENT\n\n1. Parties\n[[SIG_INK:1]]\nSigned in Influrios - business: North Co\n";
    const pdf = renderContractPdf(body, {
      agreementId: "doc_test",
      signatures: [
        {
          partyIndex: 1,
          typedName: "North Co",
          role: "business",
          email: "north@example.com",
          signedAt: "2026-10-18T12:00:00.000Z",
        },
      ],
      pageEndorsements: true,
    });
    const raw = pdf.toString("latin1");
    assert.match(raw, /Page endorsement/);
    assert.match(raw, /\(INFLURIOS/);
    assert.match(raw, /Page endorsement \/ initials/);
    assert.ok(/[\d.]+ [\d.]+ [\d.]+ [\d.]+ [\d.]+ [\d.]+ c/.test(raw));
  });

  it("maps service level enums to display labels", () => {
    assert.equal(displayServiceLevel("managed_campaign"), "Managed campaign");
    assert.equal(displayServiceLevel("contracted"), "Contracted collaboration");
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
    assert.equal(messageVisible({ ...base, audience: "all_parties", senderUserId: "user_c", viewer: manager }), true);
    assert.equal(messageVisible({ ...base, audience: "admin", senderUserId: "user_c", viewer: manager }), false);
  });

  it("matches a party by email when userId is missing or stale", () => {
    const parties = [
      { id: "p1", userId: null as string | null, email: "Ada@Example.com" },
      { id: "p2", userId: "user_biz", email: "biz@example.com" },
    ];
    assert.equal(resolveContractPartyForAccount(parties, { id: "new_user", email: "ada@example.com" })?.id, "p1");
    assert.equal(resolveContractPartyForAccount(parties, { id: "user_biz", email: "other@example.com" })?.id, "p2");
    assert.equal(resolveContractPartyForAccount(parties, { id: "x", email: "missing@example.com" }), undefined);
  });

  it("routes notify emails to all parties or one recipient, skipping the sender", () => {
    const parties = [
      { id: "biz", email: "biz@example.com", userId: "u_biz" },
      { id: "ada", email: "ada@example.com", userId: "u_ada" },
      { id: "bea", email: "bea@example.com", userId: null },
    ];
    assert.deepEqual(
      contractMessageNotifyEmails({
        audience: "all_parties",
        parties,
        senderUserId: "u_biz",
        senderEmail: "biz@example.com",
      }),
      ["ada@example.com", "bea@example.com"],
    );
    assert.deepEqual(
      contractMessageNotifyEmails({
        audience: "party",
        parties,
        recipientPartyId: "ada",
        senderUserId: "u_biz",
        senderEmail: "biz@example.com",
      }),
      ["ada@example.com"],
    );
    assert.deepEqual(
      contractMessageNotifyEmails({
        audience: "admin",
        parties,
        senderUserId: "u_biz",
      }),
      [],
    );
  });

  it("writes clear email copy for each contract stage", () => {
    const sent = contractStageEmailCopy({
      stage: "sent",
      title: "Spring launch",
      link: "https://app.example/collaboration/contracts/c1",
      signingChannel: "native",
    });
    assert.match(sent.subject, /Action needed/);
    assert.match(sent.text, /Sign here|sign with your legal name/i);
    const done = contractStageEmailCopy({
      stage: "completed",
      title: "Spring launch",
      link: "https://app.example/collaboration/contracts/c1",
    });
    assert.match(done.subject, /Fully signed/);
    assert.match(done.text, /Funding can start/);
    const remind = contractStageEmailCopy({
      stage: "signature_reminder",
      title: "Spring launch",
      link: "https://app.example/c1",
      actorName: "North Co",
    });
    assert.match(remind.text, /Your signature is still needed/);
  });
});
