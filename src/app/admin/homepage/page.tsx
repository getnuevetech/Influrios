import Image from "next/image";
import Link from "next/link";
import {
  actionSaveHomepageCategories,
  actionSaveHomepageCollaboration,
  actionUpdateMenu,
  actionUpdateSection,
} from "@/app/admin/homepage/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { getCms } from "@/lib/cms";
import { getDirectory } from "@/lib/directory";
import { categoryImageFor } from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Homepage · Admin" };

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

const CONTENT_LINKS = [
  {
    href: "/admin/banners",
    title: "Banners & imagery",
    detail: "Hero, sponsored, card promo, and closing CTA — titles, subtitles, CTAs, height scale, uploaded images.",
  },
  {
    href: "/admin/cards",
    title: "Featured influencer cards",
    detail: "Carousel width, social/QR sizes, per-card visibility, order, and feature toggles.",
  },
  {
    href: "/admin/value-prop",
    title: "Value proposition strip",
    detail: "Eyebrow, headlines, pillar cards, accents, and links under sponsored.",
  },
  {
    href: "/admin/stats",
    title: "Site stats / footer counters",
    detail: "Audited numbers and tagline used in chrome (kept off homepage until published).",
  },
  {
    href: "/admin/taxonomy",
    title: "Taxonomy",
    detail: "Category names, active state, and synonyms that feed Discover and homepage category tiles.",
  },
] as const;

export default async function AdminHomepagePage({ searchParams }: Props) {
  const session = await requireAdminPage("banners");
  const query = await searchParams;
  const canEdit = hasPermission(session, "banners.edit");
  const [directory, cms] = await Promise.all([getDirectory(), getCms()]);
  const sections = [...directory.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const menus = directory.menus.filter((item) => item.menu === "header" || item.menu === "footer_platform");
  const taxonomy = directory.taxonomy.filter((node) => node.active);
  const creatorOptions = directory.creators.map((creator) => ({
    slug: creator.slug,
    label: creator.displayName,
  }));

  const categoryItems = taxonomy.map((node) => {
    const managed = cms.categories.items.find((item) => item.slug === node.slug);
    return {
      slug: node.slug,
      name: node.name,
      image: managed?.image || categoryImageFor(node.slug, taxonomy),
    };
  });

  const savedLabel =
    query.saved === "categories"
      ? "Categories section saved."
      : query.saved === "collaboration"
        ? "Collaboration matches saved."
        : query.saved
          ? "Saved."
          : null;

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-indigo">Homepage</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Control section order/publish state, category tile imagery, collaboration match cards, and
          header/footer links. Banner copy, featured cards, and the value strip have dedicated editors
          linked below — every homepage surface is editable from admin.
        </p>
      </div>

      {savedLabel ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{savedLabel}</p>
      ) : null}
      {query.error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{query.error}</p>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-indigo">Content editors</h2>
        <p className="text-sm text-muted">
          Use these for copy, images, dimensions, and styles that belong to each homepage block.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {CONTENT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-2xl border border-[#E4EBFF] bg-white px-4 py-3 transition hover:border-violet/40 hover:shadow-sm"
            >
              <div className="font-semibold text-indigo">{link.title}</div>
              <p className="mt-1 text-xs text-muted">{link.detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-indigo">Section order &amp; publish</h2>
        <p className="text-sm text-muted">
          Order and enabled/draft state reshape the public homepage on the next request. Statistics
          stay off until numbers are audited.
        </p>
        <div className="space-y-3">
          {sections.map((section) => (
            <form
              key={section.key}
              action={actionUpdateSection}
              className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#E4EBFF] bg-white px-4 py-3"
            >
              <input type="hidden" name="key" value={section.key} />
              <div className="min-w-40">
                <div className="font-semibold text-indigo">{section.title}</div>
                <div className="text-[11px] text-muted">{section.key}</div>
              </div>
              <label className="text-xs font-semibold text-muted">
                Order
                <input
                  name="sortOrder"
                  type="number"
                  defaultValue={section.sortOrder}
                  className="mt-1 block w-20 rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm text-indigo"
                />
              </label>
              <label className="text-xs font-semibold text-muted">
                Enabled
                <select
                  name="enabled"
                  defaultValue={section.enabled ? "true" : "false"}
                  className="mt-1 block rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm text-indigo"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-muted">
                Status
                <select
                  name="status"
                  defaultValue={section.status}
                  className="mt-1 block rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm text-indigo"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </label>
              {canEdit ? (
                <button type="submit" className="text-sm font-bold text-violet hover:underline">
                  Save
                </button>
              ) : null}
            </form>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold text-indigo">Categories row</h2>
          <p className="mt-1 text-sm text-muted">
            Title, CTA, and per-category image paths for the single-row horizontal scroller. Images
            should be square (~1024×1024) under <code className="text-xs">/demo/categories/</code> or
            uploads.
          </p>
        </div>
        <form action={actionSaveHomepageCategories} className="space-y-4 rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-muted sm:col-span-3">
              Section title
              <input
                name="title"
                defaultValue={cms.categories.title}
                disabled={!canEdit}
                className="mt-1 block w-full rounded-lg border border-[#E4EBFF] px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              CTA label
              <input
                name="ctaLabel"
                defaultValue={cms.categories.ctaLabel}
                disabled={!canEdit}
                className="mt-1 block w-full rounded-lg border border-[#E4EBFF] px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              CTA href
              <input
                name="ctaHref"
                defaultValue={cms.categories.ctaHref}
                disabled={!canEdit}
                className="mt-1 block w-full rounded-lg border border-[#E4EBFF] px-3 py-2 text-sm text-indigo"
              />
            </label>
          </div>

          <div className="space-y-3">
            {categoryItems.map((item) => (
              <div
                key={item.slug}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-[#EEF2FF] bg-[#F8FAFF] px-3 py-2"
              >
                <input type="hidden" name="slug" value={item.slug} />
                <span className="relative h-12 w-12 overflow-hidden rounded-lg ring-1 ring-[#E4EBFF]">
                  <Image src={item.image} alt="" fill className="object-cover" sizes="48px" />
                </span>
                <div className="min-w-[7rem]">
                  <div className="text-sm font-semibold text-indigo">{item.name}</div>
                  <div className="text-[11px] text-muted">{item.slug}</div>
                </div>
                <label className="min-w-[16rem] flex-1 text-xs font-semibold text-muted">
                  Image path
                  <input
                    name="image"
                    defaultValue={item.image}
                    disabled={!canEdit}
                    className="mt-1 block w-full rounded-lg border border-[#E4EBFF] px-2 py-1.5 text-sm text-indigo"
                  />
                </label>
              </div>
            ))}
          </div>

          {canEdit ? (
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save categories
            </button>
          ) : null}
        </form>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold text-indigo">Collaboration matches row</h2>
          <p className="mt-1 text-sm text-muted">
            Cards in the homepage horizontal scroller. Pair creator slugs, tags (comma-separated),
            and optional cover images. Add more rows by appending after save in a follow-up edit —
            empty trailing fields are ignored; keep unused rows blank.
          </p>
        </div>
        <form
          action={actionSaveHomepageCollaboration}
          className="space-y-4 rounded-2xl border border-[#E4EBFF] bg-white p-5"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Section title
              <input
                name="title"
                defaultValue={cms.collaborationMatches.title}
                disabled={!canEdit}
                className="mt-1 block w-full rounded-lg border border-[#E4EBFF] px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Subtitle
              <input
                name="subtitle"
                defaultValue={cms.collaborationMatches.subtitle}
                disabled={!canEdit}
                className="mt-1 block w-full rounded-lg border border-[#E4EBFF] px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              CTA label
              <input
                name="ctaLabel"
                defaultValue={cms.collaborationMatches.ctaLabel}
                disabled={!canEdit}
                className="mt-1 block w-full rounded-lg border border-[#E4EBFF] px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              CTA href
              <input
                name="ctaHref"
                defaultValue={cms.collaborationMatches.ctaHref}
                disabled={!canEdit}
                className="mt-1 block w-full rounded-lg border border-[#E4EBFF] px-3 py-2 text-sm text-indigo"
              />
            </label>
          </div>

          <div className="space-y-4">
            {[...cms.collaborationMatches.matches, ...Array.from({ length: 2 }, () => null)].map(
              (match, index) => (
                <div
                  key={match?.title ?? `empty-${index}`}
                  className="grid gap-2 rounded-xl border border-[#EEF2FF] bg-[#F8FAFF] p-3 sm:grid-cols-2"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted sm:col-span-2">
                    Match {index + 1}
                  </p>
                  <label className="text-xs font-semibold text-muted sm:col-span-2">
                    Title
                    <input
                      name="matchTitle"
                      defaultValue={match?.title ?? ""}
                      disabled={!canEdit}
                      placeholder="Beauty Influencer + Skincare Partner"
                      className="mt-1 block w-full rounded-lg border border-[#E4EBFF] px-2 py-1.5 text-sm text-indigo"
                    />
                  </label>
                  <label className="text-xs font-semibold text-muted">
                    Left creator
                    <select
                      name="leftSlug"
                      defaultValue={match?.leftSlug ?? ""}
                      disabled={!canEdit}
                      className="mt-1 block w-full rounded-lg border border-[#E4EBFF] px-2 py-1.5 text-sm text-indigo"
                    >
                      <option value="">—</option>
                      {creatorOptions.map((creator) => (
                        <option key={creator.slug} value={creator.slug}>
                          {creator.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-muted">
                    Right creator
                    <select
                      name="rightSlug"
                      defaultValue={match?.rightSlug ?? ""}
                      disabled={!canEdit}
                      className="mt-1 block w-full rounded-lg border border-[#E4EBFF] px-2 py-1.5 text-sm text-indigo"
                    >
                      <option value="">—</option>
                      {creatorOptions.map((creator) => (
                        <option key={creator.slug} value={creator.slug}>
                          {creator.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-muted">
                    Tags (comma-separated)
                    <input
                      name="tags"
                      defaultValue={match?.tags.join(", ") ?? ""}
                      disabled={!canEdit}
                      placeholder="Beauty, Skincare"
                      className="mt-1 block w-full rounded-lg border border-[#E4EBFF] px-2 py-1.5 text-sm text-indigo"
                    />
                  </label>
                  <label className="text-xs font-semibold text-muted">
                    Cover image (optional)
                    <input
                      name="matchImage"
                      defaultValue={match?.image ?? ""}
                      disabled={!canEdit}
                      placeholder="/demo/categories/cat-beauty.jpg"
                      className="mt-1 block w-full rounded-lg border border-[#E4EBFF] px-2 py-1.5 text-sm text-indigo"
                    />
                  </label>
                </div>
              ),
            )}
          </div>

          {canEdit ? (
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save collaboration matches
            </button>
          ) : null}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-indigo">Menus</h2>
        <p className="text-sm text-muted">Header and platform-footer links shown in site chrome.</p>
        <div className="space-y-3">
          {menus.map((item) => (
            <form
              key={item.id}
              action={actionUpdateMenu}
              className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#E4EBFF] bg-white px-4 py-3"
            >
              <input type="hidden" name="id" value={item.id} />
              <div className="text-[11px] font-bold uppercase text-muted">{item.menu}</div>
              <label className="text-xs font-semibold text-muted">
                Label
                <input
                  name="label"
                  defaultValue={item.label}
                  className="mt-1 block rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm text-indigo"
                />
              </label>
              <label className="text-xs font-semibold text-muted">
                URL
                <input
                  name="href"
                  defaultValue={item.href}
                  className="mt-1 block rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm text-indigo"
                />
              </label>
              <label className="text-xs font-semibold text-muted">
                Order
                <input
                  name="sortOrder"
                  type="number"
                  defaultValue={item.sortOrder}
                  className="mt-1 block w-20 rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm text-indigo"
                />
              </label>
              <label className="text-xs font-semibold text-muted">
                Visible
                <select
                  name="visible"
                  defaultValue={item.visible ? "true" : "false"}
                  className="mt-1 block rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm text-indigo"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
              {canEdit ? (
                <button type="submit" className="text-sm font-bold text-violet hover:underline">
                  Save
                </button>
              ) : null}
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
