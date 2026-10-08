"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { saveProvider } from "@/lib/providers";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "");
}

export async function actionSaveSearch(formData: FormData) {
  await requireAdminAction("gateways.edit");
  try {
    await saveProvider({
      id: clean(formData.get("id")) || undefined,
      kind: "search",
      code: "meilisearch",
      name: clean(formData.get("name")) || "Meilisearch",
      enabled: formData.get("enabled") === "1",
      baseUrl: clean(formData.get("baseUrl")),
      publicKey: "",
      secret: clean(formData.get("secret")),
      webhook: "",
      model: "",
      clearSecret: formData.get("clearSecret") === "1",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save Meilisearch.";
    redirect(`/admin/search?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/search");
  redirect("/admin/search?saved=1");
}

export async function actionRebuildSearchIndex() {
  await requireAdminAction("gateways.edit");
  try {
    const { reindexCreatorsAndRecord } = await import("@/lib/creator-search");
    await reindexCreatorsAndRecord();
  } catch (error) {
    const message = error instanceof Error ? error.message : "The search index was not rebuilt.";
    redirect(`/admin/search?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/search");
  redirect("/admin/search?saved=indexed");
}
