/**
 * Admin-editable option lists used on Campaign Intent selects (collaboration type, timeframe).
 * Defaults seed once; an admin can add, relabel, reorder, or deactivate options afterward.
 */
import { prisma } from "@/lib/db";

export const CATALOG_KINDS = ["collab_type", "timeframe"] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export function isCatalogKind(value: string): value is CatalogKind {
  return (CATALOG_KINDS as readonly string[]).includes(value);
}

export type CatalogOptionRow = {
  id: string;
  kind: CatalogKind;
  label: string;
  value: string;
  sortOrder: number;
  active: boolean;
};

function slugifyValue(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export const DEFAULT_COLLAB_TYPES = [
  "Sponsored Post",
  "Product Seeding",
  "Brand Ambassador",
  "UGC Creation",
  "Event Appearance",
  "Affiliate / Performance",
  "Whitelisting / Spark Ads",
  "Other",
] as const;

export const DEFAULT_TIMEFRAMES = [
  "ASAP",
  "1–2 weeks",
  "2–4 weeks",
  "1–3 months",
  "3–6 months",
  "Ongoing / retainer",
  "Flexible / Other",
] as const;

function defaultsFor(kind: CatalogKind): readonly string[] {
  return kind === "collab_type" ? DEFAULT_COLLAB_TYPES : DEFAULT_TIMEFRAMES;
}

/** Upsert the default options for both kinds. Safe to call repeatedly — it never resurrects a deactivated option. */
export async function ensureCatalogDefaults(): Promise<void> {
  for (const kind of CATALOG_KINDS) {
    const labels = defaultsFor(kind);
    for (let index = 0; index < labels.length; index += 1) {
      const label = labels[index]!;
      const value = slugifyValue(label);
      const existing = await prisma.catalogOption.findUnique({
        where: { kind_value: { kind, value } },
      });
      if (existing) continue;
      await prisma.catalogOption.create({
        data: { kind, label, value, sortOrder: index + 1, active: true },
      });
    }
  }
}

/** Active options for a kind, ordered for display. Seeds defaults on first use. */
export async function listCatalogOptions(kind: CatalogKind): Promise<CatalogOptionRow[]> {
  await ensureCatalogDefaults();
  const rows = await prisma.catalogOption.findMany({
    where: { kind, active: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as CatalogKind,
    label: row.label,
    value: row.value,
    sortOrder: row.sortOrder,
    active: row.active,
  }));
}

/** Every option for a kind (active and inactive) — used by the admin list view. */
export async function listAllCatalogOptions(kind: CatalogKind): Promise<CatalogOptionRow[]> {
  await ensureCatalogDefaults();
  const rows = await prisma.catalogOption.findMany({
    where: { kind },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as CatalogKind,
    label: row.label,
    value: row.value,
    sortOrder: row.sortOrder,
    active: row.active,
  }));
}

/** Add (or reactivate) a catalog option for admin management. */
export async function saveCatalogOption(input: {
  kind: CatalogKind;
  label: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const label = input.label.trim().slice(0, 120);
  if (!label) return { ok: false, error: "Enter a label." };
  if (!isCatalogKind(input.kind)) return { ok: false, error: "Unknown catalog kind." };
  const value = slugifyValue(label);
  if (!value) return { ok: false, error: "That label does not produce a usable value." };
  const existing = await prisma.catalogOption.findUnique({
    where: { kind_value: { kind: input.kind, value } },
  });
  if (existing) {
    const updated = await prisma.catalogOption.update({
      where: { id: existing.id },
      data: { label, active: true },
    });
    return { ok: true, id: updated.id };
  }
  const maxSort = await prisma.catalogOption.aggregate({
    where: { kind: input.kind },
    _max: { sortOrder: true },
  });
  const created = await prisma.catalogOption.create({
    data: {
      kind: input.kind,
      label,
      value,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      active: true,
    },
  });
  return { ok: true, id: created.id };
}

/** Soft-delete a catalog option. Briefs already saved with this value keep it — it is just hidden from new picks. */
export async function deactivateCatalogOption(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = id.trim();
  if (!trimmed) return { ok: false, error: "Choose an option to remove." };
  const existing = await prisma.catalogOption.findUnique({ where: { id: trimmed } });
  if (!existing) return { ok: false, error: "That option no longer exists." };
  await prisma.catalogOption.update({ where: { id: trimmed }, data: { active: false } });
  return { ok: true };
}

/** Reactivate a previously deactivated option. */
export async function activateCatalogOption(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = id.trim();
  if (!trimmed) return { ok: false, error: "Choose an option to restore." };
  const existing = await prisma.catalogOption.findUnique({ where: { id: trimmed } });
  if (!existing) return { ok: false, error: "That option no longer exists." };
  await prisma.catalogOption.update({ where: { id: trimmed }, data: { active: true } });
  return { ok: true };
}
