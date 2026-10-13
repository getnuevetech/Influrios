"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import { assignablePlanCodes } from "@/lib/entitlements-db";
import { clampPasswordMin, DEFAULT_SITE_CONFIG, invalidateSiteConfigCache } from "@/lib/site-config";

const ROLES = ["CREATOR", "BUSINESS", "AGENCY", "ADMIN"] as const;
const FALLBACK_PLANS = ["STARTER", "PLUS", "PRO", "BUSINESS_FREE", "BUSINESS_PRO", "AGENCY"];

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function actionSaveAccountPolicy(formData: FormData) {
  await requireAdminSession("accounts.edit");
  const consentVersion = clean(formData.get("consentVersion"), 40);
  const consentCopy = clean(formData.get("consentCopy"), 400);
  if (!consentVersion || !consentCopy) {
    redirect("/admin/accounts?error=policy");
  }
  await prisma.siteConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      footerTagline: DEFAULT_SITE_CONFIG.footerTagline,
      consentVersion,
      consentCopy,
      passwordMinLength: clampPasswordMin(Number(formData.get("passwordMinLength"))),
    },
    update: {
      consentVersion,
      consentCopy,
      passwordMinLength: clampPasswordMin(Number(formData.get("passwordMinLength"))),
    },
  });
  invalidateSiteConfigCache();
  redirect("/admin/accounts?saved=policy");
}

export async function actionSaveMember(formData: FormData) {
  await requireAdminSession("accounts.edit");
  const id = clean(formData.get("userId"), 80);
  const role = clean(formData.get("role"), 32);
  const planTier = clean(formData.get("planTier"), 32);
  if (!id) redirect("/admin/accounts?error=member");
  if (!ROLES.includes(role as (typeof ROLES)[number])) redirect("/admin/accounts?error=member");
  const allowed = new Set(await assignablePlanCodes().catch(() => FALLBACK_PLANS));
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) redirect("/admin/accounts?error=member");
  if (current.planTier) allowed.add(current.planTier);
  if (!allowed.has(planTier)) redirect("/admin/accounts?error=member");

  const suspended = formData.get("suspended") === "1";
  // Email verification is permanent once set by the member code — admin cannot clear it here.
  await prisma.user.update({
    where: { id },
    data: {
      role: role as (typeof ROLES)[number],
      planTier,
      suspendedAt: suspended ? current.suspendedAt ?? new Date() : null,
    },
  });
  redirect("/admin/accounts?saved=member");
}

export async function actionSendPasswordReset(formData: FormData) {
  await requireAdminSession("accounts.edit");
  const id = clean(formData.get("userId"), 80);
  if (!id) redirect("/admin/accounts?reset=failed");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user?.email) redirect("/admin/accounts?reset=failed");
  const { requestPasswordReset } = await import("@/lib/accounts");
  const result = await requestPasswordReset(user.email).catch(() => ({ sent: false }));
  redirect(result.sent ? "/admin/accounts?reset=sent" : "/admin/accounts?reset=failed");
}
