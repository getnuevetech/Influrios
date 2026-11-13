import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GuestGateBanner } from "@/components/guest-gate-banner";
import { consumeGuestQuota } from "@/lib/guest-usage";
import { CreatorCard } from "@/components/creator-card";
import { DiscoverFilters, DiscoverSort } from "@/components/discover-filters";
import { IconSearch, SocialIcon } from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { getDirectory, recordDirectoryEvent, searchDirectory } from "@/lib/directory";
import { COMMERCIAL_MODE, CONTENT_STYLE, listDiscoveryFacets } from "@/lib/discovery-facets";
import { demoCreators, publicPagesUseLive } from "@/lib/presentation-demo";
import { filterCreators, formatFollowers, languageOptionsFor, specialtyLabel, totalFollowers } from "@/lib/seed-data";
import { listActiveSponsoredSlugs, splitSponsoredPlacements } from "@/lib/sponsored-placement";
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
    "contentStyle",
    "commercialMode",
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
  const [directory, livePages, facetCatalog] = await Promise.all([
    getDirectory(),
    publicPagesUseLive().catch(() => false),
    listDiscoveryFacets().catch(() => []),
  ]);
  const roster = livePages ? directory.creators : demoCreators();
  const taxonomy = directory.taxonomy
    .filter((node) => node.active)
    .map((node) => ({ ...node, children: node.children.filter((child) => child.active) }));
  const specialties = list(params.specialty).map((slug) => canonicalSpecialty(slug, directory.synonyms) || slug);
  const countries = list(params.country);
  const platforms = list(params.platform);
  const q = first(params.q);
  const sort = first(params.sort) || "relevant";
  const searchQuery = {
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
    contentStyle: first(params.contentStyle),
    commercialMode: first(params.commercialMode),
    rate: first(params.rate),
    openToCollab: first(params.openToCollab),
    verified: first(params.verified),
    sort,
  };
  let results;
  if (livePages) {
    try {
      results = await searchDirectory(searchQuery);
    } catch (error) {
      console.error("discover search failed", error);
      results = filterCreators(directory.creators, searchQuery, directory.synonyms);
    }
    await recordDirectoryEvent("influencer_search_submitted", {
      q,
      specialty: specialties.join(","),
      country: countries.join(","),
      platform: platforms.join(","),
      resultCount: results.length,
      authenticated: false,
    });
  } else {
    results = filterCreators(roster, searchQuery, directory.synonyms);
  }

  const categories = [...taxonomy].sort((a, b) => {
    const ai = CHIP_ORDER.indexOf(a.slug);
    const bi = CHIP_ORDER.indexOf(b.slug);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const categoryOptions = categories.map((item) => ({
    value: item.slug,
    label: item.name,
    count: roster.filter((creator) => creator.specialties.includes(item.slug)).length,
  }));
  const countryNames = [...new Set(roster.map((creator) => creator.locationCountry))].sort();
  const platformOptions = PLATFORMS.map((platform) => ({
    value: platform.value,
    label: platform.label,
    count: roster.filter((creator) => creator.socials.some((social) => social.platform === platform.value)).length,
  }));
  const languages = languageOptionsFor(roster);
  const contentStyleOptions = facetCatalog
    .filter((row) => row.kind === CONTENT_STYLE && row.active)
    .map((row) => ({ value: row.slug, label: row.name }));
  const commercialModeOptions = facetCatalog
    .filter((row) => row.kind === COMMERCIAL_MODE && row.active)
    .map((row) => ({ value: row.slug, label: row.name }));
  const placementSlugs = await listActiveSponsoredSlugs().catch(() => []);
  const { sponsored, organic } = splitSponsoredPlacements(results, placementSlugs);
  const returnTo = discoverReturnPath({
    ...params,
    specialty: specialties,
    platform: platforms,
    country: countries,
  });
  const searchGate = livePages
    ? await consumeGuestQuota("search")
    : { decision: "allow" as const, copy: "" };
  if (livePages && searchGate.decision === "hard") {
    redirect(`/login?next=${encodeURIComponent(returnTo)}&gate=search`);
  }
  const account = await getAccountSession().catch(() => null);
  const profileSlug = first(params.profile);
  const profile = profileSlug ? roster.find((creator) => creator.slug === profileSlug) ?? null : null;
  const closeProfile = returnTo;
  const profileHref = (slug: string) => {
    const url = new URL(returnTo, "http://influrios.local");
    url.searchParams.set("profile", slug);
    return `${url.pathname}?${url.searchParams.toString()}`;
  };

  return (
    <div className="bg-[#F4F7FF] pb-16">
      <GuestGateBanner copy={searchGate.decision === "soft" ? searchGate.copy : ""} next={returnTo} />
      {livePages ? null : (
        <p className="mx-auto w-full max-w-[90rem] px-4 pt-4 text-sm font-semibold text-[#8A5A12] sm:px-6 lg:px-10">
          Sample directory. These profiles are not live partners and cannot be booked from this page.
        </p>
      )}
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-4xl font-bold text-indigo">Find your next collaboration</h1>
        <form action="/discover" className="mt-5 space-y-3">
          <label className="flex items-center gap-2 rounded-2xl border border-[#E4E9F5] bg-white px-4 py-3 shadow-sm">
            <IconSearch size={18} />
            <input name="q" defaultValue={q} placeholder="Search influencers, content themes, or keywords" className="w-full bg-transparent text-sm outline-none" />
          </label>
          {first(params.contentStyle) ? <input type="hidden" name="contentStyle" value={first(params.contentStyle)} /> : null}
          {first(params.commercialMode) ? <input type="hidden" name="commercialMode" value={first(params.commercialMode)} /> : null}
          <div className="flex flex-wrap items-center gap-2">
            <select name="specialty" defaultValue={specialties[0] ?? ""} className="h-11 rounded-xl border border-[#E4E9F5] bg-white px-3 text-sm">
              <option value="">Specialty</option>
              {categoryOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <select name="country" defaultValue={first(params.country)} className="h-11 rounded-xl border border-[#E4E9F5] bg-white px-3 text-sm">
              <option value="">Country</option>
              {countryNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select name="platform" defaultValue={platforms[0] ?? ""} className="h-11 rounded-xl border border-[#E4E9F5] bg-white px-3 text-sm">
              <option value="">Platform</option>
              {platformOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <button type="submit" className="h-11 rounded-xl bg-[#6D4AFF] px-4 text-sm font-semibold text-white">Search</button>
            <Link href="/discover" className="text-sm font-semibold text-[#6D4AFF]">Clear filters</Link>
          </div>
        </form>
        <details className="mt-4 rounded-2xl border border-[#E4E9F5] bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-indigo">More filters</summary>
          <div className="mt-4">
            <DiscoverFilters
              categories={categoryOptions}
              platforms={platformOptions}
              languages={languages}
              contentStyles={contentStyleOptions}
              commercialModes={commercialModeOptions}
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
                contentStyle: first(params.contentStyle),
                commercialMode: first(params.commercialMode),
                rate: first(params.rate),
                verified: first(params.verified) === "1",
                openToCollab: first(params.openToCollab) === "1",
                sort,
                q,
              }}
            />
          </div>
        </details>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-indigo">Showing <strong>{organic.length.toLocaleString()}</strong> influencers</p>
          <DiscoverSort defaultValue={sort} />
        </div>
        {sponsored.length ? (
          <section aria-label="Sponsored" className="mt-6">
            <h2 className="font-display text-xl font-bold text-indigo">Sponsored</h2>
            <p className="mt-1 text-sm text-muted">These placements are labeled and are not part of the organic search ranking.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sponsored.map((creator) => (
                <div key={creator.slug}>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-violet">Sponsored</p>
                  <CreatorCard creator={creator} layout="discover" showTitle showViewProfile features={{ showStatus: false, showHeart: livePages }} />
                </div>
              ))}
            </div>
          </section>
        ) : null}
        <section id="discover-results" className="mt-6">
          {organic.length === 0 ? (
            <div className="rounded-2xl border border-[#E4E9F5] bg-white p-10 text-center">
              <p className="font-semibold text-indigo">No influencers matched those filters.</p>
              <p className="mt-1 text-sm text-muted">Active filters stay in the address bar until you clear them.</p>
              <Link href="/discover" className="mt-4 inline-block text-sm font-semibold text-violet">Clear filters</Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {organic.map((creator) => {
                const followers = totalFollowers(creator);
                const specialty = creator.specialties[0] ? specialtyLabel(creator.specialties[0]) : creator.title;
                const place = [creator.locationCity, creator.locationCountry].filter(Boolean).join(", ");
                return (
                  <article key={creator.slug} className="overflow-hidden rounded-[24px] border border-[#E7ECF5] bg-white shadow-sm">
                    <div className="relative h-40 bg-[#F3EEFF]">
                      {creator.image ? <Image src={creator.image} alt="" fill className="object-cover" sizes="320px" /> : null}
                    </div>
                    <div className="p-4">
                      <h2 className="font-display text-lg font-bold text-[#1B1464]">{creator.displayName}</h2>
                      <p className="text-sm text-[#667085]">{[specialty, place].filter(Boolean).join(" · ")}</p>
                      <div className="mt-2 flex gap-2 text-[#6D4AFF]">
                        {creator.socials.slice(0, 3).map((social) => (
                          <SocialIcon key={social.platform} platform={social.platform} size={16} />
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-[#98A2B3]">
                        {followers > 0 ? `${formatFollowers(followers)} followers` : "Audience metrics not available"}
                      </p>
                      <Link href={profileHref(creator.slug)} className="mt-3 inline-flex rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
                        View profile
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
      {profileSlug && !profile ? (
        <div className="fixed inset-0 z-50">
          <Link href={closeProfile} className="absolute inset-0 bg-[#1B1464]/40" aria-label="Close profile" />
          <div role="dialog" aria-modal="true" className="absolute left-1/2 top-1/2 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-white p-6">
            <h2 className="font-display text-xl font-bold text-[#1B1464]">Profile unavailable</h2>
            <p className="mt-2 text-sm text-[#667085]">This profile is private or not published. Private details stay hidden.</p>
            <Link href={closeProfile} className="mt-4 inline-flex text-sm font-semibold text-[#6D4AFF]">Back to discovery</Link>
          </div>
        </div>
      ) : null}
      {profile ? (
        <div className="fixed inset-0 z-50">
          <Link href={closeProfile} scroll={false} className="absolute inset-0 bg-[#1B1464]/40" aria-label="Close profile" />
          <div role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" className="absolute left-1/2 top-1/2 max-h-[min(90vh,720px)] w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="relative inline-flex h-16 w-16 overflow-hidden rounded-2xl bg-[#F3EEFF]">
                  {profile.image ? <Image src={profile.image} alt="" fill className="object-cover" sizes="64px" /> : null}
                </span>
                <div>
                  <h2 id="profile-dialog-title" className="font-display text-2xl font-bold text-[#1B1464]">{profile.displayName}</h2>
                  <p className="text-sm text-[#667085]">
                    {(profile.specialties[0] ? specialtyLabel(profile.specialties[0]) : profile.title) || "Creator"}
                    {profile.locationCity ? ` · ${profile.locationCity}` : ""}
                    {profile.locationCountry ? `, ${profile.locationCountry}` : ""}
                  </p>
                </div>
              </div>
              <Link href={closeProfile} scroll={false} aria-label="Close" className="text-xl text-[#667085]">×</Link>
            </div>
            <p className="mt-4 text-sm text-[#344054]">{profile.bio || "No public biography is published yet."}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {profile.socials.slice(0, 4).map((social) => {
                const owned = social.source === "oauth" || social.source === "connected";
                return (
                  <li key={social.platform} className="flex items-center justify-between gap-3 rounded-xl bg-[#F8F6FF] px-3 py-2">
                    <span className="inline-flex items-center gap-2 font-semibold text-[#1B1464]">
                      <SocialIcon platform={social.platform} size={16} />
                      {social.platform}
                    </span>
                    <span className="text-xs text-[#667085]">
                      {owned ? "Ownership verified" : "Not verified"}
                      {" · "}
                      {social.followers > 0 ? formatFollowers(social.followers) : "Not available"}
                      {social.refreshedAt ? ` · updated ${social.refreshedAt.slice(0, 10)}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-[#98A2B3]">Audience figures are shown only when a channel has reported them. Missing counts are not zero.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Link href={`/creators/${profile.slug}`} className="rounded-full border border-[#E4E9F5] px-4 py-2 text-sm font-semibold text-[#1B1464]">Full profile</Link>
              <Link
                href={account ? `/collaboration/business/request/new?creator=${encodeURIComponent(profile.slug)}` : `/login?next=${encodeURIComponent(`/collaboration/business/request/new?creator=${profile.slug}`)}`}
                className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white"
              >
                Invite to collaborate
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
