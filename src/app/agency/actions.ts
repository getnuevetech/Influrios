"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addRosterMember,
  agencyWorkspaceIdForOwner,
  createAgencyCampaign,
  createJointPortfolio,
  setCampaignStatus,
  setPortfolioPublished,
  type AgencyCampaign,
} from "@/lib/agency";
import { resolveAgencyAccess } from "@/lib/agency-auth";

async function requireWorkspaceId() {
  const access = await resolveAgencyAccess();
  if (!access.ok) {
    redirect(`/agency?error=${encodeURIComponent(access.error)}`);
  }
  const workspaceId =
    access.mode === "seat"
      ? access.seat.workspaceId
      : access.account?.id
        ? agencyWorkspaceIdForOwner(access.account.id)
        : null;
  if (!workspaceId) redirect("/agency?error=Sign in to use your agency workspace.");
  return workspaceId;
}

export async function actionAddRoster(formData: FormData) {
  const workspaceId = await requireWorkspaceId();
  const creatorSlug = String(formData.get("creatorSlug") ?? "");
  try {
    await addRosterMember({
      workspaceId,
      creatorSlug,
      role: (String(formData.get("role") ?? "talent") as "talent" | "lead" | "specialist") || "talent",
      retainerLabel: String(formData.get("retainerLabel") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "add_failed";
    redirect(`/agency?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/agency");
  revalidatePath("/admin/agency");
  redirect(`/agency?roster=${creatorSlug}`);
}

export async function actionCreateCampaign(formData: FormData) {
  const workspaceId = await requireWorkspaceId();
  const creatorSlugs = String(formData.get("creatorSlugs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    await createAgencyCampaign({
      workspaceId,
      title: String(formData.get("title") ?? ""),
      clientName: String(formData.get("clientName") ?? ""),
      specialty: String(formData.get("specialty") ?? "beauty"),
      budgetLabel: String(formData.get("budgetLabel") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      creatorSlugs,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "campaign_failed";
    redirect(`/agency?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/agency");
  revalidatePath("/admin/agency");
  redirect("/agency?campaign=1");
}

export async function actionSetCampaignStatus(formData: FormData) {
  const workspaceId = await requireWorkspaceId();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as AgencyCampaign["status"];
  try {
    await setCampaignStatus(id, status, workspaceId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "status_failed";
    redirect(`/agency?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/agency");
  revalidatePath("/admin/agency");
  redirect(`/agency?status=${id}`);
}

export async function actionCreatePortfolio(formData: FormData) {
  const workspaceId = await requireWorkspaceId();
  const metricsRaw = String(formData.get("metrics") ?? "");
  const metrics = metricsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, value] = line.split("|").map((s) => s.trim());
      return { label: label || "Metric", value: value || "—" };
    });
  try {
    await createJointPortfolio({
      workspaceId,
      title: String(formData.get("title") ?? ""),
      tagline: String(formData.get("tagline") ?? ""),
      leftSlug: String(formData.get("leftSlug") ?? ""),
      rightSlug: String(formData.get("rightSlug") ?? ""),
      specialty: String(formData.get("specialty") ?? "beauty"),
      outcome: String(formData.get("outcome") ?? ""),
      metrics,
      campaignId: String(formData.get("campaignId") ?? "") || undefined,
      published: formData.get("published") === "on",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "portfolio_failed";
    redirect(`/agency?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/agency");
  revalidatePath("/collaboration");
  revalidatePath("/admin/agency");
  redirect("/agency?portfolio=1");
}

export async function actionTogglePortfolio(formData: FormData) {
  const workspaceId = await requireWorkspaceId();
  const id = String(formData.get("id") ?? "");
  const published = formData.get("published") === "1";
  try {
    await setPortfolioPublished(id, published, workspaceId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "toggle_failed";
    redirect(`/agency?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/agency");
  revalidatePath("/collaboration");
  revalidatePath("/admin/agency");
  redirect(`/agency?toggled=${id}`);
}

