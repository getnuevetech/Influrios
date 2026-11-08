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
  const count = visibleRequests.length + visibleOpenings.length + (tab === "recommended" ? partners.length : 0) + (tab === "saved" ? savedMatches.length : 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1a1464]">Opportunities</h1>
          <p className="mt-1 text-sm text-[#6b7394]">Discover campaigns and influencer openings that fit you.</p>
        </div>
        <Link href="/dashboard/details" className="rounded-full border border-[#D9D3FF] bg-white px-4 py-2 text-sm font-semibold text-[#6d4aff]">
          Matching preferences
        </Link>
      </div>

      {notice?.kind === "applied" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Application submitted. Track it in Collaborations. This listing now shows Applied.
        </p>
      ) : null}
      {notice?.kind === "error" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice.text}</p>
      ) : null}

      <form action="/collaboration/hub" className="space-y-3">
        <input type="hidden" name="view" value="opportunities" />
        <input type="hidden" name="tab" value={tab} />
        <div className="flex flex-wrap gap-2">
          <label className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-full border border-[#E6ECF7] bg-white px-4 py-2">
            <IconSearch size={16} />
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Search campaigns, brands, or specialties"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <button type="submit" className="btn-primary">
            Search
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select name="category" label="Specialty" value={filters.category} options={categories.map((item) => [item, specialtyLabel(item)])} />
          <Select name="platform" label="Platform" value={filters.platform} options={PLATFORMS.map(([token, , label]) => [token, label])} />
          <label className="rounded-full border border-[#E6ECF7] bg-white px-3 py-2 text-sm text-[#5c6588]">
            <span className="sr-only">Location</span>
            <input name="location" defaultValue={filters.location} placeholder="Location" className="w-28 bg-transparent outline-none" />
          </label>
          <Select name="budget" label="Budget" value={filters.budget} options={budgets.map((item) => [item, item])} />
          <Select
            name="type"
            label="Collaboration type"
            value={tab === "campaigns" ? "campaigns" : tab === "openings" ? "openings" : ""}
            options={[
              ["campaigns", "Brand campaigns"],
              ["openings", "Influencer openings"],
            ]}
          />
          <Link href="/collaboration/hub?view=opportunities" className="text-sm font-semibold text-[#6d4aff]">
            Clear filters
          </Link>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        <Link href={hrefFor(tab, "")} className={`rounded-full px-3 py-1 text-xs font-semibold ${filters.category ? "bg-white text-[#5c6588]" : "bg-[#F4F0FF] text-[#6d4aff]"}`}>
          All
        </Link>
        {categories.map((category) => (
          <Link
            key={category}
            href={hrefFor(tab, category)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${filters.category === category ? "bg-[#6d4aff] text-white" : "bg-[#F4F0FF] text-[#6d4aff]"}`}
          >
            {specialtyLabel(category)}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 border-b border-[#E6ECF7] text-sm font-semibold text-[#5c6588]">
        {(
          [
            ["recommended", "Recommended"],
            ["campaigns", "Brand campaigns"],
            ["openings", "Influencer openings"],
            ["saved", `Saved ${savedRequests.length + savedOpenings.length + savedMatches.length}`],
          ] as const
        ).map(([key, label]) => (
          <Link key={key} href={hrefFor(key)} className={`border-b-2 px-1 py-2 ${tab === key ? "border-[#6d4aff] text-[#6d4aff]" : "border-transparent"}`}>
            {label}
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-[#1a1464]">
          {tab === "recommended" ? "Recommended for you" : tab === "campaigns" ? "Brand campaigns" : tab === "openings" ? "Influencer openings" : "Saved"}
        </h2>
        <p className="text-xs text-[#8b93ad]">{count} listed</p>
      </div>

      {tab === "recommended" ? (
        <p className="text-sm text-[#6b7394]">
          Recommended campaigns are open listings with a stored match score. People listed under recommended partners are a fit, not an available campaign.
        </p>
      ) : null}

      {visibleRequests.length === 0 && visibleOpenings.length === 0 && tab !== "recommended" && tab !== "saved" ? (
        <p className="rounded-3xl border border-dashed border-[#E6ECF7] bg-white px-4 py-8 text-sm text-[#6b7394]">
          No open listings match these filters.
        </p>
      ) : null}
      {tab === "saved" && savedRequests.length + savedOpenings.length + savedMatches.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-[#E6ECF7] bg-white px-4 py-8 text-sm text-[#6b7394]">
          Saved campaigns, openings, and potential partners appear here.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleRequests.map((request) => (
          <CampaignCard
            key={request.id}
            request={request}
            saved={saved.has(`business_request:${request.id}`)}
            application={appliedTo(applications, request.id, null)}
            returnTo={returnTo}
          />
        ))}
        {visibleOpenings.map((opening) => (
          <OpeningCardView
            key={opening.id}
            opening={opening}
            saved={saved.has(`creator_opportunity:${opening.id}`)}
            application={appliedTo(applications, null, opening.id)}
            returnTo={returnTo}
          />
        ))}
      </div>

      {tab === "recommended" && visibleRequests.length === 0 ? (
        <p className="text-sm text-[#6b7394]">No scored brand campaigns match these filters.</p>
      ) : null}

      {tab === "recommended" ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-[#1a1464]">Recommended partners</h2>
          <p className="text-sm text-[#6b7394]">These creators match your profile. A match is not an open campaign.</p>
          {partners.length === 0 ? (
            <p className="text-sm text-[#6b7394]">No partner recommendations yet.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {partners.map((partner) => (
                <li key={`${partner.aSlug}-${partner.bSlug}`} className="rounded-2xl border border-[#E6ECF7] bg-white p-4">
                  <p className="font-semibold text-[#1a1464]">
                    {partner.aName} × {partner.bName}
                  </p>
                  <p className="text-xs text-[#6d4aff]">Match {partner.score}</p>
                  <p className="mt-1 text-sm text-[#6b7394]">{partner.why}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/creators/${partner.aSlug === creatorSlug ? partner.bSlug : partner.aSlug}`} className="btn-primary !py-1.5 text-xs">
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
          <h2 className="font-display text-lg font-bold text-[#1a1464]">Saved partners</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {savedMatches.map((row) => (
              <li key={row.saveId} className="rounded-2xl border border-[#E6ECF7] bg-white p-4">
                <p className="font-semibold text-[#1a1464]">
                  {row.aName} × {row.bName}
                </p>
                <p className="text-xs text-[#6d4aff]">Match {row.score} · saved</p>
                <p className="mt-1 text-sm text-[#6b7394]">{row.why}</p>
                <Link
                  href={`/collaboration/propose?a=${encodeURIComponent(row.partyASlug)}&b=${encodeURIComponent(row.partyBSlug)}&from=${encodeURIComponent(creatorSlug)}`}
                  className="mt-3 inline-flex text-xs font-semibold text-[#6d4aff]"
                >
                  Request collaboration →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="rounded-2xl border border-[#E6ECF7] bg-white px-4 py-3 text-sm text-[#6b7394]">
        Applications are tracked in Collaborations.{" "}
        <Link href="/collaboration/hub?view=collaborations&tab=applications" className="font-semibold text-[#6d4aff]">
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
    <article className="overflow-hidden rounded-3xl border border-[#E6ECF7] bg-white shadow-sm">
      <div className="relative h-36 bg-[#F4F0FF]">
        {request.imageUrl ? (
          <Image src={request.imageUrl} alt="" fill className="object-cover" sizes="360px" />
        ) : null}
        {request.score != null && request.score > 0 ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2 py-1 text-[11px] font-semibold text-[#159A4A]">
            Match {request.score}
          </span>
        ) : null}
        <form action={actionToggleSavedListing} className="absolute right-3 top-3">
          <input type="hidden" name="kind" value="business_request" />
          <input type="hidden" name="listingId" value={request.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" aria-label={saved ? "Remove saved campaign" : "Save campaign"} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#6d4aff] shadow-sm">
            <IconBookmark size={16} className={saved ? "fill-[#6d4aff]" : ""} />
          </button>
        </form>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          {request.logoUrl ? (
            <span className="relative h-8 w-8 overflow-hidden rounded-full bg-[#F4F0FF]">
              <Image src={request.logoUrl} alt="" fill className="object-contain p-1" sizes="32px" />
            </span>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F0FF] text-xs font-bold text-[#6d4aff]">
              {request.brand.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <p className="text-xs text-[#6b7394]">{request.brand}</p>
            <h3 className="font-semibold text-[#1a1464]">{title}</h3>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#6b7394]">
          {platforms.map(([token, platform]) => (
            <SocialIcon key={token} platform={platform} size={14} />
          ))}
          {request.budget ? <span>{request.budget}</span> : null}
          {request.location ? (
            <span className="inline-flex items-center gap-1">
              <IconMapPin size={12} /> {request.location}
            </span>
          ) : null}
        </div>
        {request.lookingFor.trim() && request.summary.trim() ? (
          <p className="line-clamp-2 text-xs text-[#6b7394]">{request.summary}</p>
        ) : null}
        <div className="flex items-center justify-between gap-2 pt-1">
          {application ? (
            <Link href={`/collaboration/applications/${application.id}`} className="text-xs font-semibold text-[#159A4A]">
              Applied · {application.status.replaceAll("_", " ")}
            </Link>
          ) : (
            <span className="text-xs text-[#8b93ad]">{specialtyLabel(request.category)}</span>
          )}
          <Link href={`/collaboration/requests/${encodeURIComponent(request.id)}`} className="btn-primary !px-3 !py-1.5 text-xs">
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
    <article className="overflow-hidden rounded-3xl border border-[#E6ECF7] bg-white shadow-sm">
      <div className="relative flex h-36 items-end bg-[#F4F0FF] p-4">
        {opening.image ? <Image src={opening.image} alt="" fill className="object-cover" sizes="360px" /> : null}
        <form action={actionToggleSavedListing} className="absolute right-3 top-3">
          <input type="hidden" name="kind" value="creator_opportunity" />
          <input type="hidden" name="listingId" value={opening.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" aria-label={saved ? "Remove saved opening" : "Save opening"} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#6d4aff] shadow-sm">
            <IconBookmark size={16} className={saved ? "fill-[#6d4aff]" : ""} />
          </button>
        </form>
        <p className="relative text-xs font-semibold text-white">Influencer opening</p>
      </div>
      <div className="space-y-2 p-4">
        <p className="text-xs text-[#6b7394]">{opening.creatorName}</p>
        <h3 className="font-semibold text-[#1a1464]">{opening.lookingFor || opening.summary}</h3>
        {opening.location ? <p className="text-xs text-[#6b7394]">{opening.location}</p> : null}
        <div className="flex items-center justify-between gap-2 pt-1">
          {application ? (
            <Link href={`/collaboration/applications/${application.id}`} className="text-xs font-semibold text-[#159A4A]">
              Applied · {application.status.replaceAll("_", " ")}
            </Link>
          ) : (
            <span className="text-xs text-[#8b93ad]">Review the brief before you connect</span>
          )}
          <Link href={`/creators/${opening.creatorSlug}`} className="btn-primary !px-3 !py-1.5 text-xs">
            View details →
          </Link>
        </div>
      </div>
    </article>
  );
}

function Select({
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
    <label className="rounded-full border border-[#E6ECF7] bg-white px-3 py-2 text-sm text-[#5c6588]">
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={value} className="bg-transparent outline-none">
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
