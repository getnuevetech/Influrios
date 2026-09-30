"use server";

import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { saveProvider } from "@/lib/providers";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "");
}

export async function actionSaveSigningProvider(formData: FormData) {
  await requireAdminAction("signing.edit");
  try {
    await saveProvider({
      id: clean(formData.get("id")) || undefined,
      kind: "signing",
      code: clean(formData.get("code")),
      name: clean(formData.get("name")),
      enabled: formData.get("enabled") === "1",
      baseUrl: clean(formData.get("baseUrl")),
      publicKey: clean(formData.get("accountId")),
      secret: clean(formData.get("secret")),
      webhook: clean(formData.get("webhook")),
      model: "",
      clearSecret: formData.get("clearSecret") === "1",
      clearWebhook: formData.get("clearWebhook") === "1",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the signing provider.";
    redirect(`/admin/signing?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/signing?saved=provider");
}
