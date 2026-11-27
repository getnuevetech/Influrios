"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { prisma } from "@/lib/db";
import {
  APPLE_WALLET_KEY,
  clearWalletConfig,
  getGoogleWalletConfig,
  GOOGLE_WALLET_KEY,
  saveAppleWalletConfig,
  saveGoogleWalletConfig,
} from "@/lib/wallet/config";

async function fileOrText(formData: FormData, fileField: string, textField: string) {
  const file = formData.get(fileField);
  if (file && typeof file === "object" && "arrayBuffer" in file && file.size > 0) {
    if (file.size > 64 * 1024) return "";
    return Buffer.from(await file.arrayBuffer()).toString("utf8");
  }
  return String(formData.get(textField) ?? "");
}

/** Accept a PEM, or a DER .cer file (Apple's download format) converted to PEM. */
async function certificateInput(formData: FormData, fileField: string, textField: string) {
  const file = formData.get(fileField);
  if (file && typeof file === "object" && "arrayBuffer" in file && file.size > 0 && file.size < 64 * 1024) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const asText = bytes.toString("utf8");
    if (asText.includes("BEGIN CERTIFICATE")) return asText;
    const lines = bytes.toString("base64").match(/.{1,64}/g) ?? [];
    return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----\n`;
  }
  return String(formData.get(textField) ?? "");
}

async function audit(actor: string, action: string) {
  await prisma.auditLog.create({ data: { actor, action, objectType: "WalletPasses", objectId: "wallet" } }).catch(() => null);
}

export async function actionSaveAppleWallet(formData: FormData) {
  const session = await requireAdminAction("cards.edit");
  const saved = await saveAppleWalletConfig({
    passTypeIdentifier: String(formData.get("passTypeIdentifier") ?? ""),
    teamIdentifier: String(formData.get("teamIdentifier") ?? "").toUpperCase(),
    certificatePem: await certificateInput(formData, "certificateFile", "certificatePem"),
    privateKeyPem: await fileOrText(formData, "privateKeyFile", "privateKeyPem"),
    privateKeyPassphrase: String(formData.get("privateKeyPassphrase") ?? ""),
    wwdrPem: await certificateInput(formData, "wwdrFile", "wwdrPem"),
  });
  if (!saved.ok) redirect(`/admin/wallet?error=${encodeURIComponent(saved.error)}`);
  await audit(session.email, "wallet.apple_saved");
  revalidatePath("/admin/wallet");
  redirect(`/admin/wallet?saved=apple${saved.complete ? "" : "&incomplete=apple"}`);
}

export async function actionSaveGoogleWallet(formData: FormData) {
  const session = await requireAdminAction("cards.edit");
  const saved = await saveGoogleWalletConfig({
    issuerId: String(formData.get("issuerId") ?? ""),
    serviceAccountJson: await fileOrText(formData, "serviceAccountFile", "serviceAccountJson"),
  });
  if (!saved.ok) redirect(`/admin/wallet?error=${encodeURIComponent(saved.error)}`);
  await audit(session.email, "wallet.google_saved");
  revalidatePath("/admin/wallet");
  redirect(`/admin/wallet?saved=google${saved.complete ? "" : "&incomplete=google"}`);
}

export async function actionCheckGoogleWallet() {
  await requireAdminAction("cards.edit");
  const config = await getGoogleWalletConfig();
  if (!config) redirect(`/admin/wallet?error=${encodeURIComponent("Save the Google issuer ID and service account key first.")}`);
  const { checkGoogleCredentials } = await import("@/lib/wallet/google");
  const result = await checkGoogleCredentials(config);
  redirect(result.ok ? "/admin/wallet?checked=google" : `/admin/wallet?error=${encodeURIComponent(`Google: ${result.error}`)}`);
}

export async function actionClearWallet(formData: FormData) {
  const session = await requireAdminAction("cards.edit");
  const which = formData.get("which") === "google" ? GOOGLE_WALLET_KEY : APPLE_WALLET_KEY;
  await clearWalletConfig(which);
  await audit(session.email, `${which}_cleared`);
  revalidatePath("/admin/wallet");
  redirect("/admin/wallet?cleared=1");
}
