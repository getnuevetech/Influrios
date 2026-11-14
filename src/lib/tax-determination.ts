/**
 * Every subscription invoice, collaboration sale, and fee gets its own tax
 * determination. Influrios collects the applicable amount and keeps the reason
 * for a valid zero. Milestone payouts carry those original records and do not
 * calculate tax again. A failed calculation is never stored as zero.
 */
import { allocateByLargestRemainder } from "@/lib/largest-remainder";

export const TAX_SALE_EVENTS = [
  "subscription_invoice",
  "collaboration_sale",
  "business_fee",
  "influencer_fee",
] as const;

export type TaxSaleEvent = (typeof TAX_SALE_EVENTS)[number];

export type SaleTaxInput = {
  event: TaxSaleEvent;
  subjectId: string;
  baseCents: number;
  inclusive: boolean;
  result: { state: "calculated"; taxCents: number; reason: string } | { state: "failed"; detail: string };
};

export type SaleTaxLine = {
  event: TaxSaleEvent;
  subjectId: string;
  baseCents: number;
  taxCents: number;
  reason: string;
  inclusive: boolean;
  /** Added to the payer, already inside an inclusive price, or deducted once from the influencer. */
  collection: "added" | "included" | "deducted";
  collectedCents: number;
  storedFromFailure: false;
};

export function determineSaleTax(
  input: SaleTaxInput,
): { ok: true; line: SaleTaxLine } | { ok: false; error: string; storedAsZero: false } {
  if (!TAX_SALE_EVENTS.includes(input.event)) {
    return { ok: false, error: "That sale is not a tax subject.", storedAsZero: false };
  }
  if (!input.subjectId.trim()) {
    return { ok: false, error: "The tax subject is missing.", storedAsZero: false };
  }
  if (!Number.isInteger(input.baseCents) || input.baseCents < 0) {
    return { ok: false, error: "The taxable amount is not a valid minor amount.", storedAsZero: false };
  }
  if (input.result.state === "failed") {
    const detail = input.result.detail.trim();
    return {
      ok: false,
      error: detail || "Tax calculation failed. Nothing was stored as zero.",
      storedAsZero: false,
    };
  }
  if (!Number.isInteger(input.result.taxCents) || input.result.taxCents < 0) {
    return { ok: false, error: "The tax amount is unreadable. Nothing was stored as zero.", storedAsZero: false };
  }
  const reason = input.result.reason.trim();
  if (!reason) {
    return { ok: false, error: "A tax determination needs a reason, including a valid zero.", storedAsZero: false };
  }
  const collection =
    input.event === "influencer_fee" ? (input.inclusive ? "included" : "deducted") : input.inclusive ? "included" : "added";
  const collectedCents = collection === "added" ? input.baseCents + input.result.taxCents : input.baseCents;
  return {
    ok: true,
    line: {
      event: input.event,
      subjectId: input.subjectId.trim(),
      baseCents: input.baseCents,
      taxCents: input.result.taxCents,
      reason,
      inclusive: input.inclusive,
      collection,
      collectedCents,
      storedFromFailure: false,
    },
  };
}

export function combineCollaborationTax(input: { sale: SaleTaxLine; businessFee: SaleTaxLine; influencerFee: SaleTaxLine }) {
  if (input.sale.event !== "collaboration_sale" || input.businessFee.event !== "business_fee" || input.influencerFee.event !== "influencer_fee") {
    return { ok: false as const, error: "A collaboration checkout needs the sale and both fees.", storedAsZero: false as const };
  }
  const deducted = input.influencerFee.collection === "deducted" ? input.influencerFee.taxCents : 0;
  const added =
    (input.sale.collection === "added" ? input.sale.taxCents : 0) +
    (input.businessFee.collection === "added" ? input.businessFee.taxCents : 0);
  const influencerNetCents = input.sale.baseCents - input.influencerFee.baseCents - deducted;
  if (influencerNetCents < 0) {
    return { ok: false as const, error: "Influencer fee tax reduces the payout below zero. Nothing was stored.", storedAsZero: false as const };
  }
  const operationsCents = input.businessFee.baseCents + input.influencerFee.baseCents;
  const businessPaysCents = input.sale.baseCents + input.businessFee.baseCents + added;
  const taxLiabilityCents = input.sale.taxCents + input.businessFee.taxCents + input.influencerFee.taxCents;
  if (influencerNetCents + operationsCents + added + deducted !== businessPaysCents) {
    return { ok: false as const, error: "The tax determination does not reconcile. Nothing was stored.", storedAsZero: false as const };
  }
  return {
    ok: true as const,
    businessPaysCents,
    influencerNetCents,
    operationsCents,
    taxLiabilityCents,
    lines: [input.sale, input.businessFee, input.influencerFee],
    chargedAgain: false as const,
  };
}

export type CarriedTaxLine = {
  event: string;
  subjectId: string;
  taxCents: number;
  reason: string;
  source: "original";
  chargedAgain: false;
};

export type CarriedPayout = {
  taxCents: number;
  lines: CarriedTaxLine[];
  chargedAgain: false;
  payoutPaid: false;
  moneyMoved: false;
};

/** Split original tax by milestone weight. The rates are not applied again. */
export function carryOriginalTaxThroughPayouts(input: {
  lines: { event: string; subjectId: string; taxCents: number; reason: string }[];
  weightsBps: number[];
}): { ok: true; payouts: CarriedPayout[]; chargedAgain: false } | { ok: false; error: string; storedAsZero: false } {
  if (input.lines.length === 0) {
    return { ok: false, error: "A payout needs the original tax records. A missing determination is not zero.", storedAsZero: false };
  }
  for (const line of input.lines) {
    if (!Number.isInteger(line.taxCents) || line.taxCents < 0) {
      return { ok: false, error: "An original tax amount is unreadable. Nothing was stored as zero.", storedAsZero: false };
    }
    if (!line.reason.trim()) {
      return { ok: false, error: "A valid zero needs its original reason. Nothing was stored as zero.", storedAsZero: false };
    }
  }
  const shares = input.lines.map((line) => allocateByLargestRemainder(line.taxCents, input.weightsBps));
  if (shares.some((share) => !share)) {
    return { ok: false, error: "Milestone weights must add up to 100% before original tax can be carried.", storedAsZero: false };
  }
  const payouts = input.weightsBps.map((_, index) => {
    const lines = input.lines.map((line, lineIndex) => ({
      event: line.event,
      subjectId: line.subjectId,
      taxCents: shares[lineIndex]?.[index] ?? 0,
      reason: line.reason.trim(),
      source: "original" as const,
      chargedAgain: false as const,
    }));
    return {
      taxCents: lines.reduce((sum, line) => sum + line.taxCents, 0),
      lines,
      chargedAgain: false as const,
      payoutPaid: false as const,
      moneyMoved: false as const,
    };
  });
  const carried = payouts.reduce((sum, payout) => sum + payout.taxCents, 0);
  const original = input.lines.reduce((sum, line) => sum + line.taxCents, 0);
  if (carried !== original) {
    return { ok: false, error: "Carried tax does not match the original tax. Nothing was stored.", storedAsZero: false };
  }
  return { ok: true, payouts, chargedAgain: false };
}

function weightsFromParts(parts: number[]): number[] | null {
  const sum = parts.reduce((total, part) => total + part, 0);
  if (parts.length === 0 || parts.some((part) => !Number.isInteger(part) || part < 0) || sum <= 0) return null;
  const weights = parts.map((part) => Math.floor((part * 10_000) / sum));
  let left = 10_000 - weights.reduce((total, weight) => total + weight, 0);
  const order = parts
    .map((part, index) => ({ index, remainder: (part * 10_000) % sum }))
    .sort((leftRow, rightRow) => rightRow.remainder - leftRow.remainder || leftRow.index - rightRow.index);
  for (const row of order) {
    if (left <= 0) break;
    weights[row.index] += 1;
    left -= 1;
  }
  if (left !== 0 || weights.reduce((total, weight) => total + weight, 0) !== 10_000) return null;
  return weights;
}

/** Read the signed quote and carry this milestone's share of the original tax. */
export function carriedSettlementTax(input: {
  quote: unknown;
  milestoneId: string;
}): { ok: true; taxCents: number | null; taxReason: string; chargedAgain: false; payoutPaid: false; moneyMoved: false } | { ok: false; error: string; storedAsZero: false } {
  const none = { ok: true as const, taxCents: null, taxReason: "", chargedAgain: false as const, payoutPaid: false as const, moneyMoved: false as const };
  if (!input.quote || typeof input.quote !== "object") return none;
  const quote = input.quote as { taxStatus?: unknown; taxLines?: unknown; milestoneAllocations?: unknown };
  const status = typeof quote.taxStatus === "string" ? quote.taxStatus : "";
  const rawLines = Array.isArray(quote.taxLines) ? quote.taxLines : null;
  if (!status && !rawLines) return none;
  if (status === "unresolved") {
    return { ok: false, error: "Tax is not determined for this agreement. Nothing was stored as zero.", storedAsZero: false };
  }
  if (!rawLines || rawLines.length === 0) {
    if (status === "approved_zero" || status === "approved") {
      return { ok: false, error: "A valid zero needs its original reason. Nothing was stored as zero.", storedAsZero: false };
    }
    return none;
  }
  const lines: { event: string; subjectId: string; taxCents: number; reason: string }[] = [];
  for (const row of rawLines) {
    if (!row || typeof row !== "object") {
      return { ok: false, error: "A tax record could not be read. Nothing was stored as zero.", storedAsZero: false };
    }
    const record = row as { amountCents?: unknown; disposition?: unknown; type?: unknown; ruleVersion?: unknown };
    if (!Number.isInteger(record.amountCents) || Number(record.amountCents) < 0) {
      return { ok: false, error: "A tax record has no amount. Nothing was stored as zero.", storedAsZero: false };
    }
    const reason = typeof record.disposition === "string" ? record.disposition.trim() : "";
    if (!reason) {
      return { ok: false, error: "A tax record needs its original reason. Nothing was stored as zero.", storedAsZero: false };
    }
    lines.push({
      event: typeof record.type === "string" && record.type.trim() ? record.type : "tax",
      subjectId: typeof record.ruleVersion === "string" && record.ruleVersion.trim() ? record.ruleVersion : "original",
      taxCents: Number(record.amountCents),
      reason,
    });
  }
  const allocations = Array.isArray(quote.milestoneAllocations) ? quote.milestoneAllocations : [];
  const grosses: number[] = [];
  let index = -1;
  for (const row of allocations) {
    if (!row || typeof row !== "object") continue;
    const gross = (row as { grossCents?: unknown }).grossCents;
    const id = (row as { milestoneId?: unknown }).milestoneId;
    if (!Number.isInteger(gross) || Number(gross) < 0) continue;
    if (typeof id === "string" && id === input.milestoneId) index = grosses.length;
    grosses.push(Number(gross));
  }
  if (grosses.length === 0) {
    return {
      ok: true,
      taxCents: lines.reduce((sum, line) => sum + line.taxCents, 0),
      taxReason: [...new Set(lines.map((line) => line.reason))].join(" "),
      chargedAgain: false,
      payoutPaid: false,
      moneyMoved: false,
    };
  }
  if (index < 0) {
    return { ok: false, error: "This milestone is not on the signed allocation. Tax was not charged again.", storedAsZero: false };
  }
  const weights = weightsFromParts(grosses);
  if (!weights) {
    return { ok: false, error: "The milestone weights do not add up. Tax was not charged again.", storedAsZero: false };
  }
  const carried = carryOriginalTaxThroughPayouts({ lines, weightsBps: weights });
  if (!carried.ok) return carried;
  const payout = carried.payouts[index];
  if (!payout) {
    return { ok: false, error: "The original tax could not be carried. Nothing was stored as zero.", storedAsZero: false };
  }
  return {
    ok: true,
    taxCents: payout.taxCents,
    taxReason: [...new Set(payout.lines.map((line) => line.reason))].join(" "),
    chargedAgain: false,
    payoutPaid: false,
    moneyMoved: false,
  };
}

/** A signed collaboration cannot be charged while its tax determination is missing or failed. */
export function collaborationTaxBeforeCollection(plan: unknown): { ok: true; taxCents: number | null } | { ok: false; error: string; storedAsZero: false } {
  if (!plan || typeof plan !== "object") return { ok: true, taxCents: null };
  const quote = (plan as { signedQuote?: unknown }).signedQuote;
  if (!quote || typeof quote !== "object") return { ok: true, taxCents: null };
  const status = (quote as { taxStatus?: unknown }).taxStatus;
  if (status == null || status === "") return { ok: true, taxCents: null };
  if (status === "unresolved") {
    return { ok: false, error: "Tax is not determined for this collaboration. Nothing was charged.", storedAsZero: false };
  }
  const lines = (quote as { taxLines?: unknown }).taxLines;
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, error: "A valid zero needs its original reason. Nothing was charged.", storedAsZero: false };
  }
  let taxCents = 0;
  for (const row of lines) {
    if (!row || typeof row !== "object") {
      return { ok: false, error: "A tax record could not be read. Nothing was charged.", storedAsZero: false };
    }
    const amount = (row as { amountCents?: unknown }).amountCents;
    const reason = (row as { disposition?: unknown }).disposition;
    if (!Number.isInteger(amount) || Number(amount) < 0 || typeof reason !== "string" || !reason.trim()) {
      return { ok: false, error: "A tax record needs its original amount and reason. Nothing was stored as zero.", storedAsZero: false };
    }
    taxCents += Number(amount);
  }
  return { ok: true, taxCents };
}
