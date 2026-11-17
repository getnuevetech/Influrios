/**
 * Contract document types for the Agreements / Templates workspace.
 * Each template declares required parties, editable sections, and supported actions
 * so Influrios can add another document type without a new contracts page.
 */

export const CONTRACT_DOCUMENT_TYPES = [
  {
    id: "collaboration",
    name: "Influencer collaboration agreement",
    shortName: "Collaboration Agreement",
    typeLabel: "Collaboration",
    description:
      "Core brand collaborations: parties, scope, deliverables, compensation, milestones, usage rights, and signatures.",
    whenToUse: "Use when a business and influencer need a signed commercial agreement that can unlock funding.",
    version: "v1.0",
    requiredParties: ["business", "influencer"] as const,
    requiredData: ["campaign", "scope", "compensation", "milestones", "usage"] as const,
    editableSections: ["scope", "deliverables", "compensation", "rights", "confidentiality"] as const,
    protectedSections: ["parties"] as const,
    signerRoles: ["business_authorized", "influencer_authorized"] as const,
    supportedActions: ["send_for_signature", "fund_when_eligible", "amend"] as const,
    linksToFunding: true,
    requiresCollaboration: true,
    platform: true,
  },
  {
    id: "statement_of_work",
    name: "Statement of work",
    shortName: "Statement of Work",
    typeLabel: "Scope",
    description: "Defines deliverables, channels, dates, revisions, and acceptance criteria for a collaboration.",
    whenToUse: "Attach to a named collaboration agreement when the schedule of work needs its own signed schedule.",
    version: "v1.0",
    requiredParties: ["business", "influencer"] as const,
    requiredData: ["deliverables", "channels", "dates", "acceptance"] as const,
    editableSections: ["deliverables", "timeline", "acceptance"] as const,
    protectedSections: ["parties", "parent_agreement"] as const,
    signerRoles: ["business_authorized", "influencer_authorized"] as const,
    supportedActions: ["send_for_signature", "attach_to_agreement"] as const,
    linksToFunding: false,
    requiresCollaboration: true,
    platform: true,
  },
  {
    id: "change_order",
    name: "Change order",
    shortName: "Change Order / Amendment",
    typeLabel: "Amendment",
    description: "Shows original terms, proposed changes, effective date, and required signatures.",
    whenToUse: "Use after a signed agreement when compensation, milestones, or rights change.",
    version: "v1.0",
    requiredParties: ["business", "influencer"] as const,
    requiredData: ["parent_agreement", "original_terms", "proposed_changes", "effective_date"] as const,
    editableSections: ["proposed_changes", "effective_date"] as const,
    protectedSections: ["parties", "parent_agreement", "original_terms"] as const,
    signerRoles: ["business_authorized", "influencer_authorized"] as const,
    supportedActions: ["send_for_signature", "revise_quote", "reconcile_funding"] as const,
    linksToFunding: true,
    requiresCollaboration: true,
    platform: true,
  },
  {
    id: "nda",
    name: "NDA (Non-disclosure agreement)",
    shortName: "Mutual NDA",
    typeLabel: "Confidentiality",
    description: "Protects confidential information exchanged before or beside a commercial deal.",
    whenToUse: "Sign independently before a commercial deal exists. Signing creates no funding instruction.",
    version: "v1.0",
    requiredParties: ["party_a", "party_b"] as const,
    requiredData: ["party_identities", "confidentiality_scope"] as const,
    editableSections: ["confidentiality_scope", "term"] as const,
    protectedSections: ["parties"] as const,
    signerRoles: ["party_a_authorized", "party_b_authorized"] as const,
    supportedActions: ["invite_counterparty", "send_for_signature"] as const,
    linksToFunding: false,
    requiresCollaboration: false,
    platform: true,
  },
] as const;

export type ContractDocumentTypeId = (typeof CONTRACT_DOCUMENT_TYPES)[number]["id"];

export function isContractDocumentTypeId(value: string): value is ContractDocumentTypeId {
  return CONTRACT_DOCUMENT_TYPES.some((row) => row.id === value);
}

export function contractDocumentType(id: string) {
  return CONTRACT_DOCUMENT_TYPES.find((row) => row.id === id) ?? CONTRACT_DOCUMENT_TYPES[0];
}

export function contractDocumentTypeLabel(id: string | null | undefined) {
  if (!id?.trim()) return CONTRACT_DOCUMENT_TYPES[0].shortName;
  return contractDocumentType(id).shortName;
}

/** Human label for list filters and badges. */
export function signatureStatusBucket(input: {
  status: string;
  parties: { status: string; userId?: string | null; email?: string }[];
  accountId: string;
  email: string;
  signingChannel?: string | null;
}): "draft" | "yours" | "others" | "signed" | "expired" {
  if (input.status === "voided" || input.status === "declined") return "expired";
  if (input.status === "signed") return "signed";
  if (input.status === "draft") return "draft";
  const email = input.email.trim().toLowerCase();
  const mine = input.parties.find((party) => {
    if (party.userId && party.userId === input.accountId) return true;
    if (!email || (party.email ?? "").trim().toLowerCase() !== email) return false;
    return !party.userId || party.userId === input.accountId;
  });
  if (
    (input.signingChannel ?? "native") === "native" &&
    (input.status === "sent" || input.status === "draft") &&
    mine?.status === "pending"
  ) {
    return "yours";
  }
  return "others";
}

export function signatureStatusLabel(bucket: ReturnType<typeof signatureStatusBucket>) {
  if (bucket === "yours") return "Needs your signature";
  if (bucket === "others") return "Awaiting others";
  if (bucket === "signed") return "Fully signed";
  if (bucket === "draft") return "Draft";
  return "Expired";
}

export function fundingStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  if (status === "held" || status === "completed") return "Confirmed";
  if (status === "awaiting_provider") return "Awaiting funding";
  if (status === "cancelled" || status === "refunded") return status.replaceAll("_", " ");
  return status.replaceAll("_", " ");
}
