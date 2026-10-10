import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GuestGateBanner } from "@/components/guest-gate-banner";
import { consumeGuestQuota } from "@/lib/guest-usage";
import { CreatorCard } from "@/components/creator-card";
import { DiscoverFilters, DiscoverSort } from "@/components/discover-filters";
import { CategoryGlyph, IconArrowRight, IconSearch } from "@/components/icons";
import { getDirectory, recordDirectoryEvent, searchDirectory } from "@/lib/directory";
import { formatFollowers, languageOptionsFor, totalFollowers } from "@/lib/seed-data";
import { canonicalSpecialty } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = {
  title: "Discover Influencers",
  description:
    "Find influencers and content creators by specialty, location, and platform on Influrios.",
  keywords: [
    "influencer",
    "influencers",
    "content creator",
    "creator",
    "influencer discovery",
    "Influrios",
  ],
};

const CHIP_ORDER = ["beauty", "travel", "fitness", "home-interior", "hair", "food", "tech", "lifestyle"];

const PLATFORMS = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "X", label: "X" },
  { value: "PINTEREST", label: "Pinterest" },
] as const;

function list(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).flatMap((item) => item.split(",")).filter(Boolean);
}

function first(value: string | string[] | undefined): string {
  return list(value)[0] ?? "";
}

function discoverReturnPath(params: Record<string, string | string[] | undefined>): string {
  const sp = new URLSearchParams();
  for (const key of [
    "q",
    "specialty",
    "country",
    "state",
    "city",
    "platform",
    "language",
    "followersMin",
    "followersMax",
    "engagementMin",
    "engagementMax",
    "collabType",
    "rate",
    "openToCollab",
    "verified",
    "sort",
  ] as const) {
    for (const value of list(params[key])) {
      sp.append(key, value);
    }
  }
  const query = sp.toString();
  return query ? `/discover?${query}` : "/discover";
}

export default async function DiscoverPage({ searchParams }: Props) {
  const params = await searchParams;
  const directory = await getDirectory();
  const taxonomy = directory.taxonomy
    .filter((node) => node.active)
    .map((node) => ({ ...node, children: node.children.filter((child) => child.active) }));
  const specialties = list(params.specialty).map((slug) => canonicalSpecialty(slug, directory.synonyms) || slug);
  const countries = list(params.country);
  const platforms = list(params.platform);
  const q = first(params.q);
  const sort = first(params.sort) || "relevant";
  const results = await searchDirectory({
    q,
    specialty: specialties,
    country: countries,
    state: first(params.state),
    city: first(params.city),
    platform: platforms,
    language: first(params.language),
    followersMin: first(params.followersMin),
    followersMax: first(params.followersMax),
    engagementMin: first(params.engagementMin),
    engagementMax: first(params.engagementMax),
    collabType: first(params.collabType),
    rate: first(params.rate),
    openToCollab: first(params.openToCollab),
    verified: first(params.verified),
    sort,
  });
  await recordDirectoryEvent("influencer_search_submitted", {
    q,
    specialty: specialties.join(","),
    country: countries.join(","),
    platform: platforms.join(","),
    resultCount: results.length,
    authenticated: false,
  });

  const categories = [...taxonomy].sort((a, b) => {
    const ai = CHIP_ORDER.indexOf(a.slug);
    const bi = CHIP_ORDER.indexOf(b.slug);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const chipCategories = CHIP_ORDER.flatMap((slug) => categories.filter((item) => item.slug === slug)).slice(0, 8);
  const categoryOptions = categories.map((item) => ({
    value: item.slug,
    label: item.name,
    count: directory.creators.filter((creator) => creator.specialties.includes(item.slug)).length,
  }));
  const countryNames = [...new Set(directory.creators.map((creator) => creator.locationCountry))].sort();
  const platformOptions = PLATFORMS.map((platform) => ({
    value: platform.value,
    label: platform.label,
    count: directory.creators.filter((creator) => creator.socials.some((social) => social.platform === platform.value)).length,
  }));
  const languages = languageOptionsFor(directory.creators);
  const topMatches = results.slice(0, 5);
  const heroCards = directory.creators.slice(0, 3);
  const activeChip = specialties[0] ?? "";
  const returnTo = discoverReturnPath({
    ...params,
    specialty: specialties,
    platform: platforms,
    country: countries,
  });
  const searchGate = await consumeGuestQuota("search");
  if (searchGate.decision === "hard") {
    redirect(`/login?next=${encodeURIComponent(returnTo)}&gate=search`);
  }

  return (
    <div className="bg-[#F4F7FF] pb-16">
      <GuestGateBanner copy={searchGate.decision === "soft" ? searchGate.copy : ""} next={returnTo} />
      <section className="relative overflow-hidden border-b border-[#E4E9F5] bg-[radial-gradient(ellipse_at_top_right,_#E7DEFF_0%,_#F7FAFF_42%,_#EEF3FF_100%)]">
        <div className="pointer-events-none absolute -right-16 top-0 h-72 w-72 rounded-full bg-[#C4B5FD]/40 blur-3xl" />
        <div className="relative mx-auto grid w-full max-w-[90rem] items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-14">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet">
              Home <span className="text-muted">/</span> Discover
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold text-indigo sm:text-5xl">Discover Influencers</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              Find the perfect influencers for your brand. Search by niche, location, audience and more to
              build meaningful collaborations.
            </p>
            <form action="/discover" className="mt-6 flex max-w-2xl items-center gap-2 rounded-full bg-white p-1.5 shadow-[0_16px_40px_rgba(99,60,255,0.12)] ring-1 ring-[#E4E9F5]">
              {specialties.map((value) => (
                <input key={value} type="hidden" name="specialty" value={value} />
              ))}
              {first(params.country) ? <input type="hidden" name="country" value={first(params.country)} /> : null}
              {first(params.city) ? <input type="hidden" name="city" value={first(params.city)} /> : null}
              {platforms.map((value) => (
                <input key={value} type="hidden" name="platform" value={value} />
              ))}
              <input type="hidden" name="language" value={first(params.language)} />
              <input type="hidden" name="sort" value={sort} />
              <span className="pl-3 text-violet">
                <IconSearch size={18} />
              </span>
              <input
                name="q"
                defaultValue={q}
                placeholder="Search influencers by name, niche, keyword, or location…"
                className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm text-indigo outline-none"
              />
              <button type="submit" className="btn-primary shrink-0 !px-6 !py-2.5 text-sm">
                Search <IconArrowRight size={14} />
              </button>
            </form>
          </div>

          <div className="relative hidden h-64 lg:block">
            <p className="absolute left-6 top-2 z-10 max-w-[12rem] font-script text-2xl leading-tight text-violet">
              Find Amazing Influencers For Your Next Campaign
            </p>
            {heroCards.map((creator, index) => (
              <Link
                key={creator.slug}
                href={`/creators/${creator.slug}`}
                className={`absolute overflow-hidden rounded-2xl shadow-xl ring-2 ring-white ${
                  index === 0
                    ? "left-0 top-16 h-40 w-28 rotate-[-8deg]"
                    : index === 1
                      ? "left-24 top-6 h-44 w-32 rotate-[4deg]"
                      : "right-2 top-14 h-40 w-28 rotate-[8deg]"
                }`}
              >
                <Image src={creator.image} alt={creator.displayName} fill className="object-cover" sizes="140px" />
                {creator.specialties[0] ? (
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-8 text-[10px] font-bold uppercase tracking-wide text-white">
                    {creator.specialties[0].replace("-", " ")}
                  </span>
                ) : null}
              </Link>
            ))}
            <p className="absolute bottom-2 right-4 max-w-[10rem] text-right font-script text-xl text-indigo">
              Great Collaborations. Brighter Brands Together.
            </p>
          </div>
        </div>

        <div className="relative mx-auto flex w-full max-w-[90rem] items-center gap-2 overflow-x-auto px-4 pb-5 sm:px-6 lg:px-10">
          <div className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto">
            {chipCategories.map((item) => {
              const active = activeChip === item.slug;
              return (
                <Link
                  key={item.slug}
                  href={active ? "/discover" : `/discover?specialty=${item.slug}`}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${
                    active ? "bg-violet text-white" : "bg-white text-indigo ring-1 ring-[#E4E9F5]"
                  }`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full ${active ? "bg-white/20" : "bg-gradient-to-br from-[#2979FF] to-[#633CFF]"}`}>
                    <CategoryGlyph slug={item.slug} size={14} />
                  </span>
                  {item.name}
                </Link>
              );
            })}
          </div>
          <Link href="/categories" className="shrink-0 text-sm font-bold text-violet">
            View All Categories →
          </Link>
        </div>
      </section>

      <div className="mx-auto mt-8 grid w-full max-w-[90rem] gap-6 px-4 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-10">
        <aside className="h-fit rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-indigo">Filters</h2>
            <Link href="/discover" className="text-xs font-bold text-violet">
              Clear All
            </Link>
          </div>
          <DiscoverFilters
            categories={categoryOptions}
            platforms={platformOptions}
            languages={languages}
            selected={{
              specialties,
              country: first(params.country),
              city: first(params.city),
              platforms,
              followersMin: Number(first(params.followersMin) || 0),
              followersMax: Number(first(params.followersMax) || 0),
              engagementMin: Number(first(params.engagementMin) || 0),
              engagementMax: Number(first(params.engagementMax) || 0),
              language: first(params.language),
              collabType: first(params.collabType),
              rate: first(params.rate),
              verified: first(params.verified) === "1",
              openToCollab: first(params.openToCollab) === "1",
              sort,
              q,
            }}
          />
        </aside>

        <div className="min-w-0 space-y-6">
          {topMatches.length > 0 ? (
            <section>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-indigo">Top Matches For You</h2>
                  <p className="text-xs text-muted">Based on your search criteria</p>
                </div>
                <a href="#discover-results" className="text-sm font-bold text-violet">
                  View More Recommendations →
                </a>
              </div>
              <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
                {topMatches.map((creator) => (
                  <Link
                    key={creator.slug}
                    href={`/creators/${creator.slug}`}
                    className="w-40 shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E4E9F5]"
                  >
                    <span className="relative block h-28">
                      <Image src={creator.image} alt="" fill className="object-cover" sizes="160px" />
                    </span>
                    <span className="block px-3 py-2.5">
                      <span className="block truncate text-sm font-bold text-indigo">{creator.displayName}</span>
                      <span className="block truncate text-[11px] text-muted">{creator.title}</span>
                      <span className="mt-1 block text-[11px] font-semibold text-violet">
                        {formatFollowers(totalFollowers(creator))} followers
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section id="discover-results">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-indigo">
                  Showing <strong>{results.length.toLocaleString()}</strong> influencers
                </p>
                <p className="text-xs text-muted">Results based on your filters and search criteria</p>
              </div>
              <DiscoverSort defaultValue={sort} />
            </div>

            {results.length === 0 ? (
              <div className="rounded-2xl border border-[#E4E9F5] bg-white p-10 text-center">
                <p className="font-semibold text-indigo">No influencers matched those filters.</p>
                <Link href="/discover" className="mt-4 inline-block text-sm font-semibold text-violet">
                  Clear filters
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {results.map((creator) => (
                  <CreatorCard
                    key={creator.slug}
                    creator={creator}
                    layout="discover"
                    showTitle
                    showBio
                    showViewProfile
                    qrOpensPopup
                    features={{ showStatus: false }}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-r from-[#1B1464] via-[#3D2E9E] to-[#633CFF] text-white shadow-xl">
            <div className="grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <h2 className="font-display text-2xl font-bold sm:text-3xl">Partner with Amazing Influencers</h2>
                <p className="mt-2 max-w-lg text-sm text-white/75">
                  Launch a brand campaign with influencers who match your audience, niche, and goals.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    [directory.creators.length.toLocaleString(), "Influencers in directory"],
                    [countryNames.length.toLocaleString(), "Countries represented"],
                    [taxonomy.length.toLocaleString(), "Active niches"],
                    [results.filter((creator) => creator.openToCollab).length.toLocaleString(), "Open to collaborate"],
                  ].map(([value, label]) => (
                    <span key={label} className="rounded-2xl bg-white/10 px-3 py-2 text-center backdrop-blur">
                      <span className="block font-display text-sm font-bold">{value}</span>
                      <span className="block text-[10px] text-white/70">{label}</span>
                    </span>
                  ))}
                </div>
                <Link
                  href={`/login?next=${encodeURIComponent("/business")}&gate=business`}
                  className="ink-on-light mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold"
                >
                  Create a Campaign
                </Link>
              </div>
              <div className="relative hidden h-48 lg:block">
                {directory.creators[0] ? (
                  <div className="absolute right-6 top-0 h-44 w-36 overflow-hidden rounded-2xl ring-2 ring-white/30">
                    <Image src={directory.creators[0].image} alt="" fill className="object-cover" sizes="144px" />
                  </div>
                ) : null}
                <p className="absolute bottom-2 left-0 max-w-[12rem] font-script text-2xl leading-tight text-white">
                  Bigger Influencers. Brighter Brands. Together.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
