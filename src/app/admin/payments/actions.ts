"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import {
  createEscrowDeal,
  fundDeal,
  refundDeal,
  releaseMilestone,
  submitMilestone,
} from "@/lib/protected-payments";
import { getCreatorBySlug } from "@/lib/seed-data";

function dollarsToCents(raw: string) {
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function parseMilestones(formData: FormData) {
  const titles = formData.getAll("msTitle").map((v) => String(v).trim());
  const amounts = formData.getAll("msAmount").map((v) => dollarsToCents(String(v)));
  const dues = formData.getAll("msDue").map((v) => String(v).trim() || "TBD");
  return titles
    .map((title, i) => ({
      title: title || `Milestone ${i + 1}`,
      amountCents: amounts[i] ?? 0,
      dueLabel: dues[i] ?? "TBD",
    }))
    .filter((m) => m.amountCents > 0);
}

export async function actionAdminCreateDeal(formData: FormData) {
  await requireAdminAction("payments.manage");
  const businessName = String(formData.get("businessName") ?? "").trim();
  const creatorSlug = String(formData.get("creatorSlug") ?? "").trim();
  const briefTitle = String(formData.get("briefTitle") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const introId = String(formData.get("introId") ?? "").trim() || undefined;
  const creator = getCreatorBySlug(creatorSlug);
  const milestones = parseMilestones(formData);

  if (!businessName || !creatorSlug || !briefTitle || milestones.length === 0) {
    redirect("/admin/payments?error=missing_fields");
  }

  try {
    await createEscrowDeal({
      businessName,
      creatorSlug,
      creatorName: creator?.displayName ?? creatorSlug,
      briefTitle,
      notes,
      introId,
      milestones,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    redirect(`/admin/payments?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/admin/payments");
  revalidatePath("/payments");
  redirect("/admin/payments?created=1");
}

export async function actionAdminFundDeal(formData: FormData) {
  await requireAdminAction("payments.manage");
  const dealId = String(formData.get("dealId") ?? "");
  try {
    await fundDeal(dealId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fund_failed";
    redirect(`/admin/payments?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/payments");
  revalidatePath("/payments");
  redirect(`/admin/payments?funded=${dealId}`);
}

export async function actionAdminSubmitMilestone(formData: FormData) {
  await requireAdminAction("payments.manage");
  const dealId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const note = String(formData.get("note") ?? "") || undefined;
  try {
    await submitMilestone(dealId, milestoneId, note);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "submit_failed";
    redirect(`/admin/payments?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/payments");
  revalidatePath("/payments");
  redirect(`/admin/payments?submitted=${milestoneId}`);
}

export async function actionAdminReleaseMilestone(formData: FormData) {
  await requireAdminAction("payments.manage");
  const dealId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const note = String(formData.get("note") ?? "") || undefined;
  try {
    await releaseMilestone(dealId, milestoneId, note);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "release_failed";
    redirect(`/admin/payments?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/payments");
  revalidatePath("/payments");
  redirect(`/admin/payments?released=${milestoneId}`);
}

export async function actionAdminRefundDeal(formData: FormData) {
  await requireAdminAction("payments.manage");
  const dealId = String(formData.get("dealId") ?? "");
  const note = String(formData.get("note") ?? "") || undefined;
  try {
    await refundDeal(dealId, note);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "refund_failed";
    redirect(`/admin/payments?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/payments");
  revalidatePath("/payments");
  redirect(`/admin/payments?refunded=${dealId}`);
}
