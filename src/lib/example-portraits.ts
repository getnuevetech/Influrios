/**
 * Example Influencer Card portraits. Admin uploads male and female cartoons.
 * A fresh page load picks one image from the pool.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { portraitAt } from "@/lib/creator-home";
import { BRAND_AVATARS } from "@/lib/profile-media";

const KEY = "example_card_portraits";

export type ExampleCardPortrait = { src: string; gender: "male" | "female" };

const DEFAULTS: ExampleCardPortrait[] = [
  { src: BRAND_AVATARS.female, gender: "female" },
  { src: BRAND_AVATARS.male, gender: "male" },
];

function parsePortraits(payload: unknown): ExampleCardPortrait[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const images = (payload as { images?: unknown }).images;
  if (!Array.isArray(images)) return [];
  return images.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const src = String((row as { src?: unknown }).src ?? "").trim();
    const gender = (row as { gender?: unknown }).gender;
    if (!src.startsWith("/") || src.includes("..")) return [];
    if (gender !== "male" && gender !== "female") return [];
    return [{ src, gender }];
  });
}

export async function listExampleCardPortraits(): Promise<ExampleCardPortrait[]> {
  try {
    const row = await prisma.cmsSection.findUnique({ where: { key: KEY }, select: { payload: true } });
    const parsed = parsePortraits(row?.payload);
    return parsed.length > 0 ? parsed : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function freshExamplePortrait(images: readonly ExampleCardPortrait[], index = Math.random() * Math.max(images.length, 1)) {
  return portraitAt(images, index);
}

async function writePortraits(images: ExampleCardPortrait[]) {
  const payload = { kind: "example_card_portraits", images } as Prisma.InputJsonValue;
  await prisma.cmsSection.upsert({
    where: { key: KEY },
    create: {
      key: KEY,
      title: "Example card portraits",
      sortOrder: 40,
      enabled: true,
      status: "published",
      payload,
    },
    update: { payload },
  });
}

export async function addExampleCardPortrait(portrait: ExampleCardPortrait) {
  const row = await prisma.cmsSection.findUnique({ where: { key: KEY }, select: { payload: true } });
  const next = [...parsePortraits(row?.payload).filter((item) => item.src !== portrait.src), portrait];
  await writePortraits(next);
  return next;
}

export async function removeExampleCardPortrait(src: string) {
  const row = await prisma.cmsSection.findUnique({ where: { key: KEY }, select: { payload: true } });
  const next = parsePortraits(row?.payload).filter((item) => item.src !== src);
  await writePortraits(next);
  return next;
}
