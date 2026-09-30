"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  DEFAULT_FOOTER_STATS,
  DEFAULT_FOOTER_TAGLINE,
  DEFAULT_SITE_CONFIG,
  invalidateSiteConfigCache,
  statKeyFromLabel,
  type FooterIconKey,
  type FooterTone,
} from "@/lib/site-config";

const ICONS = new Set<FooterIconKey>(["user", "users", "handshake", "building"]);
const TONES = new Set<FooterTone>(["violet", "sky", "blue"]);

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function actionSaveFooterStats(formData: FormData) {
  await requireAdminSession("banners.edit");
  const keys = formData.getAll("key").map((value) => clean(value, 40)).filter(Boolean);
  const tagline = clean(formData.get("footerTagline"), 160) || DEFAULT_FOOTER_TAGLINE;

  await prisma.$transaction(async (tx) => {
    await tx.siteConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        ...DEFAULT_SITE_CONFIG,
        footerTagline: tagline,
      },
      update: { footerTagline: tagline },
    });

    const removed = keys.filter((key) => formData.get(`delete:${key}`) === "1");
    if (removed.length) {
      await tx.footerStat.deleteMany({ where: { key: { in: removed } } });
    }

    for (const key of keys) {
      if (removed.includes(key)) continue;
      const value = clean(formData.get(`value:${key}`), 24);
      const label = clean(formData.get(`label:${key}`), 80);
      if (!value || !label) continue;
      const iconRaw = clean(formData.get(`icon:${key}`), 20);
      const toneRaw = clean(formData.get(`tone:${key}`), 20);
      const sortOrder = Number(formData.get(`sort:${key}`));
      await tx.footerStat.upsert({
        where: { key },
        create: {
          key,
          value,
          label,
          iconKey: ICONS.has(iconRaw as FooterIconKey) ? iconRaw : "user",
          tone: TONES.has(toneRaw as FooterTone) ? toneRaw : "violet",
          sortOrder: Number.isFinite(sortOrder) ? Math.floor(sortOrder) : 0,
          enabled: formData.get(`enabled:${key}`) === "1",
        },
        update: {
          value,
          label,
          iconKey: ICONS.has(iconRaw as FooterIconKey) ? iconRaw : "user",
          tone: TONES.has(toneRaw as FooterTone) ? toneRaw : "violet",
          sortOrder: Number.isFinite(sortOrder) ? Math.floor(sortOrder) : 0,
          enabled: formData.get(`enabled:${key}`) === "1",
        },
      });
    }

    const freshLabel = clean(formData.get("newLabel"), 80);
    const freshValue = clean(formData.get("newValue"), 24);
    if (freshLabel && freshValue) {
      const key = statKeyFromLabel(freshLabel);
      const iconRaw = clean(formData.get("newIcon"), 20);
      const toneRaw = clean(formData.get("newTone"), 20);
      await tx.footerStat.upsert({
        where: { key },
        create: {
          key,
          value: freshValue,
          label: freshLabel,
          iconKey: ICONS.has(iconRaw as FooterIconKey) ? iconRaw : "user",
          tone: TONES.has(toneRaw as FooterTone) ? toneRaw : "violet",
          sortOrder: keys.length,
          enabled: true,
        },
        update: {
          value: freshValue,
          label: freshLabel,
          iconKey: ICONS.has(iconRaw as FooterIconKey) ? iconRaw : "user",
          tone: TONES.has(toneRaw as FooterTone) ? toneRaw : "violet",
          enabled: true,
        },
      });
    }
  });

  invalidateSiteConfigCache();
  redirect("/admin/stats?saved=1");
}

export async function actionRestoreFooterStats() {
  await requireAdminSession("banners.edit");
  await prisma.$transaction(async (tx) => {
    await tx.footerStat.deleteMany();
    await tx.footerStat.createMany({ data: DEFAULT_FOOTER_STATS.map((stat) => ({ ...stat })) });
    await tx.siteConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        ...DEFAULT_SITE_CONFIG,
      },
      update: { footerTagline: DEFAULT_FOOTER_TAGLINE },
    });
  });
  invalidateSiteConfigCache();
  redirect("/admin/stats?restored=1");
}
