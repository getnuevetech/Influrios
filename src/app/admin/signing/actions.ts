"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { saveProvider } from "@/lib/providers";
import {
  advanceSignatureRequest,
  ensureDemoSigningProvider,
  seedDemoSignatureRequest,
  type SignatureStatus,
  SIGNATURE_STATUSES,
} from "@/lib/signing";

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

export async function actionEnsureDemoSigningProvider() {
  await requireAdminAction("signing.edit");
  try {
    await ensureDemoSigningProvider();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not enable the demo signing provider.";
    redirect(`/admin/signing?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/signing");
  redirect("/admin/signing?saved=demo_provider");
}

export async function actionSeedDemoSignatureRequest() {
  await requireAdminAction("signing.edit");
  const result = await seedDemoSignatureRequest();
  revalidatePath("/admin/signing");
  if (!result.ok) redirect(`/admin/signing?error=${encodeURIComponent(result.error)}`);
  redirect(`/admin/signing?saved=seed&request=${encodeURIComponent(result.id)}`);
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

export async function actionDemoCompleteSignature(formData: FormData) {
  await requireAdminAction("signing.edit");
  const id = clean(formData.get("id")).slice(0, 60);
  const { markSignatureFromWebhook } = await import("@/lib/signing");
  const result = await markSignatureFromWebhook({ requestId: id, event: "signed" });
  revalidatePath("/admin/signing");
  if (!result.ok) redirect(`/admin/signing?error=${encodeURIComponent(result.error)}`);
  redirect("/admin/signing?saved=completed");
}
