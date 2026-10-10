import Image from "next/image";
import Link from "next/link";
import { CategoryGlyph, IconArrowRight, IconHeart } from "@/components/icons";
import { getCms } from "@/lib/cms";
import { getDirectory } from "@/lib/directory";
import { publicCategoryImage, type SeedCreator } from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories · Influrios" };

function creatorsInCategory(
  creators: SeedCreator[],
  slug: string,
  children?: { slug: string }[],
) {
  return creators.filter(
    (c) =>
      c.specialties.includes(slug) ||
      children?.some((ch) => c.specialties.includes(ch.slug)),
  );
}

export default async function CategoriesPage() {
  const [directory, cms] = await Promise.all([getDirectory(), getCms()]);
  const taxonomy = directory.taxonomy
    .filter((node) => node.active)
    .map((node) => ({ ...node, children: node.children.filter((child) => child.active) }));
  const imageFor = (slug: string) =>
    publicCategoryImage(slug, cms.categories.items.find((item) => item.slug === slug)?.image);
  return (
    <div className="bg-[#F7FAFF]">
      <section className="border-b border-[#E4EBFF] bg-gradient-to-br from-[#EEF2FF] via-[#F7FAFF] to-[#E8F4FF]">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet">
            Niche directory
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold text-indigo sm:text-5xl">
            Influencer Categories
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            Browse every specialty on Influrios — open a niche to filter Discover, or drill into
            sub-categories for tighter influencer matches.
          </p>
          <Link
            href="/discover"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-violet hover:underline"
          >
            Open Discover filters <IconArrowRight size={14} />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6 lg:px-10">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {taxonomy.map((parent) => {
            const creators = creatorsInCategory(directory.creators, parent.slug, parent.children);
            const count = creators.length;
            return (
              <article
                key={parent.slug}
                className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_rgba(17,26,90,0.08)] ring-1 ring-[#E4EBFF]"
              >
                <Link
                  href={`/discover?specialty=${encodeURIComponent(parent.slug)}`}
                  className="group relative block aspect-[5/4] overflow-hidden bg-gradient-to-br from-[#111A5A] to-[#633CFF]"
                >
                  {imageFor(parent.slug) ? (
                    <Image
                      src={imageFor(parent.slug)}
                      alt={parent.name}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-105"
                      sizes="20vw"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-indigo/85 via-indigo/30 to-transparent" />
                  <span className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-violet shadow" aria-hidden>
                    <IconHeart size={13} />
                  </span>
                  {imageFor(parent.slug) ? null : (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/40 backdrop-blur-sm">
                        <CategoryGlyph slug={parent.slug} size={24} />
                      </span>
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <h2 className="font-display text-base font-bold text-white sm:text-lg">
                      {parent.name}
                    </h2>
                    <p className="text-[11px] font-medium text-white/80">
                      {count} creator{count === 1 ? "" : "s"}
                    </p>
                  </div>
                </Link>

                {(parent.children?.length ?? 0) > 0 ? (
                  <div className="flex flex-wrap gap-1.5 p-3">
                    {(parent.children ?? []).slice(0, 4).map((ch) => (
                      <Link
                        key={ch.slug}
                        href={`/discover?specialty=${encodeURIComponent(ch.slug)}`}
                        className="rounded-md bg-[#EEF2FF] px-2 py-1 text-[10px] font-semibold text-indigo hover:bg-[#E0E7FF]"
                      >
                        {ch.name}
                      </Link>
                    ))}
                    {(parent.children?.length ?? 0) > 4 ? (
                      <Link
                        href={`/discover?specialty=${encodeURIComponent(parent.slug)}`}
                        className="rounded-md px-2 py-1 text-[10px] font-semibold text-violet hover:underline"
                      >
                        +{(parent.children?.length ?? 0) - 4} more
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  <div className="p-3">
                    <Link
                      href={`/discover?specialty=${encodeURIComponent(parent.slug)}`}
                      className="text-[11px] font-semibold text-violet hover:underline"
                    >
                      View creators →
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
