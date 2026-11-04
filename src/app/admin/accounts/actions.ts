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
  const next = clean(formData.get("next"), 240);
  if (next.startsWith("/admin/accounts") || next.startsWith("/admin/business-accounts")) {
    return next.split("#")[0] || "/admin/accounts";
  }
  return formData.get("section") === "business" ? "/admin/business-accounts" : "/admin/accounts";
}

function withQuery(base: string, params: Record<string, string | undefined>) {
  const url = new URL(base, "https://influrios.local");
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

async function writeAudit(input: {
  actor: string;
  action: string;
  objectId: string;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.auditLog
    .create({
      data: {
        actor: input.actor,
        action: input.action,
        objectType: "User",
        objectId: input.objectId,
        before: input.before as never,
        after: input.after as never,
      },
    })
    .catch(() => null);
}

export async function actionSaveAccountPolicy(formData: FormData) {
  await requireAdminSession("accounts.edit");
  const base = sectionPath(formData);
  const consentVersion = clean(formData.get("consentVersion"), 40);
  const consentCopy = clean(formData.get("consentCopy"), 400);
  if (!consentVersion || !consentCopy) {
    redirect(withQuery(base, { error: "policy" }));
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
  redirect(withQuery(base, { saved: "policy" }));
}

export async function actionSaveMember(formData: FormData) {
  const session = await requireAdminSession("accounts.edit");
  const base = sectionPath(formData);
  const id = clean(formData.get("userId"), 80);
  const role = clean(formData.get("role"), 32);
  const planTier = clean(formData.get("planTier"), 32);
  if (!id) redirect(withQuery(base, { error: "member" }));
  if (!ROLES.includes(role as (typeof ROLES)[number])) redirect(withQuery(base, { error: "member" }));
  const allowed = new Set(await assignablePlanCodes().catch(() => FALLBACK_PLANS));
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) redirect(withQuery(base, { error: "member" }));
  if (current.planTier) allowed.add(current.planTier);
  if (!allowed.has(planTier)) redirect(withQuery(base, { error: "member" }));

  const suspended = formData.get("suspended") === "1";
  const before = {
    role: current.role,
    planTier: current.planTier,
    suspendedAt: current.suspendedAt?.toISOString() ?? null,
  };
  await prisma.user.update({
    where: { id },
    data: {
      role: role as (typeof ROLES)[number],
      planTier,
      suspendedAt: suspended ? current.suspendedAt ?? new Date() : null,
    },
  });
  await writeAudit({
    actor: session.email,
    action: "accounts.update",
    objectId: id,
    before,
    after: {
      role,
      planTier,
      suspendedAt: suspended ? (current.suspendedAt ?? new Date()).toISOString() : null,
    },
  });
  redirect(withQuery(base, { saved: "member", id }));
}

export async function actionBulkAccountUpdate(formData: FormData) {
  const session = await requireAdminSession("accounts.edit");
  const base = sectionPath(formData);
  const op = clean(formData.get("op"), 32);
  const ids = formData
    .getAll("userIds")
    .map((v) => clean(v, 80))
    .filter(Boolean)
    .slice(0, 100);
  if (!ids.length || !["suspend", "unsuspend"].includes(op)) {
    redirect(withQuery(base, { error: "bulk" }));
  }
  const now = new Date();
  if (op === "suspend") {
    await prisma.user.updateMany({
      where: { id: { in: ids }, suspendedAt: null },
      data: { suspendedAt: now },
    });
  } else {
    await prisma.user.updateMany({
      where: { id: { in: ids } },
      data: { suspendedAt: null },
    });
  }
  await writeAudit({
    actor: session.email,
    action: `accounts.bulk_${op}`,
    objectId: ids[0]!,
    after: { ids, op },
  });
  redirect(withQuery(base, { saved: "bulk" }));
}

export async function actionAddAccountNote(formData: FormData) {
  const session = await requireAdminSession("accounts.edit");
  const base = sectionPath(formData);
  const id = clean(formData.get("userId"), 80);
  const note = clean(formData.get("note"), 1000);
  if (!id || !note) redirect(withQuery(base, { error: "note", id }));
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) redirect(withQuery(base, { error: "note" }));
  await writeAudit({
    actor: session.email,
    action: "accounts.note",
    objectId: id,
    after: { note },
  });
  redirect(withQuery(base, { saved: "note", id }));
}

export async function actionSendPasswordReset(formData: FormData) {
  await requireAdminSession("accounts.edit");
  const base = sectionPath(formData);
  const id = clean(formData.get("userId"), 80);
  if (!id) redirect(withQuery(base, { reset: "failed" }));
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user?.email) redirect(withQuery(base, { reset: "failed", id }));
  const { requestPasswordReset } = await import("@/lib/accounts");
  const result = await requestPasswordReset(user.email).catch(() => ({ sent: false }));
  redirect(withQuery(base, { reset: result.sent ? "sent" : "failed", id }));
}

/**
 * Manual identity verification on Influencer accounts.
 * Writes Creator.identityVerified and upserts a document-KYC submission row so Admin → KYC stays in sync.
 */
export async function actionSetInfluencerIdentityKyc(formData: FormData) {
  const session = await requireAdminSession("accounts.edit");
  const base = sectionPath(formData);
  const userId = clean(formData.get("userId"), 80);
  const creatorSlug = clean(formData.get("creatorSlug"), 80);
  const decision = clean(formData.get("decision"), 20);
  if (!userId || !creatorSlug || (decision !== "verified" && decision !== "rejected")) {
    redirect(withQuery(base, { error: "member", id: userId || undefined }));
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { creator: { select: { slug: true } } },
  });
  if (!user || user.role !== "CREATOR" || user.creator?.slug !== creatorSlug) {
    redirect(withQuery(base, { error: "member", id: userId }));
  }
  try {
    const { adminSetCreatorKyc } = await import("@/lib/kyc-document");
    await adminSetCreatorKyc({ creatorSlug, decision });
  } catch {
    redirect(withQuery(base, { error: "member", id: userId }));
  }
  await writeAudit({
    actor: session.email,
    action: `accounts.kyc_${decision}`,
    objectId: userId,
    after: { creatorSlug, decision },
  });
  redirect(withQuery(base, { saved: `kyc-${decision}`, id: userId }));
}
