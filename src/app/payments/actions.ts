"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCreatorBySlug } from "@/lib/seed-data";
import {
  approveFundingMilestone,
  requestChangeOrder,
  requestFundingRevision,
  requestPrefund,
  submitFundingMilestone,
} from "@/lib/marketplace-ledger";
import { addDisputeEvidence, cancelUnconfirmedFunding, openMilestoneDispute } from "@/lib/milestone-disputes";

function dollarsToCents(raw: string) {
  const amount = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

export async function actionCreateDeal(formData: FormData) {
  const businessName = String(formData.get("businessName") ?? "").trim();
  const creatorSlug = String(formData.get("creatorSlug") ?? "").trim();
  const briefTitle = String(formData.get("briefTitle") ?? "").trim();
  const jurisdictionCode = String(formData.get("jurisdictionCode") ?? "US");
  const grossCents = dollarsToCents(String(formData.get("grossUsd") ?? ""));
  const creator = getCreatorBySlug(creatorSlug);
  if (!businessName || !creatorSlug || !briefTitle || !creator || grossCents <= 0) {
    redirect("/payments?error=Add a business, creator, title, and gross amount.");
  }
  const result = await requestPrefund({
    businessName,
    creatorSlug,
    title: briefTitle,
    jurisdictionCode,
    grossCents,
    serviceLevel: "contracted",
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
