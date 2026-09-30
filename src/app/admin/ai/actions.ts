"use server";

import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { assignAiFunction, saveProvider } from "@/lib/providers";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "");
}

export async function actionSaveAiProvider(formData: FormData) {
  await requireAdminAction("ai.edit");
  try {
    await saveProvider({
      id: clean(formData.get("id")) || undefined,
      kind: "ai",
      code: clean(formData.get("code")),
      name: clean(formData.get("name")),
      enabled: formData.get("enabled") === "1",
      baseUrl: clean(formData.get("baseUrl")),
      publicKey: "",
      secret: clean(formData.get("secret")),
      webhook: "",
      model: clean(formData.get("model")),
      clearSecret: formData.get("clearSecret") === "1",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the AI provider.";
    redirect(`/admin/ai?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/ai?saved=provider");
}

export async function actionAssignAiFunction(formData: FormData) {
  await requireAdminAction("ai.edit");
  try {
    await assignAiFunction(clean(formData.get("functionKey")), clean(formData.get("providerId")));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not assign the function.";
    redirect(`/admin/ai?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/ai?saved=function");
}
