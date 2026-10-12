import { prisma } from "@/lib/db";
import { directoryHasCreator } from "@/lib/directory";

/** Sponsored rows stay in the stored placement order. Organic results keep their search order. */
export function splitSponsoredPlacements<T extends { slug: string }>(
  results: T[],
  placementSlugs: string[],
): { sponsored: T[]; organic: T[] } {
  const bySlug = new Map(results.map((creator) => [creator.slug, creator]));
  const sponsoredSet = new Set(placementSlugs);
  const sponsored = placementSlugs.flatMap((slug) => {
    const creator = bySlug.get(slug);
    return creator ? [creator] : [];
  });
  const organic = results.filter((creator) => !sponsoredSet.has(creator.slug));
  return { sponsored, organic };
}

export async function listActiveSponsoredSlugs(): Promise<string[]> {
  const rows = await prisma.sponsoredPlacement.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: { creatorSlug: true },
  });
  return rows.map((row) => row.creatorSlug);
}

export async function listSponsoredPlacements() {
  return prisma.sponsoredPlacement.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, creatorSlug: true, active: true },
  });
}

export async function addSponsoredPlacement(creatorSlug: string) {
  const slug = creatorSlug.trim();
  if (!slug) return { ok: false as const, error: "Enter a profile slug." };
  if (!(await directoryHasCreator(slug))) {
    return { ok: false as const, error: "That profile is not in the directory." };
  }
  const row = await prisma.sponsoredPlacement.upsert({
    where: { creatorSlug: slug },
    create: { creatorSlug: slug, active: true },
    update: { active: true },
  });
  return { ok: true as const, id: row.id };
}

export async function removeSponsoredPlacement(id: string) {
  const clean = id.trim();
  if (!clean) return;
  await prisma.sponsoredPlacement.delete({ where: { id: clean } }).catch(() => undefined);
}
