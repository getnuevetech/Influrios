import { QuoteDiscountBox } from "@/components/quote-discount-box";
import { readDiscountAdjustments } from "@/lib/discount-codes";
import type { SignedTermsSnapshot } from "@/lib/signed-funding";

function amount(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export function ContractDiscountReview({
  viewerRole,
  terms,
  signedCount,
  documentId,
}: {
  viewerRole: "business" | "influencer";
  terms: SignedTermsSnapshot;
  signedCount: number;
  documentId: string;
}) {
  const plan = terms.financialPlan;
  const quote = plan && typeof plan.signedQuote === "object" ? (plan.signedQuote as Record<string, unknown>) : null;
  const grossCents = amount(quote?.grossInfluencerCompensationCents);
  const businessFeeCents = amount(quote?.businessPlatformFeeCents);
  const influencerFeeCents = amount(quote?.influencerPlatformFeeCents);
  const businessTaxCents = amount(quote?.businessTaxCents);
  const influencerTaxCents = amount(quote?.influencerTaxCents);
  const businessPaysCents = amount(quote?.businessPaysCents);
  const influencerReceivesCents = amount(quote?.influencerReceivesCents);
  if (grossCents == null || businessFeeCents == null) return null;
  const adjustments = readDiscountAdjustments(plan);
  const business = adjustments.find((row) => row.charge === "business_collaboration_fee");
  const influencer = adjustments.find((row) => row.charge === "influencer_collaboration_fee");
  const readOnly = signedCount > 0;
  if (viewerRole === "business" && businessPaysCents != null) {
    return (
      <QuoteDiscountBox
        role="business"
        currency={terms.currency}
        grossCents={grossCents}
        feeCents={business?.originalCents ?? businessFeeCents}
        taxCents={businessTaxCents}
        totalCents={businessPaysCents}
        countryCode={terms.jurisdictionCode}
        serviceLevel={terms.feeServiceLevel || terms.serviceLevel}
        readOnly={readOnly}
        appliedCode={business?.code ?? ""}
        savingsCents={business?.discountCents ?? 0}
        documentId={documentId}
      />
    );
  }
  if (viewerRole === "influencer" && influencerFeeCents != null && influencerReceivesCents != null) {
    return (
      <QuoteDiscountBox
        role="influencer"
        currency={terms.currency}
        grossCents={grossCents}
        feeCents={influencer?.originalCents ?? influencerFeeCents}
        taxCents={influencerTaxCents}
        totalCents={influencerReceivesCents}
        countryCode={terms.jurisdictionCode}
        serviceLevel={terms.feeServiceLevel || terms.serviceLevel}
        readOnly={readOnly}
        appliedCode={influencer?.code ?? ""}
        savingsCents={influencer?.discountCents ?? 0}
        documentId={documentId}
      />
    );
  }
  return null;
}
