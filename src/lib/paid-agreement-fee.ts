/**
 * The contract quotes the fee rule saved for the service level on the agreement.
 * Discovery with a fixed zero stays zero. Platform Match uses the Platform Match rules.
 */

export type DealOrigin = "discovery" | "platform_match" | "direct" | "managed_intro" | "managed_campaign";

export type PaidAgreementFeeBoundary = {
  originServiceLevel: DealOrigin;
  feeServiceLevel: "discovery" | "platform_match" | "contracted" | "managed_intro" | "managed_campaign";
  freeDiscovery: boolean;
};

export function resolvePaidAgreementFee(input: {
  statedServiceLevel?: string | null;
  grossCents: number;
}): PaidAgreementFeeBoundary {
  const stated = String(input.statedServiceLevel ?? "").trim().toLowerCase();
  const paid = Number.isInteger(input.grossCents) && input.grossCents > 0;
  if (stated === "managed_intro" || stated === "managed_campaign" || stated === "platform_match" || stated === "discovery" || stated === "contracted") {
    return {
      originServiceLevel: stated === "contracted" ? "direct" : stated,
      feeServiceLevel: stated,
      freeDiscovery: stated === "discovery" && !paid,
    };
  }
  return { originServiceLevel: "direct", feeServiceLevel: "contracted", freeDiscovery: false };
}

export function feeLevelForSignedTerms(terms: {
  serviceLevel?: string | null;
  feeServiceLevel?: string | null;
  grossCents?: number | null;
}): string {
  const stated = String(terms.serviceLevel ?? "").trim().toLowerCase();
  if (stated === "discovery" || stated === "platform_match" || stated === "contracted" || stated === "managed_intro" || stated === "managed_campaign") {
    return stated;
  }
  const stored = String(terms.feeServiceLevel ?? "").trim().toLowerCase();
  if (stored) return stored;
  return resolvePaidAgreementFee({
    statedServiceLevel: terms.serviceLevel,
    grossCents: Number(terms.grossCents ?? 0),
  }).feeServiceLevel;
}

export const REPRICE_REQUIRES_NEW_AGREEMENT =
  "A new agreement version and fresh signatures are required before these amounts can change. Nothing was repriced.";

/** Rows the pilot migration deactivates. Custom rules outside this quote stay active. */
export function pilotMigrationDeactivates(rule: {
  id: string;
  active: boolean;
  payer?: string | null;
  purpose?: string | null;
  serviceLevel?: string | null;
  jurisdiction?: string | null;
  fundingMode?: string | null;
  relationshipSource?: string | null;
  promotionChannel?: string | null;
}): boolean {
  if (!rule.active || rule.id.startsWith("rule_pilot_")) return false;
  const payer = rule.payer ?? "";
  const purpose = rule.purpose ?? "legacy";
  if (payer !== "brand" && payer !== "creator") return false;
  if (purpose !== "business_platform_fee" && purpose !== "influencer_platform_fee" && purpose !== "legacy") return false;
  const fundingMode = rule.fundingMode ?? "*";
  const relationshipSource = rule.relationshipSource ?? "*";
  const promotionChannel = rule.promotionChannel ?? "*";
  if (![fundingMode, relationshipSource, promotionChannel].every((value) => value === "*" || value === "")) return false;
  const serviceLevel = rule.serviceLevel ?? "";
  const jurisdiction = (rule.jurisdiction ?? "").toUpperCase();
  if (serviceLevel === "discovery" || serviceLevel === "*") return true;
  if ((serviceLevel === "contracted" || serviceLevel === "platform_match") && (jurisdiction === "US" || jurisdiction === "*")) {
    return true;
  }
  return false;
}
