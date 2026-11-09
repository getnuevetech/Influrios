export type MemberDealLine = { label: string; amountCents: number };

export type MemberDealView = {
  role: "business" | "influencer";
  lines: MemberDealLine[];
  headlineCents: number;
  feeCents: number;
  grossCents: number;
  signed: boolean;
};

function integer(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function signedQuote(plan: unknown) {
  if (!plan || typeof plan !== "object") return null;
  const root = plan as { financialPlan?: unknown; signedQuote?: unknown };
  const source = root.signedQuote && typeof root.signedQuote === "object" ? root.signedQuote : root.financialPlan;
  if (!source || typeof source !== "object") return null;
  const quote = "signedQuote" in source ? (source as { signedQuote?: unknown }).signedQuote : source;
  if (!quote || typeof quote !== "object" || !("businessPaysCents" in quote)) return null;
  const row = quote as Record<string, unknown>;
  const businessPaysCents = integer(row.businessPaysCents);
  const influencerReceivesCents = integer(row.influencerReceivesCents);
  const businessPlatformFeeCents = integer(row.businessPlatformFeeCents);
  const influencerPlatformFeeCents = integer(row.influencerPlatformFeeCents);
  const grossInfluencerCompensationCents = integer(row.grossInfluencerCompensationCents);
  if (
    businessPaysCents == null ||
    influencerReceivesCents == null ||
    businessPlatformFeeCents == null ||
    influencerPlatformFeeCents == null ||
    grossInfluencerCompensationCents == null
  ) {
    return null;
  }
  const influencerTaxCents = integer(row.influencerTaxCents) ?? 0;
  const withholdingCents = integer(row.withholdingCents) ?? 0;
  return {
    businessPaysCents,
    influencerReceivesCents,
    businessPlatformFeeCents,
    influencerPlatformFeeCents,
    grossInfluencerCompensationCents,
    otherDeductionsCents: influencerTaxCents + withholdingCents,
  };
}

/** What one party sees. The other party's fee is left out. */
export function memberDealView(input: {
  role: "business" | "influencer";
  grossCents: number;
  feeCents: number;
  plan?: unknown;
}): MemberDealView {
  const quote = signedQuote(input.plan);
  if (quote && input.role === "business") {
    return {
      role: "business",
      headlineCents: quote.businessPaysCents,
      feeCents: quote.businessPlatformFeeCents,
      grossCents: quote.businessPaysCents,
      lines: [
        { label: "Funding total", amountCents: quote.businessPaysCents },
        { label: "Your platform fee", amountCents: quote.businessPlatformFeeCents },
      ],
      signed: true,
    };
  }
  if (quote) {
    const lines: MemberDealLine[] = [
      { label: "Gross influencer compensation", amountCents: quote.grossInfluencerCompensationCents },
      { label: "Your platform fee", amountCents: quote.influencerPlatformFeeCents },
    ];
    if (quote.otherDeductionsCents > 0) {
      lines.push({ label: "Other deductions", amountCents: quote.otherDeductionsCents });
    }
    lines.push({ label: "Net payout", amountCents: quote.influencerReceivesCents });
    return {
      role: "influencer",
      headlineCents: quote.influencerReceivesCents,
      feeCents: quote.influencerPlatformFeeCents,
      grossCents: quote.grossInfluencerCompensationCents,
      lines,
      signed: true,
    };
  }
  const gross = Number.isInteger(input.grossCents) && input.grossCents > 0 ? input.grossCents : 0;
  const fee = Number.isInteger(input.feeCents) && input.feeCents > 0 ? input.feeCents : 0;
  if (input.role === "business") {
    return {
      role: "business",
      headlineCents: gross,
      feeCents: fee,
      grossCents: gross,
      lines: [
        { label: "Funding total", amountCents: gross },
        { label: "Platform fee", amountCents: fee },
      ],
      signed: false,
    };
  }
  const net = Math.max(0, gross - fee);
  return {
    role: "influencer",
    headlineCents: net,
    feeCents: fee,
    grossCents: gross,
    lines: [
      { label: "Gross compensation", amountCents: gross },
      { label: "Platform fee", amountCents: fee },
      { label: "Net payout", amountCents: net },
    ],
    signed: false,
  };
}
