"use server";

import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { updateHomepageSection, updateMenuItem } from "@/lib/directory";

export async function actionUpdateSection(formData: FormData) {
  const session = await requireAdminAction("banners.edit");
  const status = String(formData.get("status") ?? "published");
  try {
    await updateHomepageSection({
      actor: session.email,
      key: String(formData.get("key") ?? ""),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
      enabled: formData.get("enabled") === "true",
      status: status === "draft" ? "draft" : "published",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save section";
    redirect(`/admin/homepage?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/homepage?saved=1");
}

export async function actionUpdateMenu(formData: FormData) {
  const session = await requireAdminAction("banners.edit");
  try {
    await updateMenuItem({
      actor: session.email,
      id: String(formData.get("id") ?? ""),
      label: String(formData.get("label") ?? "").trim(),
      href: String(formData.get("href") ?? "").trim(),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
      visible: formData.get("visible") === "true",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save menu";
    redirect(`/admin/homepage?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/homepage?saved=1");
}
