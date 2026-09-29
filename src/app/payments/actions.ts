"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createEscrowDeal,
  fundDeal,
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

export async function actionCreateDeal(formData: FormData) {
  const businessName = String(formData.get("businessName") ?? "").trim();
  const creatorSlug = String(formData.get("creatorSlug") ?? "").trim();
  const briefTitle = String(formData.get("briefTitle") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const creator = getCreatorBySlug(creatorSlug);
  const milestones = parseMilestones(formData);

  if (!businessName || !creatorSlug || !briefTitle || milestones.length === 0) {
    redirect("/payments?error=missing_fields");
  }

  let dealId = "";
  try {
    const deal = await createEscrowDeal({
      businessName,
      creatorSlug,
      creatorName: creator?.displayName ?? creatorSlug,
      briefTitle,
      notes,
      milestones,
    });
    dealId = deal.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    redirect(`/payments?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/payments");
  revalidatePath("/admin/payments");
  redirect(`/payments?created=${dealId}`);
}

export async function actionFundDeal(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  try {
    await fundDeal(dealId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fund_failed";
    redirect(`/payments?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/payments");
  revalidatePath("/admin/payments");
  redirect(`/payments?funded=${dealId}`);
}

export async function actionSubmitMilestone(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const note = String(formData.get("note") ?? "") || undefined;
  try {
    await submitMilestone(dealId, milestoneId, note);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "submit_failed";
    redirect(`/payments?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/payments");
  revalidatePath("/admin/payments");
  redirect(`/payments?submitted=${milestoneId}`);
}

export async function actionReleaseMilestone(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const note = String(formData.get("note") ?? "") || undefined;
  try {
    await releaseMilestone(dealId, milestoneId, note);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "release_failed";
    redirect(`/payments?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/payments");
  revalidatePath("/admin/payments");
  redirect(`/payments?released=${milestoneId}`);
}
