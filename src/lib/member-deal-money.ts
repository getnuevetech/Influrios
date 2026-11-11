export type MemberDealLine = { label: string; amountCents: number };

export type MemberDealView = {
  role: "business" | "influencer";
  lines: MemberDealLine[];
  headlineCents: number;
  feeCents: number;
  grossCents: number;
  signed: boolean;
  feeReady: boolean;
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
  const businessPlatformFeeCents = integer(row.businessPlatformFeeCents);
  const grossInfluencerCompensationCents = integer(row.grossInfluencerCompensationCents);
  const influencerReceivesCents = integer(row.influencerReceivesCents);
  const influencerPlatformFeeCents = integer(row.influencerPlatformFeeCents);
  if (businessPaysCents == null || businessPlatformFeeCents == null || grossInfluencerCompensationCents == null) {
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

/**
 * A ledger row is visible to one party. The business deposit and the business fee stay with the
 * business. The influencer payable, influencer fee, and influencer payout stay with the influencer.
 * A payout release is the disbursement both sides can see. A combined hold with no party is the
 * business collection.
 */
export function ledgerEntryVisibleTo(input: {
  role: "business" | "influencer";
  kind: string;
  party?: string | null;
}): boolean {
  const party = (input.party ?? "").trim();
  const [owner, side] = party.split(":");
  const kind = input.kind;
  const businessFee =
    kind === "fee" || kind === "fee_pending" || kind === "fee_earned" || kind === "fee_settled";
  if (input.role === "business") {
    if (kind === "release" || kind === "return") return true;
    if (owner === "influencer" || owner === "Influencer" || side === "influencer") return false;
    if (kind === "influencer_payable" || kind === "share" || kind === "tax" || kind === "provider_fee") return false;
    if (kind === "hold" || kind === "collection" || kind === "refund") return owner === "" || owner === "business";
    if (businessFee) return side === "business" || owner === "Platform" || owner === "platform" || owner === "";
    return false;
  }
  if (owner === "business" || side === "business") return false;
  if (kind === "hold" || kind === "collection" || kind === "refund") return false;
  if (kind === "influencer_payable") return true;
  if (kind === "release" || kind === "return") return owner === "" || owner === "Influencer" || owner === "influencer";
  if (businessFee) return side === "influencer";
  return false;
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
        { label: "Gross compensation", amountCents: quote.grossInfluencerCompensationCents },
        { label: "Your platform fee", amountCents: quote.businessPlatformFeeCents },
        { label: "You pay", amountCents: quote.businessPaysCents },
      ],
      signed: true,
      feeReady: true,
    };
  }
  if (quote && quote.influencerPlatformFeeCents != null && quote.influencerReceivesCents != null) {
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
      feeReady: true,
    };
  }
  if (quote && input.role === "influencer") {
    return {
      role: "influencer",
      headlineCents: 0,
      feeCents: 0,
      grossCents: quote.grossInfluencerCompensationCents,
      lines: [],
      signed: false,
      feeReady: false,
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
      feeReady: true,
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
    feeReady: true,
  };
}

/**
 * Influencer earnings. A signed hold is the business collection, which includes both platform fees.
 * The influencer's held and released figures stay inside their signed net payout.
 */
export function influencerLedgerShare(input: {
  grossCents: number;
  feeCents: number;
  plan?: unknown;
  ledger: { heldCents: number; releasedCents: number };
}): { heldCents: number; releasedCents: number } {
  const view = memberDealView({
    role: "influencer",
    grossCents: input.grossCents,
    feeCents: input.feeCents,
    plan: input.plan,
  });
  if (!view.signed || !view.feeReady) {
    return {
      heldCents: Math.max(0, input.ledger.heldCents),
      releasedCents: Math.max(0, input.ledger.releasedCents),
    };
  }
  const payable = view.headlineCents;
  const released = Math.min(Math.max(input.ledger.releasedCents, 0), payable);
  const owed = Math.max(0, payable - released);
  const held = input.ledger.heldCents <= 0 ? 0 : Math.min(owed, input.ledger.heldCents);
  return { heldCents: held, releasedCents: released };
}
