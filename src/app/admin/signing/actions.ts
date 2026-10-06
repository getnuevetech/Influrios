"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { saveProvider } from "@/lib/providers";
import { advanceSignatureRequest, type SignatureStatus, SIGNATURE_STATUSES } from "@/lib/signing";

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
      integrationKey: clean(formData.get("integrationKey")),
      userId: clean(formData.get("userId")),
      oauthBaseUrl: clean(formData.get("oauthBaseUrl")),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the signing provider.";
    redirect(`/admin/signing?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/signing?saved=provider");
}

export async function actionAdvanceSignatureRequest(formData: FormData) {
  await requireAdminAction("signing.edit");
  const id = clean(formData.get("id")).slice(0, 60);
  const to = clean(formData.get("to")).slice(0, 20) as SignatureStatus;
  if (!SIGNATURE_STATUSES.includes(to)) {
    redirect(`/admin/signing?error=${encodeURIComponent("Unknown signature status.")}`);
  }
  const result = await advanceSignatureRequest({ id, to });
  revalidatePath("/admin/signing");
  if (!result.ok) redirect(`/admin/signing?error=${encodeURIComponent(result.error)}`);
  redirect(`/admin/signing?saved=advanced&status=${encodeURIComponent(result.status)}`);
}

