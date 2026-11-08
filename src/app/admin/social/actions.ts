"use server";

import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { saveMetaWebhookConfig } from "@/lib/meta-webhook";
import { saveSocialNetwork, saveSocialPolicy } from "@/lib/social-connect";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "");
}

export async function actionSaveSocialPolicy(formData: FormData) {
  await requireAdminAction("social.edit");
  try {
    await saveSocialPolicy({
      version: clean(formData.get("version")),
      termsText: clean(formData.get("termsText")),
      policyText: clean(formData.get("policyText")),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the social terms.";
    redirect(`/admin/social?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/social?saved=terms");
}

export async function actionSaveMetaWebhook(formData: FormData) {
  await requireAdminAction("social.edit");
  try {
    await saveMetaWebhookConfig({
      verifyToken: clean(formData.get("verifyToken")),
      clearVerifyToken: formData.get("clearVerifyToken") === "1",
      appSecret: clean(formData.get("appSecret")),
      clearAppSecret: formData.get("clearAppSecret") === "1",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save Meta webhook settings.";
    redirect(`/admin/social?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/social?saved=meta-webhook");
}

export async function actionSaveSocialNetwork(formData: FormData) {
  await requireAdminAction("social.edit");
  try {
    await saveSocialNetwork({
      code: clean(formData.get("code")),
      enabled: formData.get("enabled") === "1",
      clientId: clean(formData.get("clientId")),
      secret: clean(formData.get("secret")),
      clearSecret: formData.get("clearSecret") === "1",
      configId: clean(formData.get("configId")),
      clearConfigId: formData.get("clearConfigId") === "1",
      classicInstagramLogin: formData.get("classicInstagramLogin") === "1",
      oauthRedirectUri: clean(formData.get("oauthRedirectUri")),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the social network.";
    redirect(`/admin/social?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/social?saved=network");
}
