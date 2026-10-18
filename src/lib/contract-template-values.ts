/**
 * Maps collaboration records into Influrios template [[PLACEHOLDER]] display values.
 * Spec: no raw enums, no blank optional rows, money and dates formatted for display.
 */
import type {
  ContractChromeDocument,
  ContractPartyInput,
  ContractRenderInput,
} from "@/lib/contract-document";
import { SERVICE_LEVEL_LABELS, type ServiceLevel } from "@/lib/collaboration-fees";

export type ContractTemplateValues = Record<string, string>;

/** ASCII placeholder for empty display values (PDF Helvetica/Times safe). */
const DASH = "-";

function dash(value: string | null | undefined): string {
  const next = (value ?? "").trim();
  return next ? next : DASH;
}

function displayServiceLevel(value: string): string {
  const key = value.trim().toLowerCase() as ServiceLevel;
  if (key in SERVICE_LEVEL_LABELS) return SERVICE_LEVEL_LABELS[key];
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatContractDisplayDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : DASH;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Build template placeholders from a contract send / render input. */
export function templateValuesFromRenderInput(input: ContractRenderInput): ContractTemplateValues {
  const business = input.parties.find((party) => party.role === "business");
  const influencers = input.parties.filter((party) => party.role === "creator");
  const inf1 = influencers[0];
  const inf2 = influencers[1];
  const m1 = input.milestones[0];
  const m2 = input.milestones[1];
  const m3 = input.milestones[2];

  const values: ContractTemplateValues = {
    CAMPAIGN_NAME: dash(input.title),
    AGREEMENT_ID: dash(input.agreementId),
    AGREEMENT_STATUS_DISPLAY: dash(input.agreementStatus ?? "Ready for Signature"),
    GENERATED_DATE_LONG: formatContractDisplayDate(input.generatedAt),
    JURISDICTION_DISPLAY: dash(input.jurisdiction),
    BUSINESS_LEGAL_NAME: dash(input.businessName || business?.name),
    BUSINESS_EMAIL: dash(input.businessEmail || business?.email),
    BUSINESS_ACCOUNT_DISPLAY: dash(business?.email),
    BUSINESS_SIGNER_NAME: dash(business?.name),
    BUSINESS_SIGNER_EMAIL: dash(business?.email),
    BUSINESS_SIGNATURE_STATUS: "Pending Signature",
    BUSINESS_SIGNED_AT_DISPLAY: DASH,
    SERVICE_LEVEL_DISPLAY: displayServiceLevel(input.serviceLevel),
    CURRENCY_CODE: dash(input.currency),
    GROSS_CONTRACT_VALUE_DISPLAY: dash(input.grossLabel),
    PLATFORM_FEE_DISPLAY: dash(input.platformFeeLabel),
    PLATFORM_FEE_RATE_DISPLAY: DASH,
    INFLUENCER_COMPENSATION_DISPLAY: dash(input.creatorCompensationLabel),
    FEE_PAYER_DISPLAY: "Business",
    CAMPAIGN_START_DATE_DISPLAY: DASH,
    CAMPAIGN_END_DATE_DISPLAY: DASH,
    CAMPAIGN_PERIOD: dash(input.campaignPeriod),
    CAMPAIGN_OBJECTIVE: dash(input.commercial),
    CAMPAIGN_SCOPE: dash(input.scope),
    REQUIRED_CHANNELS_DISPLAY: "Per campaign record",
    DELIVERABLES_SUMMARY: dash(input.scope),
    REQUIRED_DISCLOSURES_AND_TAGS: "Per campaign record",
    CREATIVE_REQUIREMENTS: "Per campaign record",
    CONTENT_USAGE_RIGHTS_DISPLAY: "Per campaign record",
    EXCLUSIVITY_TERMS_OR_NONE: dash(input.exclusivity ?? "None"),
    ORGANIC_USAGE_TERM: "Per campaign record",
    PAID_USAGE_TERM: "Not granted unless stated in the campaign record",
    USAGE_TERRITORY: "Per campaign record",
    USAGE_DURATION: "Per campaign record",
    EDITING_RIGHTS: "Per campaign record",
    OWNERSHIP_BUYOUT_TERMS_OR_NONE: "Influencer retains ownership; license only as stated",
    FEE_RULE_DISPLAY: dash(input.feeDisclosure),
    APPROVAL_PERIOD_DISPLAY: dash(input.approvalPeriod ?? "Per campaign workflow"),
    REVISION_ALLOWANCE_DISPLAY: dash(input.revisionAllowance ?? "Per campaign workflow"),
    CURE_PERIOD_DISPLAY: dash(input.curePeriod ?? "Per campaign workflow"),
    DISPUTE_WINDOW_DISPLAY: dash(input.disputeWindow ?? "Per campaign workflow"),
    DISPUTE_FORUM_DISPLAY: dash(input.disputeForum ?? input.jurisdiction),
    GOVERNING_LAW_DISPLAY: dash(input.jurisdiction),
    ESIGN_PROVIDER_DISPLAY: dash(input.esignProvider ?? "Influrios in-app signing"),
    ESIGN_ENVELOPE_ID: DASH,
    ESIGN_COMPLETED_AT_DISPLAY: DASH,
    AGREEMENT_VERSION_OR_HASH: "influrios-collab-v1",
    INFLUENCER_COUNT: String(influencers.length),
  };

  if (input.campaignPeriod?.includes(" to ")) {
    const [start, end] = input.campaignPeriod.split(/\s+to\s+/i);
    values.CAMPAIGN_START_DATE_DISPLAY = dash(start);
    values.CAMPAIGN_END_DATE_DISPLAY = dash(end);
  }

  values.INFLUENCER_1_LEGAL_OR_DISPLAY_NAME = dash(inf1?.name);
  values.INFLUENCER_1_EMAIL = dash(inf1?.email);
  values.INFLUENCER_1_HANDLE = inf1?.creatorSlug ? `@${inf1.creatorSlug}` : DASH;
  values.INFLUENCER_1_SHARE_PERCENT = inf1?.shareBps != null ? `${(inf1.shareBps / 100).toFixed(2)}%` : DASH;
  values.INFLUENCER_1_TOTAL_COMP_DISPLAY = DASH;
  values.INFLUENCER_1_DISPLAY_NAME = dash(inf1?.name);
  values.INFLUENCER_1_SIGNER_NAME = dash(inf1?.name);
  values.INFLUENCER_1_SIGNER_EMAIL = dash(inf1?.email);
  values.INFLUENCER_1_SIGNATURE_STATUS = "Pending Signature";
  values.INFLUENCER_1_SIGNED_AT_DISPLAY = DASH;

  values.INFLUENCER_2_LEGAL_OR_DISPLAY_NAME_IF_ANY = inf2 ? dash(inf2.name) : "";
  values.INFLUENCER_2_EMAIL_IF_ANY = inf2 ? dash(inf2.email) : "";
  values.INFLUENCER_2_HANDLE_IF_ANY = inf2?.creatorSlug ? `@${inf2.creatorSlug}` : "";
  values.INFLUENCER_2_SHARE_PERCENT_IF_ANY = inf2?.shareBps != null ? `${(inf2.shareBps / 100).toFixed(2)}%` : "";
  values.INFLUENCER_2_TOTAL_COMP_DISPLAY_IF_ANY = "";
  values.INFLUENCER_2_DISPLAY_NAME_IF_ANY = inf2 ? dash(inf2.name) : "";
  values.INFLUENCER_2_SIGNER_NAME_IF_ANY = inf2 ? dash(inf2.name) : "";
  values.INFLUENCER_2_SIGNER_EMAIL_IF_ANY = inf2 ? dash(inf2.email) : "";
  values.INFLUENCER_2_SIGNATURE_STATUS_IF_ANY = inf2 ? "Pending Signature" : "";
  values.INFLUENCER_2_SIGNED_AT_DISPLAY_IF_ANY = "";

  const milestoneFields = [
    ["MILESTONE_1", m1],
    ["MILESTONE_2", m2],
    ["MILESTONE_3", m3],
  ] as const;
  for (const [prefix, row] of milestoneFields) {
    values[`${prefix}_NAME`] = row ? dash(row.title) : "";
    values[`${prefix}_PERCENT`] = row ? dash(row.shareLabel) : "";
    values[`${prefix}_GROSS_DISPLAY`] = row ? dash(row.grossLabel) : "";
    values[`${prefix}_FEE_DISPLAY`] = row ? dash(row.feeLabel) : "";
    values[`${prefix}_INFLUENCER_DISPLAY`] = row ? dash(row.creatorShares) : "";
    values[`${prefix}_DUE_DATE`] = row ? "Per campaign workflow" : "";
  }

  values.__MILESTONE_COUNT__ = String(input.milestones.length);
  values.__INFLUENCER_COUNT__ = String(influencers.length);
  return values;
}

/** Build template placeholders from a stored chrome document (incl. legacy upgrade path). */
export function templateValuesFromChromeDocument(document: ContractChromeDocument): ContractTemplateValues {
  const business = document.parties.find((party) => party.role === "business");
  const influencers = document.parties.filter(
    (party) => party.role === "creator" || party.role === "influencer",
  );
  const parties: ContractPartyInput[] = [
    ...(business
      ? [
          {
            role: "business" as const,
            name: business.name,
            email: business.email,
            userId: business.userId,
            shareBps: business.shareBps ?? 0,
          },
        ]
      : []),
    ...influencers.map((party) => ({
      role: "creator" as const,
      name: party.name,
      email: party.email,
      userId: party.userId,
      creatorSlug: party.creatorSlug,
      shareBps: party.shareBps ?? 0,
    })),
  ];

  const body = document.renderedBody || "";
  const field = (label: string) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Legacy "Label: value" or chrome table "Label  value" (2+ spaces).
    const match =
      body.match(new RegExp(`${escaped}:\\s*(.+)$`, "im")) ||
      body.match(new RegExp(`^${escaped}\\s{2,}(.+)$`, "im")) ||
      body.match(new RegExp(`${escaped}\\s{2,}(.+)$`, "im"));
    return match?.[1]?.trim() ?? "";
  };

  const statusLabel =
    document.status === "signed"
      ? "Fully Executed"
      : document.status === "sent"
        ? "Ready for Signature"
        : document.status === "draft"
          ? "Draft"
          : document.status;

  const input: ContractRenderInput = {
    title: document.title || field("campaign") || "Collaboration agreement",
    scope: field("Scope") || field("Scope of Work") || "Per campaign record",
    commercial: field("Commercial terms") || field("Campaign Objective") || "Per campaign record",
    jurisdiction: field("Jurisdiction") || "Per campaign record",
    serviceLevel: field("Service level") || field("Service Level") || "contracted",
    currency: field("Currency") || "USD",
    grossLabel: field("Gross contract value") || field("Gross Contract Value") || DASH,
    platformFeeLabel: field("Platform fee") || field("Influrios Platform Fee") || DASH,
    creatorCompensationLabel:
      field("Creator compensation") || field("Influencer Compensation Pool") || DASH,
    businessName: business?.name || field("Business")?.replace(/\s*\(.*\)$/, "") || "Business",
    businessEmail: business?.email || "",
    parties,
    milestones: parseMilestonesFromBody(body),
    feeDisclosure: body.match(/Fee rule[^\n]*/i)?.[0]?.trim() || "Per campaign fee disclosure",
    generatedAt:
      (typeof document.createdAt === "string" ? document.createdAt : document.createdAt?.toISOString()) ||
      field("Generated") ||
      new Date().toISOString(),
    agreementId: document.id,
    agreementStatus: statusLabel,
    esignProvider: document.signingChannel === "docusign" ? "DocuSign" : "Influrios in-app signing",
  };

  const values = templateValuesFromRenderInput(input);

  // Overlay live signature status from party rows.
  document.parties.forEach((party, index) => {
    const signed = party.status === "signed";
    const when =
      party.signedAt instanceof Date
        ? formatContractDisplayDate(party.signedAt)
        : party.signedAt
          ? formatContractDisplayDate(String(party.signedAt))
          : DASH;
    const name = (party.attestation || party.name || "").trim();
    if (party.role === "business") {
      values.BUSINESS_SIGNATURE_STATUS = signed ? "Signed" : "Pending Signature";
      values.BUSINESS_SIGNED_AT_DISPLAY = signed ? when : DASH;
      if (name) values.BUSINESS_SIGNER_NAME = name;
    } else if (index === 1 || (party.role !== "business" && !values.INFLUENCER_1_SIGNED_AT_DISPLAY)) {
      // first influencer
    }
  });

  const creatorParties = document.parties.filter((party) => party.role !== "business");
  creatorParties.forEach((party, index) => {
    const signed = party.status === "signed";
    const when =
      party.signedAt instanceof Date
        ? formatContractDisplayDate(party.signedAt)
        : party.signedAt
          ? formatContractDisplayDate(String(party.signedAt))
          : DASH;
    const name = (party.attestation || party.name || "").trim();
    if (index === 0) {
      values.INFLUENCER_1_SIGNATURE_STATUS = signed ? "Signed" : "Pending Signature";
      values.INFLUENCER_1_SIGNED_AT_DISPLAY = signed ? when : DASH;
      if (name) values.INFLUENCER_1_SIGNER_NAME = name;
    } else if (index === 1) {
      values.INFLUENCER_2_SIGNATURE_STATUS_IF_ANY = signed ? "Signed" : "Pending Signature";
      values.INFLUENCER_2_SIGNED_AT_DISPLAY_IF_ANY = signed ? when : "";
      if (name) values.INFLUENCER_2_SIGNER_NAME_IF_ANY = name;
    }
  });

  if (document.status === "signed") {
    values.ESIGN_COMPLETED_AT_DISPLAY = formatContractDisplayDate(new Date());
    values.ESIGN_ENVELOPE_ID = `native:${document.id}`;
  }

  return values;
}

function parseMilestonesFromBody(body: string): ContractRenderInput["milestones"] {
  const section = body.split(/\n\s*4\.\s+Milestones\b/i)[1]?.split(/\n\s*5\.\s+/i)[0] ?? "";
  if (!section.trim() || /none scheduled/i.test(section)) return [];
  // New chrome table rows: "1. Title  34%  $1,700.00  ..."
  const rows: ContractRenderInput["milestones"] = [];
  for (const line of section.split("\n")) {
    const match = line.match(/^\d+\.\s+(.+?)\s{2,}(\S+)\s{2,}(\$\S+)/);
    if (match) {
      rows.push({
        title: match[1].trim(),
        shareLabel: match[2],
        grossLabel: match[3],
        feeLabel: DASH,
        creatorShares: DASH,
      });
      continue;
    }
  }
  if (rows.length) return rows;
  // Legacy block format
  const blocks = section.split(/\n(?=\d+\.\s+)/).map((block) => block.trim()).filter(Boolean);
  for (const block of blocks) {
    const title = block.match(/^\d+\.\s+(.+)/)?.[1]?.trim() ?? "";
    if (!title || /none scheduled/i.test(title)) continue;
    const field = (label: string) => block.match(new RegExp(`${label}:\\s*(.+)`, "i"))?.[1]?.trim() ?? DASH;
    rows.push({
      title: title.split("\n")[0].trim(),
      shareLabel: field("Share"),
      grossLabel: field("Gross"),
      feeLabel: field("Platform fee"),
      creatorShares: field("Creator payout"),
    });
  }
  return rows;
}
