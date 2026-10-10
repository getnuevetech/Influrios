"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDirectoryCreator } from "@/lib/directory";
import { openFundingCollection } from "@/lib/provider-collection";
import { resolvePaymentGatewayForCountry } from "@/lib/providers";
import { prisma } from "@/lib/db";
import {
  approveFundingMilestone,
  requestChangeOrder,
  requestFundingRevision,
  requestPrefund,
  stopRecurringSeries,
  submitFundingMilestone,
} from "@/lib/marketplace-ledger";
import { paymentDealDraft } from "@/lib/matching-product-boundary";
import { addDisputeEvidence, cancelUnconfirmedFunding, openMilestoneDispute } from "@/lib/milestone-disputes";

function dollarsToCents(raw: string) {
  const amount = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

export async function actionCreateDeal(formData: FormData) {
  const draft = paymentDealDraft({
    businessName: String(formData.get("businessName") ?? ""),
    creatorSlug: String(formData.get("creatorSlug") ?? ""),
    title: String(formData.get("briefTitle") ?? ""),
    jurisdictionCode: String(formData.get("jurisdictionCode") ?? ""),
    grossUsd: String(formData.get("grossUsd") ?? ""),
    serviceLevel: String(formData.get("serviceLevel") ?? ""),
  });
  if (!draft.ok) redirect(`/payments?error=${encodeURIComponent(draft.error)}`);
  const creator = await getDirectoryCreator(draft.creatorSlug);
  if (!creator) redirect("/payments?error=That%20influencer%20was%20not%20found%20in%20the%20directory.");
  const result = await requestPrefund({
    businessName: draft.businessName,
    creatorSlug: draft.creatorSlug,
    title: draft.title,
    jurisdictionCode: draft.jurisdictionCode,
    grossCents: draft.grossCents,
    serviceLevel: draft.serviceLevel,
    sourceId: String(formData.get("sourceId") ?? ""),
    repeatOfId: String(formData.get("repeatOfId") ?? ""),
    scheduleKind: String(formData.get("scheduleKind") ?? "once"),
    stageCount: Number(formData.get("scheduleCount") ?? 0),
    occurrenceCount: Number(formData.get("scheduleCount") ?? 0),
  });
  if (!result.ok) redirect(`/payments?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/payments");
  revalidatePath("/admin/marketplace");
  redirect(`/payments?created=${result.id}`);
}

export async function actionOpenFundingCheckout(formData: FormData) {
  const fundingId = String(formData.get("dealId") ?? "").trim();
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: fundingId },
    include: { milestones: true },
  });
  if (!funding || funding.status !== "awaiting_provider") {
    redirect("/payments?error=This%20funding%20is%20not%20waiting%20for%20a%20provider.");
  }
  const route = await resolvePaymentGatewayForCountry(funding.jurisdictionCode);
  const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const opened = await openFundingCollection({
    providerCode: route.providerCode ?? "",
    fundingId: funding.id,
    amountCents: funding.grossCents,
    currency: funding.currency,
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    milestones: funding.milestones.map((milestone) => ({ id: milestone.id, amountCents: milestone.amountCents })),
    origin,
  });
  if (!opened.ok) redirect(`/payments?error=${encodeURIComponent(opened.error)}`);
  if (opened.url) redirect(opened.url);
  revalidatePath("/payments");
  redirect(`/payments?checkout=${encodeURIComponent(opened.reference)}`);
}

export async function actionRequestChangeOrder(formData: FormData) {
  const fundingId = String(formData.get("dealId") ?? "");
  const grossCents = dollarsToCents(String(formData.get("grossUsd") ?? ""));
  const result = await requestChangeOrder({
    fundingId,
    grossCents,
    note: String(formData.get("note") ?? ""),
  });
  if (!result.ok) redirect(`/payments?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/admin/marketplace");
  redirect("/payments?changed=1");
}

export async function actionSubmitMilestone(formData: FormData) {
  const fundingId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const result = await submitFundingMilestone(fundingId, milestoneId);
  if (!result.ok) redirect(`/payments?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  redirect("/payments?submitted=1");
}

export async function actionRequestRevision(formData: FormData) {
  const fundingId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const result = await requestFundingRevision(fundingId, milestoneId, String(formData.get("note") ?? ""));
  if (!result.ok) redirect(`/payments?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  redirect("/payments?revised=1");
}

export async function actionApproveMilestone(formData: FormData) {
  const fundingId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const result = await approveFundingMilestone(fundingId, milestoneId);
  if (!result.ok) redirect(`/payments?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/payments");
  redirect("/payments?approved=1");
}

export async function actionCancelPrefund(formData: FormData) {
  const fundingId = String(formData.get("dealId") ?? "");
  const result = await cancelUnconfirmedFunding(fundingId);
  if (!result.ok) redirect(`/payments?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/payments");
  redirect("/payments?cancelled=1");
}

export async function actionAddEvidence(formData: FormData) {
  const result = await addDisputeEvidence({
    disputeId: String(formData.get("disputeId") ?? ""),
    fundingId: String(formData.get("dealId") ?? ""),
    author: "business",
    body: String(formData.get("body") ?? ""),
    url: String(formData.get("url") ?? ""),
  });
  if (!result.ok) redirect(`/payments?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/admin/trust");
  redirect("/payments?evidence=1");
}

export async function actionStopSeries(formData: FormData) {
  const result = await stopRecurringSeries(String(formData.get("scheduleId") ?? ""));
  if (!result.ok) redirect(`/payments?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/payments");
  redirect("/payments?stopped=1");
}

export async function actionConvertAmbassador(formData: FormData) {
  const draft = paymentDealDraft({
    businessName: String(formData.get("businessName") ?? ""),
    creatorSlug: String(formData.get("creatorSlug") ?? ""),
    title: String(formData.get("title") ?? ""),
    jurisdictionCode: String(formData.get("jurisdictionCode") ?? ""),
    grossUsd: String(formData.get("grossUsd") ?? ""),
    serviceLevel: String(formData.get("serviceLevel") ?? ""),
  });
  if (!draft.ok) redirect(`/payments?error=${encodeURIComponent(draft.error)}`);
  const result = await requestPrefund({
    businessName: draft.businessName,
    creatorSlug: draft.creatorSlug,
    title: draft.title,
    jurisdictionCode: draft.jurisdictionCode,
    grossCents: draft.grossCents,
    serviceLevel: draft.serviceLevel,
    scheduleKind: "recurring",
    occurrenceCount: Number(formData.get("occurrenceCount") ?? 2),
    repeatOfId: String(formData.get("fundingId") ?? ""),
    workspaceId: String(formData.get("workspaceId") ?? "") || null,
  });
  if (!result.ok) redirect(`/payments?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/payments");
  redirect("/payments?ambassador=1");
}

export async function actionOpenDispute(formData: FormData) {
  const result = await openMilestoneDispute({
    fundingId: String(formData.get("dealId") ?? ""),
    milestoneId: String(formData.get("milestoneId") ?? ""),
    openedBy: "business",
    reasonId: String(formData.get("reasonId") ?? ""),
    details: String(formData.get("details") ?? ""),
  });
  if (!result.ok) redirect(`/payments?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/payments");
  revalidatePath("/admin/trust");
  revalidatePath("/trust");
  redirect("/payments?disputed=1");
}
