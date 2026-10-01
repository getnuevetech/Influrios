"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import {
  addAgencySeat,
  addRosterMember,
  createAgencyCampaign,
  createJointPortfolio,
  removeRosterMember,
  setAgencySeatActive,
  setCampaignStatus,
  setPortfolioPublished,
  type AgencyCampaign,
} from "@/lib/agency";
import { setProductSwitch } from "@/lib/product-switches";

export async function actionSaveAgencySeats(formData: FormData) {
  await requireAdminAction("agency.manage");
  await setProductSwitch("agency_seats", formData.get("agency_seats") === "on");
  revalidatePath("/admin/agency");
  redirect("/admin/agency?seats=1");
}

export async function actionAdminAddSeat(formData: FormData) {
  await requireAdminAction("agency.manage");
  try {
    await addAgencySeat({
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? "member"),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "seat_failed";
    redirect(`/admin/agency?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/agency");
  redirect("/admin/agency?seat=1");
}

export async function actionAdminSetSeat(formData: FormData) {
  await requireAdminAction("agency.manage");
  try {
    await setAgencySeatActive(String(formData.get("email") ?? ""), formData.get("active") === "1");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "seat_failed";
    redirect(`/admin/agency?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/agency");
  redirect("/admin/agency?seat=1");
}

export async function actionAdminAddRoster(formData: FormData) {
  await requireAdminAction("agency.manage");
  try {
    await addRosterMember({
      creatorSlug: String(formData.get("creatorSlug") ?? ""),
      role: (String(formData.get("role") ?? "talent") as "talent" | "lead" | "specialist") || "talent",
      retainerLabel: String(formData.get("retainerLabel") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "add_failed";
    redirect(`/admin/agency?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/agency");
  revalidatePath("/agency");
  redirect("/admin/agency?roster=1");
}

export async function actionAdminRemoveRoster(formData: FormData) {
  await requireAdminAction("agency.manage");
  await removeRosterMember(String(formData.get("creatorSlug") ?? ""));
  revalidatePath("/admin/agency");
  revalidatePath("/agency");
  redirect("/admin/agency?removed=1");
}

export async function actionAdminCreateCampaign(formData: FormData) {
  await requireAdminAction("agency.manage");
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
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "campaign_failed";
    redirect(`/admin/agency?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/agency");
  revalidatePath("/agency");
  redirect("/admin/agency?campaign=1");
}

export async function actionAdminSetCampaignStatus(formData: FormData) {
  await requireAdminAction("agency.manage");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as AgencyCampaign["status"];
  try {
    await setCampaignStatus(id, status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "status_failed";
    redirect(`/admin/agency?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/agency");
  revalidatePath("/agency");
  redirect(`/admin/agency?status=${id}`);
}

export async function actionAdminCreatePortfolio(formData: FormData) {
  await requireAdminAction("agency.manage");
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
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "portfolio_failed";
    redirect(`/admin/agency?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/agency");
  revalidatePath("/agency");
  revalidatePath("/collaboration");
  redirect("/admin/agency?portfolio=1");
}

export async function actionAdminTogglePortfolio(formData: FormData) {
  await requireAdminAction("agency.manage");
  const id = String(formData.get("id") ?? "");
  const published = formData.get("published") === "1";
  try {
    await setPortfolioPublished(id, published);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "toggle_failed";
    redirect(`/admin/agency?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/agency");
  revalidatePath("/agency");
  revalidatePath("/collaboration");
  redirect(`/admin/agency?toggled=${id}`);
}
