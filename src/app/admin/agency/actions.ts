"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import {
  addRosterMember,
  createAgencyCampaign,
  createAgencyWorkspace,
  createJointPortfolio,
  removeRosterMember,
  setAgencySeatActive,
  setCampaignStatus,
  setPortfolioPublished,
  type AgencyCampaign,
} from "@/lib/agency";
import { setProductSwitch } from "@/lib/product-switches";

function workspaceOf(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  if (!workspaceId) throw new Error("Choose an agency workspace.");
  return workspaceId;
}

function agencyRedirect(workspaceId: string, query: string) {
  return `/admin/agency?workspaceId=${encodeURIComponent(workspaceId)}&${query}`;
}

export async function actionSaveAgencySeats(formData: FormData) {
  await requireAdminAction("agency.manage");
  const workspaceId = workspaceOf(formData);
  await setProductSwitch("agency_seats", formData.get("agency_seats") === "on");
  revalidatePath("/admin/agency");
  redirect(agencyRedirect(workspaceId, "seats=1"));
}

export async function actionCreateAgencyWorkspace(formData: FormData) {
  await requireAdminAction("agency.manage");
  try {
    const created = await createAgencyWorkspace({
      id: String(formData.get("id") ?? ""),
      name: String(formData.get("name") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
    revalidatePath("/admin/agency");
    redirect(agencyRedirect(created.id, "workspace=1"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "workspace_failed";
    redirect(`/admin/agency?error=${encodeURIComponent(msg)}`);
  }
}

export async function actionAdminAddSeat(formData: FormData) {
  await requireAdminAction("agency.manage");
  const workspaceId = workspaceOf(formData);
  try {
    const { inviteAgencySeat } = await import("@/lib/agency-seats");
    const invited = await inviteAgencySeat({
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? "member"),
      workspaceId,
    });
    revalidatePath("/admin/agency");
    redirect(
      agencyRedirect(workspaceId, `seat=1&invite=${encodeURIComponent(invited.invitePath)}`),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "seat_failed";
    redirect(agencyRedirect(workspaceId, `error=${encodeURIComponent(msg)}`));
  }
}

export async function actionAdminSetSeat(formData: FormData) {
  await requireAdminAction("agency.manage");
  const workspaceId = workspaceOf(formData);
  try {
    await setAgencySeatActive(String(formData.get("email") ?? ""), formData.get("active") === "1", workspaceId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "seat_failed";
    redirect(agencyRedirect(workspaceId, `error=${encodeURIComponent(msg)}`));
  }
  revalidatePath("/admin/agency");
  redirect(agencyRedirect(workspaceId, "seat=1"));
}

export async function actionAdminAddRoster(formData: FormData) {
  await requireAdminAction("agency.manage");
  const workspaceId = workspaceOf(formData);
  try {
    await addRosterMember({
      creatorSlug: String(formData.get("creatorSlug") ?? ""),
      role: (String(formData.get("role") ?? "talent") as "talent" | "lead" | "specialist") || "talent",
      retainerLabel: String(formData.get("retainerLabel") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      workspaceId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "add_failed";
    redirect(agencyRedirect(workspaceId, `error=${encodeURIComponent(msg)}`));
  }
  revalidatePath("/admin/agency");
  revalidatePath("/agency");
  redirect(agencyRedirect(workspaceId, "roster=1"));
}

export async function actionAdminRemoveRoster(formData: FormData) {
  await requireAdminAction("agency.manage");
  const workspaceId = workspaceOf(formData);
  await removeRosterMember(String(formData.get("creatorSlug") ?? ""), workspaceId);
  revalidatePath("/admin/agency");
  revalidatePath("/agency");
  redirect(agencyRedirect(workspaceId, "removed=1"));
}

export async function actionAdminCreateCampaign(formData: FormData) {
  await requireAdminAction("agency.manage");
  const workspaceId = workspaceOf(formData);
  const creatorSlugs = String(formData.get("creatorSlugs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    await createAgencyCampaign({
      title: String(formData.get("title") ?? ""),
      clientName: String(formData.get("clientName") ?? ""),
      specialty: String(formData.get("specialty") ?? "beauty"),
      budgetLabel: String(formData.get("budgetLabel") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      creatorSlugs,
      workspaceId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "campaign_failed";
    redirect(agencyRedirect(workspaceId, `error=${encodeURIComponent(msg)}`));
  }
  revalidatePath("/admin/agency");
  revalidatePath("/agency");
  redirect(agencyRedirect(workspaceId, "campaign=1"));
}

export async function actionAdminSetCampaignStatus(formData: FormData) {
  await requireAdminAction("agency.manage");
  const workspaceId = workspaceOf(formData);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as AgencyCampaign["status"];
  try {
    await setCampaignStatus(id, status, workspaceId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "status_failed";
    redirect(agencyRedirect(workspaceId, `error=${encodeURIComponent(msg)}`));
  }
  revalidatePath("/admin/agency");
  revalidatePath("/agency");
  redirect(agencyRedirect(workspaceId, `status=${id}`));
}

export async function actionAdminCreatePortfolio(formData: FormData) {
  await requireAdminAction("agency.manage");
  const workspaceId = workspaceOf(formData);
  const metrics = String(formData.get("metrics") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, value] = line.split("|").map((s) => s.trim());
      return { label: label || "Metric", value: value || "—" };
    });
  try {
    await createJointPortfolio({
      title: String(formData.get("title") ?? ""),
      tagline: String(formData.get("tagline") ?? ""),
      leftSlug: String(formData.get("leftSlug") ?? ""),
      rightSlug: String(formData.get("rightSlug") ?? ""),
      specialty: String(formData.get("specialty") ?? "beauty"),
      outcome: String(formData.get("outcome") ?? ""),
      metrics,
      campaignId: String(formData.get("campaignId") ?? "") || undefined,
      published: true,
      workspaceId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "portfolio_failed";
    redirect(agencyRedirect(workspaceId, `error=${encodeURIComponent(msg)}`));
  }
  revalidatePath("/admin/agency");
  revalidatePath("/agency");
  revalidatePath("/collaboration");
  redirect(agencyRedirect(workspaceId, "portfolio=1"));
}

export async function actionAdminTogglePortfolio(formData: FormData) {
  await requireAdminAction("agency.manage");
  const workspaceId = workspaceOf(formData);
  const id = String(formData.get("id") ?? "");
  const published = formData.get("published") === "1";
  try {
    await setPortfolioPublished(id, published, workspaceId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "toggle_failed";
    redirect(agencyRedirect(workspaceId, `error=${encodeURIComponent(msg)}`));
  }
  revalidatePath("/admin/agency");
  revalidatePath("/agency");
  revalidatePath("/collaboration");
  redirect(agencyRedirect(workspaceId, `toggled=${id}`));
}
