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
  explanation?: string | null;
};

export type FeeDisclosureRecord = FeeDisclosureInput & {
  acceptedAt: string;
  acceptedByUserId?: string | null;
};

export function buildFeeDisclosureSummary(input: FeeDisclosureInput): string {
  const lines: string[] = ["Fee schedule (locked for this agreement):"];
  lines.push(`- Jurisdiction: ${input.jurisdiction.toUpperCase()}`);
  lines.push(`- Service level: ${input.serviceLevel}`);
  lines.push(`- Gross (cents): ${input.grossCents}`);
  if (input.feeType) lines.push(`- Fee type: ${input.feeType}`);
  if (input.method === "percent" && input.percentBps != null) {
    lines.push(`- Rate: ${(input.percentBps / 100).toFixed(2)}%`);
  } else if (input.method === "fixed" && input.fixedCents != null) {
    lines.push(`- Rate: fixed ${input.fixedCents} cents`);
  } else if (input.method === "percent_plus_fixed") {
    lines.push(
      `- Rate: ${((input.percentBps ?? 0) / 100).toFixed(2)}% + ${input.fixedCents ?? 0} cents`,
    );
  } else if (input.method === "waived") {
    lines.push("- Rate: waived");
  } else if (input.method === "tiered") {
    lines.push("- Rate: tiered");
  } else if (input.method === "custom_enterprise" && input.fixedCents != null) {
    lines.push(`- Rate: enterprise ${input.fixedCents} cents`);
  }
  lines.push(`- Platform fee (cents): ${input.feeCents}`);
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
