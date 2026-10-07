"use server";

import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { deleteFaqEntry, saveFaqEntry } from "@/lib/faq";

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not save the FAQ";
  redirect(`/admin/faq?error=${encodeURIComponent(message)}`);
}

export async function actionSaveFaq(formData: FormData) {
  await requireAdminAction("banners.edit");
  try {
    await saveFaqEntry({
      id: String(formData.get("id") ?? "").trim() || undefined,
      key: String(formData.get("key") ?? ""),
      audience: String(formData.get("audience") ?? ""),
      question: String(formData.get("question") ?? ""),
      answer: String(formData.get("answer") ?? ""),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
      published: formData.get("published") === "1",
    });
  } catch (error) {
    fail(error);
  }
  redirect("/admin/faq?saved=1");
}

export async function actionDeleteFaq(formData: FormData) {
  await requireAdminAction("banners.edit");
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/faq?error=Missing+entry");
  try {
    await deleteFaqEntry(id);
  } catch (error) {
    fail(error);
  }
  redirect("/admin/faq?saved=1");
}
