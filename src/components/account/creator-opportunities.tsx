import Image from "next/image";
import Link from "next/link";
import { actionToggleSavedListing } from "@/app/collaboration/hub/actions";
import { IconBookmark, IconMapPin, IconSearch, SocialIcon } from "@/components/icons";
import { SaveMatchButton } from "@/components/save-match-button";
import { listingApplicationHidesApply, type MarketplaceApplicationRow } from "@/lib/marketplace-listings";
import { specialtyLabel } from "@/lib/seed-data";

type RequestCard = {
  id: string;
  brand: string;
  category: string;
  budget: string;
  location: string;
  tags: string[];
  summary: string;
  lookingFor: string;
  logoUrl?: string | null;
  imageUrl?: string | null;
  score: number | null;
};

type OpeningCard = {
  id: string;
  creatorSlug: string;
  creatorName: string;
  image: string | null;
  lookingFor: string;
  summary: string;
  location: string;
};

const PLATFORMS = [
  ["instagram", "INSTAGRAM", "Instagram"],
  ["tiktok", "TIKTOK", "TikTok"],
  ["youtube", "YOUTUBE", "YouTube"],
  ["x", "X", "X"],
] as const;

function platformsIn(tags: string[]) {
  const hay = tags.map((tag) => tag.toLowerCase());
  return PLATFORMS.filter(([token]) => hay.some((tag) => tag === token || tag.includes(token)));
}

function appliedTo(applications: MarketplaceApplicationRow[], requestId: string | null, opportunityId: string | null) {
  return applications.find((row) => {
    if (!listingApplicationHidesApply(row.status)) return false;
    if (requestId && row.businessRequestId === requestId) return true;
    if (opportunityId && row.opportunityId === opportunityId) return true;
    return false;
  });
}

export function CreatorOpportunities({
  requests,
  openings,
  partners,
  savedMatches,
  savedKeys,
  applications,
  categories,
  budgets,
  filters,
  creatorSlug,
  notice,
  listingsFailed = false,
  loadRef = "",
}: {
  requests: RequestCard[];
  openings: OpeningCard[];
  partners: { aSlug: string; bSlug: string; aName: string; bName: string; score: number; why: string }[];
  savedMatches: { saveId: string; partyASlug: string; partyBSlug: string; aName: string; bName: string; score: number; why: string }[];
  savedKeys: string[];
  applications: MarketplaceApplicationRow[];
  categories: string[];
  budgets: string[];
  filters: {
    q: string;
    category: string;
    platform: string;
    location: string;
    budget: string;
    tab: string;
    sort: string;
  };
  creatorSlug: string;
  notice?: { kind: "saved" | "applied" | "error"; text?: string } | null;
  listingsFailed?: boolean;
  loadRef?: string;
}) {
  const tab = ["campaigns", "openings", "saved"].includes(filters.tab) ? filters.tab : "recommended";
  const saved = new Set(savedKeys);
  const query = new URLSearchParams();
  query.set("view", "opportunities");
  if (filters.q) query.set("q", filters.q);
  if (filters.category) query.set("category", filters.category);
  if (filters.platform) query.set("platform", filters.platform);
  if (filters.location) query.set("location", filters.location);
  if (filters.budget) query.set("budget", filters.budget);
  if (filters.sort) query.set("sort", filters.sort);
  const hrefFor = (nextTab: string, category?: string) => {
    const next = new URLSearchParams(query);
    next.set("tab", nextTab);
    if (category !== undefined) {
      if (category) next.set("category", category);
      else next.delete("category");
    }
    return `/collaboration/hub?${next.toString()}`;
  };
  const returnTo = hrefFor(tab);
  const savedRequests = requests.filter((row) => saved.has(`business_request:${row.id}`));
  const savedOpenings = openings.filter((row) => saved.has(`creator_opportunity:${row.id}`));
  const recommendedRequests = requests.filter((row) => (row.score ?? 0) > 0);
  const visibleRequests = tab === "saved" ? savedRequests : tab === "openings" ? [] : tab === "recommended" ? recommendedRequests : requests;
  const visibleOpenings = tab === "saved" ? savedOpenings : tab === "openings" ? openings : [];
  const savedCount = savedRequests.length + savedOpenings.length + savedMatches.length;
  const count = visibleRequests.length + visibleOpenings.length;
  const heading =
    tab === "recommended" ? "Recommended for you" : tab === "campaigns" ? "Brand campaigns" : tab === "openings" ? "Influencer openings" : "Saved";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[2rem] font-bold leading-none text-[#1B1464]">Opportunities</h1>
          <p className="mt-2 text-sm text-[#667085]">Discover campaigns and influencer openings that fit you.</p>
        </div>
        <Link href="/dashboard/details" className="inline-flex items-center gap-2 rounded-full border border-[#DDD6FE] bg-white px-4 py-2 text-sm font-semibold text-[#6D4AFF]">
          Matching preferences
        </Link>
      </div>

      {listingsFailed ? (
        <p className="rounded-2xl border border-[#F3D7A1] bg-[#FFF8EC] px-4 py-3 text-sm text-[#8A5A12]">
          Could not load opportunities. Refresh this page to try again.{loadRef ? ` Reference ${loadRef}.` : ""}
        </p>
      ) : null}

      {notice?.kind === "applied" ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Application submitted. This listing now shows Applied. Track it in Collaborations.
        </p>
      ) : null}
      {notice?.kind === "error" ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice.text}</p>
      ) : null}

      <form action="/collaboration/hub" className="space-y-3">
        <input type="hidden" name="view" value="opportunities" />
        <input type="hidden" name="tab" value={tab} />
        <div className="flex gap-2">
          <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#E7ECF5] bg-white px-4">
            <IconSearch size={16} />
            <input name="q" defaultValue={filters.q} placeholder="Search campaigns, brands, or specialties" className="w-full bg-transparent text-sm outline-none" />
          </label>
          <button type="submit" className="rounded-full bg-[#6D4AFF] px-5 text-sm font-semibold text-white">
            Search
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter name="category" label="Specialty" value={filters.category} options={categories.map((item) => [item, specialtyLabel(item)])} />
          <Filter name="platform" label="Platform" value={filters.platform} options={PLATFORMS.map(([token, , label]) => [token, label])} />
          <label className="h-10 rounded-full border border-[#E7ECF5] bg-white px-4 text-sm text-[#667085]">
            <input name="location" defaultValue={filters.location} placeholder="Location" className="h-10 w-28 bg-transparent outline-none" />
          </label>
          <Filter name="budget" label="Budget" value={filters.budget} options={budgets.map((item) => [item, item])} />
          <Filter
            name="type"
            label="Collaboration type"
            value={tab === "campaigns" ? "campaigns" : tab === "openings" ? "openings" : ""}
            options={[
              ["campaigns", "Brand campaigns"],
              ["openings", "Influencer openings"],
            ]}
          />
          <Link href="/collaboration/hub?view=opportunities" className="text-sm font-semibold text-[#6D4AFF]">
            Clear filters
          </Link>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        <Link href={hrefFor(tab, "")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filters.category ? "bg-white text-[#667085]" : "bg-[#F3EEFF] text-[#6D4AFF]"}`}>
          All
        </Link>
        {categories.map((category) => (
          <Link
            key={category}
            href={hrefFor(tab, category)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filters.category === category ? "bg-[#6D4AFF] text-white" : "bg-[#F7F4FF] text-[#6D4AFF]"}`}
          >
            {specialtyLabel(category)}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-5 border-b border-[#E7ECF5] text-sm font-semibold text-[#667085]">
        {(
          [
            ["recommended", "Recommended", null],
            ["campaigns", "Brand campaigns", null],
            ["openings", "Influencer openings", null],
            ["saved", "Saved", savedCount],
          ] as const
        ).map(([key, label, badge]) => (
          <Link key={key} href={hrefFor(key)} className={`inline-flex items-center gap-1.5 border-b-2 py-2.5 ${tab === key ? "border-[#6D4AFF] text-[#6D4AFF]" : "border-transparent"}`}>
            {label}
            {badge != null ? <span className="rounded-full bg-[#F3EEFF] px-1.5 text-[11px] text-[#6D4AFF]">{badge}</span> : null}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-[#1B1464]">{heading}</h2>
        <div className="flex items-center gap-3 text-sm text-[#667085]">
          <span>{count} opportunities</span>
          <form action="/collaboration/hub">
            <input type="hidden" name="view" value="opportunities" />
            <input type="hidden" name="tab" value={tab} />
            {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
            {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
            <select name="sort" defaultValue={filters.sort || "match"} className="h-10 rounded-full border border-[#E7ECF5] bg-white px-3 text-sm">
              <option value="match">Best match</option>
              <option value="name">Name</option>
            </select>
            <button type="submit" className="text-xs font-semibold text-[#6D4AFF]">
              Sort
            </button>
          </form>
        </div>
      </div>

      {tab === "recommended" ? (
        <p className="text-sm text-[#667085]">Campaigns below are open listings with a match score. People further down are recommended partners, not available campaigns.</p>
      ) : null}

      {count === 0 ? (
        <p className="rounded-[24px] border border-dashed border-[#E7ECF5] bg-white px-4 py-10 text-center text-sm text-[#667085]">
          {tab === "saved" ? "Saved campaigns and openings appear here." : "No open listings match these filters."}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleRequests.map((request) => (
            <CampaignCard key={request.id} request={request} saved={saved.has(`business_request:${request.id}`)} application={appliedTo(applications, request.id, null)} returnTo={returnTo} />
          ))}
          {visibleOpenings.map((opening) => (
            <OpeningCardView key={opening.id} opening={opening} saved={saved.has(`creator_opportunity:${opening.id}`)} application={appliedTo(applications, null, opening.id)} returnTo={returnTo} />
          ))}
        </div>
      )}

      {tab === "recommended" ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-[#1B1464]">Recommended partners</h2>
          {partners.length === 0 ? (
            <p className="text-sm text-[#667085]">No partner recommendations yet.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {partners.map((partner) => (
                <li key={`${partner.aSlug}-${partner.bSlug}`} className="rounded-[22px] border border-[#E7ECF5] bg-white p-4">
                  <p className="font-semibold text-[#1B1464]">{partner.aName} × {partner.bName}</p>
                  <p className="text-xs font-semibold text-[#178A45]">Match {partner.score}</p>
                  <p className="mt-1 text-sm text-[#667085]">{partner.why}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/creators/${partner.aSlug === creatorSlug ? partner.bSlug : partner.aSlug}`} className="rounded-full bg-[#6D4AFF] px-3 py-1.5 text-xs font-semibold text-white">
                      View details
                    </Link>
                    <SaveMatchButton partyASlug={partner.aSlug} partyBSlug={partner.bSlug} signedIn returnTo={returnTo} compact />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "saved" && savedMatches.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-[#1B1464]">Saved partners</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {savedMatches.map((row) => (
              <li key={row.saveId} className="rounded-[22px] border border-[#E7ECF5] bg-white p-4">
                <p className="font-semibold text-[#1B1464]">{row.aName} × {row.bName}</p>
                <p className="text-xs text-[#6D4AFF]">Match {row.score} · saved</p>
                <p className="mt-1 text-sm text-[#667085]">{row.why}</p>
                <Link href={`/collaboration/propose?a=${encodeURIComponent(row.partyASlug)}&b=${encodeURIComponent(row.partyBSlug)}&from=${encodeURIComponent(creatorSlug)}`} className="mt-3 inline-flex text-xs font-semibold text-[#6D4AFF]">
                  Request collaboration →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E7ECF5] bg-white px-4 py-3 text-sm text-[#667085]">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F4F6FB] text-[11px]">i</span>
        Applications are tracked in Collaborations.{" "}
        <Link href="/collaboration/hub?view=collaborations&tab=applications" className="font-semibold text-[#6D4AFF]">
          View applications →
        </Link>
      </p>
    </div>
  );
}

function CampaignCard({
  request,
  saved,
  application,
  returnTo,
}: {
  request: RequestCard;
  saved: boolean;
  application?: MarketplaceApplicationRow;
  returnTo: string;
}) {
  const platforms = platformsIn(request.tags);
  const title = request.lookingFor.trim() || request.summary.trim() || request.brand;
  return (
    <article className="overflow-hidden rounded-[22px] border border-[#E7ECF5] bg-white shadow-[0_8px_24px_rgba(27,20,100,0.06)]">
      <div className="relative h-40 bg-[#EEF2FF]">
        {request.imageUrl ? <Image src={request.imageUrl} alt="" fill className="object-cover" sizes="360px" /> : null}
        {request.score != null && request.score > 0 ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[11px] font-semibold text-[#178A45] shadow-sm">
            {request.score >= 82 ? "Strong fit" : `Match ${request.score}`}
          </span>
        ) : null}
        <SaveButton kind="business_request" id={request.id} saved={saved} returnTo={returnTo} label={saved ? "Remove saved campaign" : "Save campaign"} />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          {request.logoUrl ? (
            <span className="relative h-8 w-8 overflow-hidden rounded-full bg-[#F4F0FF]">
              <Image src={request.logoUrl} alt="" fill className="object-contain p-1" sizes="32px" />
            </span>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3EEFF] text-xs font-bold text-[#6D4AFF]">
              {request.brand.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-xs text-[#667085]">{request.brand}</p>
            <h3 className="truncate font-semibold text-[#1B1464]">{title}</h3>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#667085]">
          {platforms.length ? (
            <span className="inline-flex items-center gap-1">
              {platforms.map(([token, platform]) => (
                <SocialIcon key={token} platform={platform} size={14} />
              ))}
            </span>
          ) : null}
          {request.budget ? <span className="font-semibold text-[#1B1464]">{request.budget}</span> : null}
          {request.location ? (
            <span className="inline-flex items-center gap-1">
              <IconMapPin size={12} /> {request.location}
            </span>
          ) : null}
        </div>
        {request.summary.trim() ? <p className="line-clamp-2 text-xs text-[#667085]">{request.summary}</p> : null}
        <div className="flex items-center justify-between gap-2">
          {application ? (
            <Link href={`/collaboration/applications/${application.id}`} className="text-xs font-semibold text-[#178A45]">
              Applied
            </Link>
          ) : (
            <span className="text-xs text-[#98A2B3]">{specialtyLabel(request.category)}</span>
          )}
          <Link href={`/collaboration/requests/${encodeURIComponent(request.id)}`} className="rounded-full bg-[#6D4AFF] px-3 py-1.5 text-xs font-semibold text-white">
            View details →
          </Link>
        </div>
      </div>
    </article>
  );
}

function OpeningCardView({
  opening,
  saved,
  application,
  returnTo,
}: {
  opening: OpeningCard;
  saved: boolean;
  application?: MarketplaceApplicationRow;
  returnTo: string;
}) {
  return (
    <article className="overflow-hidden rounded-[22px] border border-[#E7ECF5] bg-white shadow-[0_8px_24px_rgba(27,20,100,0.06)]">
      <div className="relative flex h-40 items-end bg-[#EEF2FF] p-4">
        {opening.image ? <Image src={opening.image} alt="" fill className="object-cover" sizes="360px" /> : null}
        <SaveButton kind="creator_opportunity" id={opening.id} saved={saved} returnTo={returnTo} label={saved ? "Remove saved opening" : "Save opening"} />
        <span className="relative rounded-full bg-white/95 px-2 py-1 text-[11px] font-semibold text-[#6D4AFF]">Influencer opening</span>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-xs text-[#667085]">{opening.creatorName}</p>
          <h3 className="font-semibold text-[#1B1464]">{opening.lookingFor || opening.summary}</h3>
        </div>
        {opening.location ? (
          <p className="inline-flex items-center gap-1 text-xs text-[#667085]">
            <IconMapPin size={12} /> {opening.location}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          {application ? (
            <Link href={`/collaboration/applications/${application.id}`} className="text-xs font-semibold text-[#178A45]">
              Applied
            </Link>
          ) : (
            <span className="text-xs text-[#98A2B3]">Review before connecting</span>
          )}
          <Link href={`/collaboration/openings/${encodeURIComponent(opening.id)}`} className="rounded-full bg-[#6D4AFF] px-3 py-1.5 text-xs font-semibold text-white">
            View details →
          </Link>
        </div>
      </div>
    </article>
  );
}

function SaveButton({ kind, id, saved, returnTo, label }: { kind: string; id: string; saved: boolean; returnTo: string; label: string }) {
  return (
    <form action={actionToggleSavedListing} className="absolute right-3 top-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="listingId" value={id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit" aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#667085] shadow-sm">
        <IconBookmark size={16} className={saved ? "fill-[#6D4AFF] text-[#6D4AFF]" : ""} />
      </button>
    </form>
  );
}

function Filter({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: (readonly [string, string])[];
}) {
  return (
    <label className="h-10 rounded-full border border-[#E7ECF5] bg-white px-3 text-sm text-[#667085]">
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={value} className="h-10 bg-transparent pr-1 outline-none">
        <option value="">{label}</option>
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
