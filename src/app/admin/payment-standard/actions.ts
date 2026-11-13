"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession, hasPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { saveRouteDraft, saveTaxPolicyDraft } from "@/lib/payment-standard-store";

function gate(next: string) {
  return getAdminSession().then((session) => {
    if (!session || !hasPermission(session, "collab_finance.manage")) redirect(`/admin/login?next=${encodeURIComponent(next)}`);
    return session;
  });
}

export async function actionSaveRouteDraft(formData: FormData) {
  await gate("/admin/payment-settings?section=routes");
  const saved = await saveRouteDraft({
    countryCode: String(formData.get("countryCode") ?? ""),
    environment: String(formData.get("environment") ?? "") === "live" ? "live" : "sandbox",
    currency: String(formData.get("currency") ?? ""),
    providerCode: String(formData.get("providerCode") ?? "stripe"),
    allocatedFundsApproved: formData.get("allocatedFundsApproved") === "on",
    newCollectionsEnabled: formData.get("newCollectionsEnabled") === "on",
    releasesEnabled: formData.get("releasesEnabled") === "on",
    evidence: String(formData.get("evidence") ?? ""),
  });
  const error = saved.ok ? "" : saved.error;
  revalidatePath("/admin/payment-settings");
  redirect(`/admin/payment-settings?section=routes${error ? `&error=${encodeURIComponent(error)}` : "&saved=route"}`);
}

export async function actionSaveTaxPolicy(formData: FormData) {
  await gate("/admin/payment-settings?section=tax");
  const rateRaw = String(formData.get("rateBps") ?? "").trim();
  const saved = await saveTaxPolicyDraft({
    name: String(formData.get("name") ?? ""),
    liableEntity: String(formData.get("liableEntity") ?? ""),
    treatment: String(formData.get("treatment") ?? ""),
    customerRole: String(formData.get("customerRole") ?? "business"),
    jurisdiction: String(formData.get("jurisdiction") ?? ""),
    classification: String(formData.get("classification") ?? ""),
    filingOwner: String(formData.get("filingOwner") ?? ""),
    inclusive: formData.get("inclusive") === "on",
    rateBps: rateRaw ? Number(rateRaw) : null,
    notes: String(formData.get("notes") ?? ""),
  });
  revalidatePath("/admin/payment-settings");
  redirect(
    `/admin/payment-settings?section=tax${saved.ok ? "&saved=tax" : `&error=${encodeURIComponent(saved.error)}`}`,
  );
}

export async function actionLinkFeeTaxPolicy(formData: FormData) {
  await gate("/admin/payment-settings?section=tax");
  const ruleId = String(formData.get("ruleId") ?? "").trim();
  const taxPolicyId = String(formData.get("taxPolicyId") ?? "").trim();
  if (!ruleId) redirect("/admin/payment-settings?section=tax&error=" + encodeURIComponent("Choose a fee rule."));
  await prisma.collaborationFeeRule.update({ where: { id: ruleId }, data: { taxPolicyId } });
  revalidatePath("/admin/payment-settings");
  redirect("/admin/payment-settings?section=tax&saved=link");
}

export async function actionSavePlanTax(formData: FormData) {
  const session = await getAdminSession();
  if (!session || !hasPermission(session, "plans.edit")) redirect("/admin/login?next=/admin/plans");
  const id = String(formData.get("planId") ?? "").trim();
  const taxBehavior = String(formData.get("taxBehavior") ?? "").trim();
  if (taxBehavior && taxBehavior !== "exclusive" && taxBehavior !== "inclusive") {
    redirect("/admin/plans?error=" + encodeURIComponent("Tax behaviour is exclusive, inclusive, or left unset."));
  }
  await prisma.entitlementPlan.update({
    where: { id },
    data: {
      taxCode: String(formData.get("taxCode") ?? "").trim(),
      taxBehavior,
      taxPolicyId: String(formData.get("taxPolicyId") ?? "").trim(),
    },
  });
  revalidatePath("/admin/plans");
  redirect("/admin/plans?saved=tax");
}

export async function actionRecheckVerification(formData: FormData) {
  const { getAccountSession } = await import("@/lib/accounts");
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/account/verification");
  const checkKey = String(formData.get("checkKey") ?? "").trim();
  const role = String(formData.get("role") ?? "paying_business");
  if (!checkKey) redirect("/account/verification?error=" + encodeURIComponent("Choose a verification task."));
  await prisma.paymentVerificationTask.upsert({
    where: { userId_role_checkKey: { userId: account.id, role, checkKey } },
    create: { userId: account.id, role, checkKey, status: "in_review", ownerLabel: "Influrios review" },
    update: { status: "in_review" },
  });
  revalidatePath("/account/verification");
  redirect("/account/verification?rechecked=1");
}
