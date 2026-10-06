"use server";

import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { setProductSwitch } from "@/lib/product-switches";
import {
  gatewayRemovalImpact,
  removePaymentGateway,
  saveProvider,
  setCountryGateway,
  setDefaultBackupGateway,
} from "@/lib/providers";

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

export async function actionSaveConnect(formData: FormData) {
  await requireAdminAction("gateways.edit");
  try {
    await saveProvider({
      id: clean(formData.get("id")) || undefined,
      kind: "connect",
      code: clean(formData.get("code")) || "stripe",
      name: clean(formData.get("name")) || "Stripe Connect",
      enabled: formData.get("enabled") === "1",
      baseUrl: "",
      publicKey: "",
      secret: clean(formData.get("secret")),
      webhook: "",
      model: "",
      clearSecret: formData.get("clearSecret") === "1",
    });
    await setProductSwitch("stripe_connect", formData.get("stripe_connect") === "on");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save Stripe Connect.";
    redirect(`/admin/gateways?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/gateways?saved=connect");
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

export async function actionSetDefaultBackupGateway(formData: FormData) {
  await requireAdminAction("gateways.edit");
  try {
    await setDefaultBackupGateway(clean(formData.get("providerId")));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not set the default backup gateway.";
    redirect(`/admin/gateways?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/gateways?saved=default");
}

export async function actionGatewayRemovalImpact(providerId: string) {
  await requireAdminAction("gateways.edit");
  return gatewayRemovalImpact(providerId);
}

export async function actionRemoveGateway(formData: FormData) {
  await requireAdminAction("gateways.edit");
  const providerId = clean(formData.get("providerId"));
  const newDefaultProviderId = clean(formData.get("newDefaultProviderId")) || null;
  const countryCodes = formData.getAll("countryCode").map((value) => clean(value)).filter(Boolean);
  const replacementProviderIds = formData.getAll("replacementProviderId").map((value) => clean(value));
  const replacements = countryCodes.map((countryCode, index) => ({
    countryCode,
    providerId: replacementProviderIds[index] ?? "",
  }));
  try {
    await removePaymentGateway({
      providerId,
      replacements: replacements.filter((row) => row.providerId),
      newDefaultProviderId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove the gateway.";
    redirect(`/admin/gateways?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/gateways?saved=removed");
}

export async function actionSaveCountryGroup(formData: FormData) {
  await requireAdminAction("gateways.edit");
  const { savePaymentCountryGroup } = await import("@/lib/payment-country-groups");
  const countryRaw = clean(formData.get("countryCodes"));
  try {
    await savePaymentCountryGroup({
      id: clean(formData.get("id")) || undefined,
      name: clean(formData.get("name")),
      providerId: clean(formData.get("providerId")),
      countryCodes: [countryRaw],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the country group.";
    redirect(`/admin/gateways?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/gateways?saved=group");
}

export async function actionDeleteCountryGroup(formData: FormData) {
  await requireAdminAction("gateways.edit");
  const { deletePaymentCountryGroup } = await import("@/lib/payment-country-groups");
  try {
    await deletePaymentCountryGroup(clean(formData.get("id")));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove the country group.";
    redirect(`/admin/gateways?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/gateways?saved=group-removed");
}
