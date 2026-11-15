"use server";

import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { normalizePlanCode } from "@/lib/entitlements";
import {
  createEntitlementPlan,
  deleteEntitlementPlan,
  updateEntitlementPlanMeta,
  updatePlanFeature,
} from "@/lib/entitlements-db";

function plansRedirect(formData: FormData | undefined, key: "saved" | "error", value: string) {
  const params = new URLSearchParams();
  params.set(key, value);
  const returned = String(formData?.get("returnAudience") ?? "");
  const chosen = String(formData?.get("audience") ?? "");
  const audience = returned === "creator" || returned === "business" ? returned : chosen;
  const country = String(formData?.get("returnCountry") ?? "").trim().toUpperCase();
  if (audience === "creator" || audience === "business") params.set("audience", audience);
  if (/^[A-Z]{2}$/.test(country)) params.set("country", country);
  return `/admin/plans?${params.toString()}`;
}

function fail(error: unknown, formData?: FormData) {
  const message = error instanceof Error ? error.message : "Could not save";
  redirect(plansRedirect(formData, "error", message));
}

export async function actionUpdatePlanFeature(formData: FormData) {
  const session = await requireAdminAction("plans.edit");
  const planCode = normalizePlanCode(String(formData.get("planCode") ?? ""));
  const featureKey = String(formData.get("featureKey") ?? "");
  const kind = String(formData.get("kind") ?? "");
  if (!planCode) redirect(plansRedirect(formData, "error", "Unknown plan"));

  try {
    if (kind === "int") {
      const limitInt = Number(formData.get("limitInt"));
      await updatePlanFeature({
        actor: session.email,
        planCode,
        featureKey,
        enabled: true,
        limitInt,
        valueText: null,
      });
    } else if (kind === "bool") {
      await updatePlanFeature({
        actor: session.email,
        planCode,
        featureKey,
        enabled: formData.get("enabled") === "true",
        limitInt: null,
        valueText: null,
      });
    } else {
      const valueText = String(formData.get("valueText") ?? "").trim();
      await updatePlanFeature({
        actor: session.email,
        planCode,
        featureKey,
        enabled: true,
        limitInt: null,
        valueText,
      });
    }
  } catch (error) {
    fail(error, formData);
  }
  redirect(plansRedirect(formData, "saved", "1"));
}

export async function actionCreatePlan(formData: FormData) {
  const session = await requireAdminAction("plans.edit");
  const audience = String(formData.get("audience") ?? "") === "business" ? "business" : "creator";
  try {
    await createEntitlementPlan({
      actor: session.email,
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      audience,
      description: String(formData.get("description") ?? ""),
      amountCents: Number(formData.get("amountCents") ?? 0),
      priceLabel: String(formData.get("priceLabel") ?? ""),
      stripePriceId: String(formData.get("stripePriceId") ?? ""),
      publicListing: formData.get("publicListing") === "1",
      copyFrom: String(formData.get("copyFrom") ?? ""),
    });
  } catch (error) {
    fail(error, formData);
  }
  redirect(plansRedirect(formData, "saved", "1"));
}

export async function actionUpdatePlanMeta(formData: FormData) {
  const session = await requireAdminAction("plans.edit");
  try {
    await updateEntitlementPlanMeta({
      actor: session.email,
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      amountCents: Number(formData.get("amountCents") ?? 0),
      priceLabel: String(formData.get("priceLabel") ?? ""),
      stripePriceId: String(formData.get("stripePriceId") ?? ""),
      publicListing: formData.get("publicListing") === "1",
      active: formData.get("active") === "1",
    });
  } catch (error) {
    fail(error, formData);
  }
  redirect(plansRedirect(formData, "saved", "1"));
}

export async function actionDeletePlan(formData: FormData) {
  const session = await requireAdminAction("plans.edit");
  try {
    await deleteEntitlementPlan({ actor: session.email, code: String(formData.get("code") ?? "") });
  } catch (error) {
    fail(error, formData);
  }
  redirect(plansRedirect(formData, "saved", "1"));
}
