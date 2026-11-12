"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession, hasPermission, isSuperAdmin } from "@/lib/admin-auth";
import { parseScheduleCorrection } from "@/lib/signed-funding";
import { applyMarketplaceEvent } from "@/lib/marketplace-ledger";
import { recordProviderBalanceComparison } from "@/lib/provider-balance";
import { approveContractAmendment, voidContractDocument } from "@/lib/signed-funding-apply";

function dollarsToCents(raw: string) {
  const amount = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

async function operator() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function actionVoidDealContract(formData: FormData) {
  const session = await operator();
  const id = String(formData.get("id") ?? "").trim();
  if (!isSuperAdmin(session)) {
    redirect(`/admin/deals/${id}?error=` + encodeURIComponent("Only a super admin can void an agreement."));
  }
  const result = await voidContractDocument({
    id,
    actor: session.email,
    reason: String(formData.get("reason") ?? ""),
  });
  if (!result.ok) redirect(`/admin/deals/${id}?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/admin/contracts");
  revalidatePath(`/admin/deals/${id}`);
  redirect(`/admin/deals/${id}?voided=1`);
}

export async function actionRecordFeeSettlement(formData: FormData) {
  const session = await operator();
  const id = String(formData.get("id") ?? "").trim();
  const fundingId = String(formData.get("fundingId") ?? "").trim();
  if (!hasPermission(session, "marketplace.manage")) {
    redirect(`/admin/deals/${id}?error=` + encodeURIComponent("Finance records a fee settlement."));
  }
  const amountCents = Number(String(formData.get("amountCents") ?? "").trim());
  const providerReference = String(formData.get("providerReference") ?? "").trim();
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    redirect(`/admin/deals/${id}?error=` + encodeURIComponent("Enter the settlement in whole minor units."));
  }
  const { paymentChargeBlock } = await import("@/lib/payment-charge-switches");
  const charge = await paymentChargeBlock("fee_settlement");
  if (!charge.ok) redirect(`/admin/deals/${id}?error=${encodeURIComponent(charge.error)}`);
  const result = await applyMarketplaceEvent({
    provider: "finance",
    eventId: providerReference,
    eventType: "fee.settled",
    fundingId,
    amountCents,
  });
  if (!result.applied) {
    const message = result.result === "duplicate" ? "That settlement reference is already recorded." : "The settlement was not recorded.";
    redirect(`/admin/deals/${id}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/admin/deals/${id}`);
  revalidatePath(`/admin/marketplace/${fundingId}`);
  redirect(`/admin/deals/${id}?settled=1`);
}

export async function actionCompareProviderBalance(formData: FormData) {
  const session = await operator();
  const id = String(formData.get("id") ?? "").trim();
  const fundingId = String(formData.get("fundingId") ?? "").trim();
  if (!hasPermission(session, "marketplace.manage")) {
    redirect(`/admin/deals/${id}?error=` + encodeURIComponent("Finance compares provider balances."));
  }
  const providerHeldCents = Number(String(formData.get("providerHeldCents") ?? "").trim());
  const providerReleasedCents = Number(String(formData.get("providerReleasedCents") ?? "").trim());
  const providerRefundedCents = Number(String(formData.get("providerRefundedCents") ?? "").trim());
  const result = await recordProviderBalanceComparison({
    fundingId,
    actor: session.email,
    providerHeldCents,
    providerReleasedCents,
    providerRefundedCents,
  });
  if (!result.ok) redirect(`/admin/deals/${id}?error=${encodeURIComponent(result.error)}`);
  const message = result.matched
    ? "Provider balances match the ledger. Nothing was moved."
    : `Held difference ${result.heldDifferenceCents} minor units. Released difference ${result.releasedDifferenceCents} minor units. Refunded difference ${result.refundedDifferenceCents} minor units. Nothing was moved.`;
  revalidatePath(`/admin/deals/${id}`);
  redirect(`/admin/deals/${id}?compared=${encodeURIComponent(message)}`);
}

export async function actionApproveDealAmendment(formData: FormData) {
  const session = await operator();
  const id = String(formData.get("id") ?? "").trim();
  if (!isSuperAdmin(session) && !hasPermission(session, "contracts.manage")) {
    redirect(`/admin/deals/${id}?error=` + encodeURIComponent("A contract manager or super admin approves a change order."));
  }
  const parsed = parseScheduleCorrection({
    slugs: formData.getAll("creatorSlug").map(String),
    creatorPercents: formData.getAll("creatorPercent").map(String),
    titles: formData.getAll("milestoneTitle").map(String),
    milestonePercents: formData.getAll("milestonePercent").map(String),
  });
  if (!parsed.ok) redirect(`/admin/deals/${id}?error=${encodeURIComponent(parsed.error)}`);
  const result = await approveContractAmendment({
    documentId: id,
    actor: session.email,
    note: String(formData.get("note") ?? ""),
    grossCents: dollarsToCents(String(formData.get("gross") ?? "")),
    currency: String(formData.get("currency") ?? ""),
    creators: parsed.creators,
    milestones: parsed.milestones,
  });
  if (!result.ok) redirect(`/admin/deals/${id}?error=${encodeURIComponent(result.error)}`);
  revalidatePath(`/admin/deals/${id}`);
  redirect(`/admin/deals/${id}?amended=1`);
}
