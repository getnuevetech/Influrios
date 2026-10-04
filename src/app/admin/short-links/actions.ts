"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { prisma } from "@/lib/db";
import { clearShortHostCache, normalizeSlug, setAliasRedirect, setShortLinkDestination } from "@/lib/short-link";

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function actionSaveShortDomain(formData: FormData) {
  await requireAdminAction("shortlinks.edit");
  const hostname = clean(formData.get("hostname"), 120).toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(hostname)) {
    redirect("/admin/short-links?error=Enter%20a%20hostname%20such%20as%20inflr.me");
  }
  await prisma.shortLinkDomain.upsert({
    where: { hostname },
    update: { label: clean(formData.get("label"), 80) || hostname, active: true },
    create: { hostname, label: clean(formData.get("label"), 80) || hostname, active: true },
  });
  clearShortHostCache();
  revalidatePath("/admin/short-links");
  redirect("/admin/short-links?saved=1");
}

export async function actionMakePrimaryDomain(formData: FormData) {
  await requireAdminAction("shortlinks.edit");
  const id = clean(formData.get("id"), 80);
  await prisma.$transaction([
    prisma.shortLinkDomain.updateMany({ data: { isPrimary: false } }),
    prisma.shortLinkDomain.update({ where: { id }, data: { isPrimary: true, active: true } }),
  ]);
  clearShortHostCache();
  revalidatePath("/admin/short-links");
  redirect("/admin/short-links?saved=1");
}

export async function actionSaveShortSettings(formData: FormData) {
  await requireAdminAction("shortlinks.edit");
  const canonicalOrigin = clean(formData.get("canonicalOrigin"), 200).replace(/\/$/, "");
  const allowedHosts = clean(formData.get("allowedHosts"), 1000);
  try {
    const url = new URL(canonicalOrigin);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("bad");
  } catch {
    redirect("/admin/short-links?error=Canonical%20origin%20must%20be%20an%20http%20or%20https%20URL");
  }
  await prisma.shortLinkSettings.upsert({
    where: { id: "default" },
    update: { canonicalOrigin, allowedHosts },
    create: { id: "default", canonicalOrigin, allowedHosts },
  });
  revalidatePath("/admin/short-links");
  redirect("/admin/short-links?saved=1");
}

export async function actionReserveSlug(formData: FormData) {
  await requireAdminAction("shortlinks.edit");
  const slug = normalizeSlug(clean(formData.get("slug"), 40));
  if (!slug) redirect("/admin/short-links?error=Slug%20is%20not%20valid");
  await prisma.reservedSlug.upsert({
    where: { slug },
    update: { reason: clean(formData.get("reason"), 120) || "admin" },
    create: { slug, reason: clean(formData.get("reason"), 120) || "admin" },
  });
  revalidatePath("/admin/short-links");
  redirect("/admin/short-links?saved=1");
}

export async function actionReleaseSlug(formData: FormData) {
  await requireAdminAction("shortlinks.edit");
  const slug = clean(formData.get("slug"), 40);
  await prisma.reservedSlug.deleteMany({ where: { slug } });
  revalidatePath("/admin/short-links");
  redirect("/admin/short-links?saved=1");
}

export async function actionSetLinkStatus(formData: FormData) {
  await requireAdminAction("shortlinks.edit");
  const id = clean(formData.get("id"), 80);
  const status = clean(formData.get("status"), 20);
  if (!["active", "suspended"].includes(status)) redirect("/admin/short-links?error=Unknown%20status");
  await prisma.shortLink.update({ where: { id }, data: { status } });
  revalidatePath("/admin/short-links");
  redirect("/admin/short-links?saved=1");
}

export async function actionAdminDestination(formData: FormData) {
  const admin = await requireAdminAction("shortlinks.edit");
  const id = clean(formData.get("id"), 80);
  const link = await prisma.shortLink.findUnique({ where: { id } });
  if (!link) redirect("/admin/short-links?error=Missing%20link");
  const result = await setShortLinkDestination(
    id,
    clean(formData.get("destination"), 400),
    link.dynamic,
    { type: "admin", id: admin.userId },
  );
  if (!result.ok) redirect(`/admin/short-links?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/admin/short-links");
  redirect("/admin/short-links?saved=1");
}

export async function actionSetAliasRedirect(formData: FormData) {
  await requireAdminAction("shortlinks.edit");
  const id = clean(formData.get("id"), 80);
  const redirectOn = clean(formData.get("redirect"), 10) === "1";
  const result = await setAliasRedirect(id, redirectOn);
  if (!result.ok) redirect(`/admin/short-links?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/admin/short-links");
  redirect("/admin/short-links?saved=1");
}

export async function actionOpenAbuse(formData: FormData) {
  await requireAdminAction("shortlinks.edit");
  const note = clean(formData.get("note"), 500);
  const slug = clean(formData.get("slug"), 40);
  if (!note) redirect("/admin/short-links?error=Add%20a%20note");
  const link = slug ? await prisma.shortLink.findUnique({ where: { slug } }) : null;
  await prisma.shortLinkAbuseCase.create({
    data: { slug: slug || null, shortLinkId: link?.id, note, status: "open" },
  });
  revalidatePath("/admin/short-links");
  redirect("/admin/short-links?saved=1");
}
