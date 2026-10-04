"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  DEFAULT_FOOTER_TAGLINE,
  DEFAULT_SITE_CONFIG,
  footerStatCreateData,
  DEFAULT_FOOTER_STATS,
  invalidateSiteConfigCache,
  isVerifiedFooterStat,
  statKeyFromLabel,
  type FooterIconKey,
  type FooterTone,
} from "@/lib/site-config";

const ICONS = new Set<FooterIconKey>(["user", "users", "handshake", "building"]);
const TONES = new Set<FooterTone>(["violet", "sky", "blue"]);

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function parseAsOf(raw: string): Date | null {
  if (!raw.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
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
      const source = clean(formData.get(`source:${key}`), 240);
      const asOf = parseAsOf(clean(formData.get(`asOf:${key}`), 40));
      const maxAgeDaysRaw = Number(formData.get(`maxAge:${key}`));
      const maxAgeDays = Number.isFinite(maxAgeDaysRaw) ? Math.max(1, Math.min(730, Math.floor(maxAgeDaysRaw))) : 90;
      const wantEnabled = formData.get(`enabled:${key}`) === "1";
      // Refuse to publish without source/as-of (Dev §23.8).
      const enabled =
        wantEnabled &&
        isVerifiedFooterStat({ enabled: true, source, asOf, maxAgeDays });
      await tx.footerStat.upsert({
        where: { key },
        create: {
          key,
          value,
          label,
          iconKey: ICONS.has(iconRaw as FooterIconKey) ? iconRaw : "user",
          tone: TONES.has(toneRaw as FooterTone) ? toneRaw : "violet",
          sortOrder: Number.isFinite(sortOrder) ? Math.floor(sortOrder) : 0,
          enabled,
          source,
          asOf,
          maxAgeDays,
        },
        update: {
          value,
          label,
          iconKey: ICONS.has(iconRaw as FooterIconKey) ? iconRaw : "user",
          tone: TONES.has(toneRaw as FooterTone) ? toneRaw : "violet",
          sortOrder: Number.isFinite(sortOrder) ? Math.floor(sortOrder) : 0,
          enabled,
          source,
          asOf,
          maxAgeDays,
        },
      });
    }

    const freshLabel = clean(formData.get("newLabel"), 80);
    const freshValue = clean(formData.get("newValue"), 24);
    if (freshLabel && freshValue) {
      const key = statKeyFromLabel(freshLabel);
      const iconRaw = clean(formData.get("newIcon"), 20);
      const toneRaw = clean(formData.get("newTone"), 20);
      const source = clean(formData.get("newSource"), 240);
      const asOf = parseAsOf(clean(formData.get("newAsOf"), 40));
      const enabled = isVerifiedFooterStat({ enabled: true, source, asOf, maxAgeDays: 90 });
      await tx.footerStat.upsert({
        where: { key },
        create: {
          key,
          value: freshValue,
          label: freshLabel,
          iconKey: ICONS.has(iconRaw as FooterIconKey) ? iconRaw : "user",
          tone: TONES.has(toneRaw as FooterTone) ? toneRaw : "violet",
          sortOrder: keys.length,
          enabled,
          source,
          asOf,
          maxAgeDays: 90,
        },
        update: {
          value: freshValue,
          label: freshLabel,
          iconKey: ICONS.has(iconRaw as FooterIconKey) ? iconRaw : "user",
          tone: TONES.has(toneRaw as FooterTone) ? toneRaw : "violet",
          enabled,
          source,
          asOf,
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
    await tx.footerStat.createMany({
      data: DEFAULT_FOOTER_STATS.map((stat) => footerStatCreateData(stat)),
    });
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
