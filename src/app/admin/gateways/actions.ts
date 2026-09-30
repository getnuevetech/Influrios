"use server";

import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { saveProvider, setCountryGateway } from "@/lib/providers";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "");
}

export async function actionSaveGateway(formData: FormData) {
  await requireAdminAction("gateways.edit");
  try {
    await saveProvider({
      id: clean(formData.get("id")) || undefined,
      kind: "payment",
      code: clean(formData.get("code")),
      name: clean(formData.get("name")),
      enabled: formData.get("enabled") === "1",
      baseUrl: clean(formData.get("baseUrl")),
      publicKey: clean(formData.get("publicKey")),
      secret: clean(formData.get("secret")),
      webhook: clean(formData.get("webhook")),
      model: "",
      clearSecret: formData.get("clearSecret") === "1",
      clearWebhook: formData.get("clearWebhook") === "1",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the gateway.";
    redirect(`/admin/gateways?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/gateways?saved=gateway");
}

export async function actionAssignCountryGateway(formData: FormData) {
  await requireAdminAction("gateways.edit");
  try {
    await setCountryGateway(clean(formData.get("countryCode")), clean(formData.get("providerId")));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not assign the country.";
    redirect(`/admin/gateways?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/gateways?saved=country");
}
