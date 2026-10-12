import { prisma } from "@/lib/db";

export const CONTENT_STYLE = "content_style";
export const COMMERCIAL_MODE = "commercial_mode";

export const LAUNCH_DISCOVERY_FACETS = [
  { kind: CONTENT_STYLE, slug: "tutorial", name: "Tutorial" },
  { kind: CONTENT_STYLE, slug: "review", name: "Review" },
  { kind: CONTENT_STYLE, slug: "education", name: "Education" },
  { kind: CONTENT_STYLE, slug: "entertainment", name: "Entertainment" },
  { kind: CONTENT_STYLE, slug: "commentary", name: "Commentary" },
  { kind: CONTENT_STYLE, slug: "live-demonstration", name: "Live demonstration" },
  { kind: CONTENT_STYLE, slug: "transformation", name: "Transformation" },
  { kind: CONTENT_STYLE, slug: "unboxing", name: "Unboxing" },
  { kind: COMMERCIAL_MODE, slug: "sponsorship", name: "Sponsorship" },
  { kind: COMMERCIAL_MODE, slug: "ugc", name: "UGC" },
  { kind: COMMERCIAL_MODE, slug: "appearances", name: "Appearances" },
  { kind: COMMERCIAL_MODE, slug: "affiliate", name: "Affiliate" },
  { kind: COMMERCIAL_MODE, slug: "review", name: "Review" },
  { kind: COMMERCIAL_MODE, slug: "consultation", name: "Consultation" },
  { kind: COMMERCIAL_MODE, slug: "event-coverage", name: "Event coverage" },
  { kind: COMMERCIAL_MODE, slug: "collaboration", name: "Collaboration" },
] as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A catalog slug from an entered name. A blank name has no slug. */
export function discoveryFacetSlug(name: string): string | null {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  if (!slug || !SLUG_PATTERN.test(slug)) return null;
  return slug;
}

/** Unique trimmed lowercase slugs. A missing value is an empty list. */
export function facetList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const slugs: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const slug = item.trim().toLowerCase();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
  }
  return slugs;
}

function isFacetKind(kind: string): kind is typeof CONTENT_STYLE | typeof COMMERCIAL_MODE {
  return kind === CONTENT_STYLE || kind === COMMERCIAL_MODE;
}

/** Insert launch terms that are missing. An existing name and active flag stay as stored. */
export async function ensureDiscoveryFacets() {
  const rows = await prisma.discoveryFacet.findMany({ select: { kind: true, slug: true } });
  const have = new Set(rows.map((row) => `${row.kind}:${row.slug}`));
  for (const [index, facet] of LAUNCH_DISCOVERY_FACETS.entries()) {
    const key = `${facet.kind}:${facet.slug}`;
    if (have.has(key)) continue;
    try {
      await prisma.discoveryFacet.create({
        data: {
          kind: facet.kind,
          slug: facet.slug,
          name: facet.name,
          sortOrder: index,
          active: true,
        },
      });
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "P2002") throw error;
    }
    have.add(key);
  }
}

export async function listDiscoveryFacets() {
  await ensureDiscoveryFacets();
  return prisma.discoveryFacet.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

/** Keep only active catalog slugs for this creator. Unknown slugs are left off. */
export async function replaceCreatorDiscoveryFacets(
  creatorId: string,
  input: { contentStyles?: unknown; commercialModes?: unknown },
) {
  const styles = new Set(facetList(input.contentStyles));
  const modes = new Set(facetList(input.commercialModes));
  const facets = await prisma.discoveryFacet.findMany({ where: { active: true } });
  const facetIds = facets
    .filter((facet) => {
      if (facet.kind === CONTENT_STYLE) return styles.has(facet.slug);
      if (facet.kind === COMMERCIAL_MODE) return modes.has(facet.slug);
      return false;
    })
    .map((facet) => facet.id);
  await prisma.creatorDiscoveryFacet.deleteMany({ where: { creatorId } });
  if (facetIds.length) {
    await prisma.creatorDiscoveryFacet.createMany({
      data: facetIds.map((facetId) => ({ creatorId, facetId })),
    });
  }
}

export async function addDiscoveryFacet(input: { kind: string; name: string }) {
  const name = input.name.trim();
  if (!name) throw new Error("Enter a name.");
  const kind = input.kind.trim();
  if (!isFacetKind(kind)) throw new Error("Choose a content style or a commercial mode.");
  const slug = discoveryFacetSlug(name);
  if (!slug) throw new Error("Enter a name.");
  const existing = await prisma.discoveryFacet.findUnique({ where: { kind_slug: { kind, slug } } });
  if (existing) throw new Error("That term is already in the catalog.");
  const sortOrder = await prisma.discoveryFacet.count({ where: { kind } });
  await prisma.discoveryFacet.create({
    data: { kind, slug, name, sortOrder, active: true },
  });
  const { invalidateDirectoryCache } = await import("@/lib/directory");
  invalidateDirectoryCache();
}

export async function setDiscoveryFacetActive(input: { id: string; active: boolean }) {
  const id = input.id.trim();
  if (!id) throw new Error("Choose a term.");
  await prisma.discoveryFacet.update({ where: { id }, data: { active: input.active } });
  const { invalidateDirectoryCache } = await import("@/lib/directory");
  invalidateDirectoryCache();
}
