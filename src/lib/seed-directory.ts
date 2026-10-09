/**
 * Sample directory personas stay in tests. Product seed deletes an unclaimed row
 * only when the name and bio still match that sample.
 */
import type { Prisma } from "@prisma/client";
import { cmsPayloadWithoutDemoMedia } from "@/lib/cms";
import { prisma } from "@/lib/db";
import { COLLAB_MATCH_PRESETS, SEED_CREATORS } from "@/lib/seed-data";

export function untouchedSeedCreatorWhere(): Prisma.CreatorWhereInput[] {
  return SEED_CREATORS.map((creator) => ({
    slug: creator.slug,
    displayName: creator.displayName,
    bio: creator.bio,
    claimed: false,
    profileState: "UNCLAIMED",
    userId: null,
  }));
}

export function isUntouchedSeedCreator(row: {
  slug: string;
  displayName: string;
  bio: string | null;
  claimed: boolean;
  profileState: string;
  userId?: string | null;
}): boolean {
  return untouchedSeedCreatorWhere().some(
    (sample) =>
      sample.slug === row.slug &&
      sample.displayName === row.displayName &&
      sample.bio === (row.bio ?? "") &&
      row.claimed === false &&
      row.profileState === "UNCLAIMED" &&
      !row.userId,
  );
}

export function featuredCardsAreDefaultSeed(slugs: string[]): boolean {
  const expected = SEED_CREATORS.map((creator) => creator.slug).sort();
  const actual = [...slugs].sort();
  return actual.length === expected.length && actual.every((slug, index) => slug === expected[index]);
}

export function collaborationMatchesAreDefaultSeed(
  matches: Array<{ title: string; leftSlug: string; rightSlug: string }>,
): boolean {
  const key = (match: { title: string; leftSlug: string; rightSlug: string }) =>
    `${match.title}\n${match.leftSlug}\n${match.rightSlug}`;
  const expected = COLLAB_MATCH_PRESETS.map((match) => key(match)).sort();
  const actual = matches.map((match) => key(match)).sort();
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

export async function removeUntouchedSeedCreators(): Promise<number> {
  const result = await prisma.creator.deleteMany({
    where: { OR: untouchedSeedCreatorWhere() },
  });
  return result.count;
}

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Clear homepage featured cards and collaboration pairs that are still the sample set. */
export async function clearStoredSeedCmsSamples(): Promise<number> {
  const [featured, collaboration] = await Promise.all([
    prisma.cmsSection.findUnique({ where: { key: "featured" } }),
    prisma.cmsSection.findUnique({ where: { key: "collaboration" } }),
  ]);
  let cleared = 0;

  const featuredPayload = asRecord(featured?.payload);
  const cards = Array.isArray(featuredPayload?.cards) ? featuredPayload.cards : [];
  const slugs = cards
    .map((card) => (card && typeof card === "object" && "slug" in card ? card.slug : null))
    .filter((slug): slug is string => typeof slug === "string");
  if (featured && featuredPayload && featuredCardsAreDefaultSeed(slugs)) {
    await prisma.cmsSection.update({
      where: { key: "featured" },
      data: { payload: { ...featuredPayload, cards: [] } as Prisma.InputJsonValue },
    });
    cleared += 1;
  }

  const collaborationPayload = asRecord(collaboration?.payload);
  const matches = Array.isArray(collaborationPayload?.matches) ? collaborationPayload.matches : [];
  const parsed = matches.flatMap((match) => {
    if (!match || typeof match !== "object") return [];
    const row = match as Record<string, unknown>;
    if (typeof row.title !== "string" || typeof row.leftSlug !== "string" || typeof row.rightSlug !== "string") {
      return [];
    }
    return [{ title: row.title, leftSlug: row.leftSlug, rightSlug: row.rightSlug }];
  });
  if (
    collaboration &&
    collaborationPayload &&
    parsed.length === matches.length &&
    collaborationMatchesAreDefaultSeed(parsed)
  ) {
    await prisma.cmsSection.update({
      where: { key: "collaboration" },
      data: { payload: { ...collaborationPayload, matches: [] } as Prisma.InputJsonValue },
    });
    cleared += 1;
  }

  return cleared;
}

/** Clear retired /demo/ banner, category, and match images. Uploaded paths stay. */
export async function clearStoredDemoCmsMedia(): Promise<number> {
  const rows = await prisma.cmsSection.findMany({
    where: { key: { in: ["hero", "sponsored", "cta", "card_promo", "categories", "collaboration"] } },
  });
  let cleared = 0;
  for (const row of rows) {
    const payload = asRecord(row.payload);
    if (!payload) continue;
    const next = cmsPayloadWithoutDemoMedia(payload);
    if (!next.changed) continue;
    await prisma.cmsSection.update({
      where: { key: row.key },
      data: { payload: next.payload as Prisma.InputJsonValue },
    });
    cleared += 1;
  }
  return cleared;
}
