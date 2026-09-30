"use server";

import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
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

export async function actionSaveSocialNetwork(formData: FormData) {
  await requireAdminAction("social.edit");
  try {
    await saveSocialNetwork({
      code: clean(formData.get("code")),
      enabled: formData.get("enabled") === "1",
      clientId: clean(formData.get("clientId")),
      secret: clean(formData.get("secret")),
      clearSecret: formData.get("clearSecret") === "1",
      authorizeUrl: clean(formData.get("authorizeUrl")),
      tokenUrl: clean(formData.get("tokenUrl")),
      profileUrl: clean(formData.get("profileUrl")),
      scopes: clean(formData.get("scopes")),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the social network.";
    redirect(`/admin/social?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/social?saved=network");
}
