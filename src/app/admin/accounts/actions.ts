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

function sectionPath(formData: FormData) {
  return formData.get("section") === "business" ? "/admin/business-accounts" : "/admin/accounts";
}

export async function actionSaveAccountPolicy(formData: FormData) {
  await requireAdminSession("accounts.edit");
  const base = sectionPath(formData);
  const consentVersion = clean(formData.get("consentVersion"), 40);
  const consentCopy = clean(formData.get("consentCopy"), 400);
  if (!consentVersion || !consentCopy) {
    redirect(`${base}?error=policy`);
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
  redirect(`${base}?saved=policy`);
}

export async function actionSaveMember(formData: FormData) {
  await requireAdminSession("accounts.edit");
  const base = sectionPath(formData);
  const id = clean(formData.get("userId"), 80);
  const role = clean(formData.get("role"), 32);
  const planTier = clean(formData.get("planTier"), 32);
  if (!id) redirect(`${base}?error=member`);
  if (!ROLES.includes(role as (typeof ROLES)[number])) redirect(`${base}?error=member`);
  const allowed = new Set(await assignablePlanCodes().catch(() => FALLBACK_PLANS));
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) redirect(`${base}?error=member`);
  if (current.planTier) allowed.add(current.planTier);
  if (!allowed.has(planTier)) redirect(`${base}?error=member`);

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
  redirect(`${base}?saved=member`);
}

export async function actionSendPasswordReset(formData: FormData) {
  await requireAdminSession("accounts.edit");
  const base = sectionPath(formData);
  const id = clean(formData.get("userId"), 80);
  if (!id) redirect(`${base}?reset=failed`);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user?.email) redirect(`${base}?reset=failed`);
  const { requestPasswordReset } = await import("@/lib/accounts");
  const result = await requestPasswordReset(user.email).catch(() => ({ sent: false }));
  redirect(result.sent ? `${base}?reset=sent` : `${base}?reset=failed`);
}

/**
 * Manual identity verification on Influencer accounts.
 * Writes Creator.identityVerified and upserts a document-KYC submission row so Admin → KYC stays in sync.
 */
export async function actionSetInfluencerIdentityKyc(formData: FormData) {
  await requireAdminSession("accounts.edit");
  const base = sectionPath(formData);
  if (base !== "/admin/accounts") redirect(`${base}?error=member`);
  const userId = clean(formData.get("userId"), 80);
  const creatorSlug = clean(formData.get("creatorSlug"), 80);
  const decision = clean(formData.get("decision"), 20);
  if (!userId || !creatorSlug || (decision !== "verified" && decision !== "rejected")) {
    redirect(`${base}?error=member`);
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { creator: { select: { slug: true } } },
  });
  if (!user || user.role !== "CREATOR" || user.creator?.slug !== creatorSlug) {
    redirect(`${base}?error=member`);
  }
  try {
    const { adminSetCreatorKyc } = await import("@/lib/kyc-document");
    await adminSetCreatorKyc({ creatorSlug, decision });
  } catch {
    redirect(`${base}?error=member`);
  }
  redirect(`${base}?saved=kyc-${decision}`);
}
