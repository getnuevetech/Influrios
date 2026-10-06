"use server";

import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import {
  upsertBusinessRequest,
  upsertCreatorOpportunity,
} from "@/lib/marketplace-listings";

function statusFromForm(value: FormDataEntryValue | null): "draft" | "published" | "closed" {
  const raw = String(value ?? "published");
  if (raw === "draft" || raw === "closed") return raw;
  return "published";
}

export async function actionSaveBusinessRequest(formData: FormData) {
  await requireAdminAction("collaborations.edit");
  try {
    const workspaceRaw = String(formData.get("workspaceId") ?? "").trim();
    await upsertBusinessRequest({
      id: String(formData.get("id") ?? "").trim() || undefined,
      brand: String(formData.get("brand") ?? ""),
      category: String(formData.get("category") ?? ""),
      budget: String(formData.get("budget") ?? ""),
      location: String(formData.get("location") ?? ""),
      tags: String(formData.get("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      summary: String(formData.get("summary") ?? ""),
      lookingFor: String(formData.get("lookingFor") ?? ""),
      logoUrl: String(formData.get("logoUrl") ?? ""),
      imageUrl: String(formData.get("imageUrl") ?? ""),
      status: statusFromForm(formData.get("status")),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
      // Empty clears hub ownership (admin catalog). Non-empty links to BusinessWorkspace.
      workspaceId: workspaceRaw || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save request";
    redirect(`/admin/marketplace-listings?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/marketplace-listings?saved=request");
}

export async function actionSaveCreatorOpportunity(formData: FormData) {
  await requireAdminAction("collaborations.edit");
  try {
    await upsertCreatorOpportunity({
      id: String(formData.get("id") ?? "").trim() || undefined,
      creatorSlug: String(formData.get("creatorSlug") ?? ""),
      lookingFor: String(formData.get("lookingFor") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      purpose: String(formData.get("purpose") ?? ""),
      location: String(formData.get("location") ?? ""),
      status: statusFromForm(formData.get("status")),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save opportunity";
    redirect(`/admin/marketplace-listings?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/marketplace-listings?saved=opportunity");
}
