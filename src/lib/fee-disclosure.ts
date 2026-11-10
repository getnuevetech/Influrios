/**
 * W3.12 — Fee disclosure acceptance (Dev Addendum §24 / Product Addendum §17).
 * Fee disclosure must be explicit and timestamped; legal text references the live
 * transaction fee schedule/snapshot rather than a hard-coded percentage.
 */

export type FeeDisclosureInput = {
  feeCents: number;
  ruleId?: string | null;
  ruleName?: string | null;
  ruleVersion?: number | null;
  feeType?: string | null;
  method?: string | null;
  percentBps?: number | null;
  fixedCents?: number | null;
  payer?: string | null;
  jurisdiction: string;
  serviceLevel: string;
  grossCents: number;
  currency?: string | null;
  explanation?: string | null;
  businessFeeCents?: number | null;
  influencerFeeCents?: number | null;
  businessPaysCents?: number | null;
  influencerReceivesCents?: number | null;
  influencerRuleId?: string | null;
  influencerRuleVersion?: number | null;
  feeState?: "reserved" | null;
};

export type FeeDisclosureRecord = FeeDisclosureInput & {
  acceptedAt: string;
  acceptedByUserId?: string | null;
};

function disclosureMoney(cents: number, currency: string | null | undefined): string {
  const code = (currency ?? "").trim().toUpperCase();
  const amount = cents / 100;
  if (/^[A-Z]{3}$/.test(code)) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

export function buildFeeDisclosureSummary(input: FeeDisclosureInput): string {
  const money = (cents: number) => disclosureMoney(cents, input.currency);
  const lines: string[] = ["Fee schedule (locked for this agreement):"];
  lines.push(`- Jurisdiction: ${input.jurisdiction.toUpperCase()}`);
  lines.push(`- Service level: ${input.serviceLevel}`);
  lines.push(`- Gross: ${money(input.grossCents)}`);
  if (input.feeType) lines.push(`- Fee type: ${input.feeType}`);
  if (input.method === "percent" && input.percentBps != null) {
    lines.push(`- Rate: ${(input.percentBps / 100).toFixed(2)}%`);
  } else if (input.method === "fixed" && input.fixedCents != null) {
    lines.push(`- Rate: fixed ${money(input.fixedCents)}`);
  } else if (input.method === "percent_plus_fixed") {
    lines.push(`- Rate: ${((input.percentBps ?? 0) / 100).toFixed(2)}% + ${money(input.fixedCents ?? 0)}`);
  } else if (input.method === "waived") {
    lines.push("- Rate: waived");
  } else if (input.method === "tiered") {
    lines.push("- Rate: tiered");
  } else if (input.method === "custom_enterprise" && input.fixedCents != null) {
    lines.push(`- Rate: enterprise ${money(input.fixedCents)}`);
  }
  lines.push(`- Platform fee: ${money(input.feeCents)}`);
  if (input.businessFeeCents != null) lines.push(`- Business platform fee: ${money(input.businessFeeCents)}`);
  if (input.influencerFeeCents != null) {
    lines.push(`- Influencer platform fee: ${money(input.influencerFeeCents)}`);
  }
  if (input.businessPaysCents != null) lines.push(`- Business pays: ${money(input.businessPaysCents)}`);
  if (input.influencerReceivesCents != null) {
    lines.push(`- Influencer receives: ${money(input.influencerReceivesCents)}`);
  }
  if (input.influencerRuleId) {
    lines.push(`- Influencer rule: ${input.influencerRuleId} v${input.influencerRuleVersion ?? "n/a"}`);
  }
  if (input.feeState === "reserved") {
    lines.push("- Fee state: reserved. Not earned. Not settled to Influrios.");
  }
  if (input.ruleId) lines.push(`- Rule: ${input.ruleId} v${input.ruleVersion ?? "n/a"}`);
  if (input.ruleName) lines.push(`- Rule name: ${input.ruleName}`);
  if (input.payer) lines.push(`- Payer: ${input.payer}`);
  if (input.explanation?.trim()) lines.push(`- Note: ${input.explanation.trim()}`);
  return lines.join("\n");
}

export function requireFeeDisclosureAccepted(input: {
  accepted: boolean;
  disclosure: FeeDisclosureInput | null;
}): { ok: true; record: FeeDisclosureRecord } | { ok: false; error: string } {
  if (!input.disclosure) {
    return { ok: false, error: "A fee quote is required before accepting the fee disclosure." };
  }
  if (!input.accepted) {
    return {
      ok: false,
      error: "Accept the fee disclosure for this collaboration before funding.",
    };
  }
  if (!Number.isInteger(input.disclosure.feeCents) || input.disclosure.feeCents < 0) {
    return { ok: false, error: "Fee disclosure is incomplete." };
  }
  return {
    ok: true,
    record: {
      ...input.disclosure,
      acceptedAt: new Date().toISOString(),
    },
  };
}

/** Legal pack documents that must be acknowledged with a collaboration fee disclosure. */
export const FEE_DISCLOSURE_LEGAL_KEYS = [
  "marketplace-terms",
  "protected-payments-policy",
] as const;
