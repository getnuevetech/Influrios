"use client";

import { useMemo, useState } from "react";
import { SocialIcon } from "@/components/icons";
import { PlaceFields } from "@/components/place-fields";
import { formatFollowers } from "@/lib/seed-data";

export type FilterOption = { value: string; label: string; count: number };

type Selected = {
  specialties: string[];
  country: string;
  city: string;
  platforms: string[];
  followersMin: number;
  followersMax: number;
  engagementMin: number;
  engagementMax: number;
  language: string;
  collabType: string;
  rate: string;
  verified: boolean;
  openToCollab: boolean;
  sort: string;
  q: string;
};

const FOLLOWER_MAX = 20_000_000;
const ENGAGEMENT_MAX = 20;

const COLLAB_TYPES = [
  { value: "sponsored", label: "Sponsored Content" },
  { value: "brand", label: "Brand Campaigns" },
  { value: "product", label: "Product Reviews" },
  { value: "event", label: "Events & Experiences" },
  { value: "ambassador", label: "Long-term Ambassadorships" },
];

const RATES = [
  { value: "", label: "Any rate" },
  { value: "entry", label: "Entry · Starter" },
  { value: "growth", label: "Growth · Plus" },
  { value: "premium", label: "Premium · Pro" },
];

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm font-medium text-indigo">
      <span>{label}</span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input
          type="checkbox"
          name={name}
          value="1"
          defaultChecked={defaultChecked}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-[#E4E9F5] transition peer-checked:bg-[#633CFF]" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function DiscoverFilters({
  categories,
  platforms,
  languages,
  selected,
}: {
  categories: FilterOption[];
  platforms: FilterOption[];
  languages: string[];
  selected: Selected;
}) {
  const [categoryQuery, setCategoryQuery] = useState("");
  const [showCategories, setShowCategories] = useState(false);
  const [followersMin, setFollowersMin] = useState(selected.followersMin);
  const [followersMax, setFollowersMax] = useState(selected.followersMax || FOLLOWER_MAX);
  const [engagementMin, setEngagementMin] = useState(selected.engagementMin);
  const [engagementMax, setEngagementMax] = useState(selected.engagementMax || ENGAGEMENT_MAX);

  const visibleCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    const matched = q ? categories.filter((item) => item.label.toLowerCase().includes(q)) : categories;
    return showCategories ? matched : matched.slice(0, 6);
  }, [categories, categoryQuery, showCategories]);

  return (
    <form id="discover-filters" action="/discover" className="space-y-5">
      <input type="hidden" name="q" value={selected.q} />

      <div>
        <p className="text-xs font-bold text-indigo">Category / Niche</p>
        <input
          value={categoryQuery}
          onChange={(event) => setCategoryQuery(event.target.value)}
          placeholder="Search categories…"
          className="mt-2 w-full rounded-xl border border-border bg-[#F7FAFF] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
        />
        <ul className="mt-3 space-y-2">
          {visibleCategories.map((item) => (
            <li key={item.value}>
              <label className="flex items-center justify-between gap-2 text-sm text-indigo">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="specialty"
                    value={item.value}
                    defaultChecked={selected.specialties.includes(item.value)}
                    className="h-4 w-4 rounded accent-[#633CFF]"
                  />
                  {item.label}
                </span>
                <span className="text-xs text-muted">{item.count.toLocaleString()}</span>
              </label>
            </li>
          ))}
        </ul>
        {categories.length > 6 ? (
          <button
            type="button"
            onClick={() => setShowCategories((value) => !value)}
            className="mt-2 text-xs font-bold text-violet"
          >
            {showCategories ? "Show less" : "Show more"}
          </button>
        ) : null}
      </div>

      <div>
        <p className="text-xs font-bold text-indigo">Location</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Choose a country to limit cities. A city picked on its own fills the country.
        </p>
        <PlaceFields
          countryName="country"
          cityName="city"
          defaultCountry={selected.country}
          defaultCity={selected.city}
          className="mt-2 space-y-3"
        />
      </div>

      <div>
        <p className="text-xs font-bold text-indigo">Platform</p>
        <ul className="mt-3 space-y-2">
          {platforms.map((item) => (
            <li key={item.value}>
              <label className="flex items-center justify-between gap-2 text-sm text-indigo">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="platform"
                    value={item.value}
                    defaultChecked={selected.platforms.includes(item.value)}
                    className="h-4 w-4 rounded accent-[#633CFF]"
                  />
                  <SocialIcon platform={item.value} size={16} />
                  {item.label}
                </span>
                <span className="text-xs text-muted">{item.count.toLocaleString()}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs font-bold text-indigo">
          <span>Follower Range</span>
          <span className="font-semibold text-muted">
            {formatFollowers(followersMin)} – {formatFollowers(followersMax)}
          </span>
        </div>
        <input
          type="range"
          name="followersMin"
          min={0}
          max={FOLLOWER_MAX}
          step={10000}
          value={followersMin}
          onChange={(event) => setFollowersMin(Math.min(Number(event.target.value), followersMax))}
          className="mt-3 w-full accent-[#633CFF]"
        />
        <input
          type="range"
          name="followersMax"
          min={0}
          max={FOLLOWER_MAX}
          step={10000}
          value={followersMax}
          onChange={(event) => setFollowersMax(Math.max(Number(event.target.value), followersMin))}
          className="mt-1 w-full accent-[#633CFF]"
        />
      </div>

      <div>
        <div className="flex items-center justify-between text-xs font-bold text-indigo">
          <span>Engagement Rate</span>
          <span className="font-semibold text-muted">
            {engagementMin}% – {engagementMax}%+
          </span>
        </div>
        <input
          type="range"
          name="engagementMin"
          min={0}
          max={ENGAGEMENT_MAX}
          step={0.5}
          value={engagementMin}
          onChange={(event) => setEngagementMin(Math.min(Number(event.target.value), engagementMax))}
          className="mt-3 w-full accent-[#633CFF]"
        />
        <input
          type="range"
          name="engagementMax"
          min={0}
          max={ENGAGEMENT_MAX}
          step={0.5}
          value={engagementMax}
          onChange={(event) => setEngagementMax(Math.max(Number(event.target.value), engagementMin))}
          className="mt-1 w-full accent-[#633CFF]"
        />
      </div>

      <label className="block text-xs font-bold text-indigo">
        Language
        <select
          name="language"
          defaultValue={selected.language}
          className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-violet"
        >
          <option value="">Any language</option>
          {languages.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-bold text-indigo">
        Collaboration Type
        <select
          name="collabType"
          defaultValue={selected.collabType}
          className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-violet"
        >
          <option value="">Any collaboration</option>
          {COLLAB_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-bold text-indigo">
        Price / Rate Range
        <select
          name="rate"
          defaultValue={selected.rate}
          className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-violet"
        >
          {RATES.map((item) => (
            <option key={item.value || "any"} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-3 border-t border-border pt-4">
        <Toggle name="verified" label="Verified Influencers Only" defaultChecked={selected.verified} />
        <Toggle name="openToCollab" label="Open to Collaborations Only" defaultChecked={selected.openToCollab} />
      </div>

      <button type="submit" className="btn-primary w-full">
        Apply Filters
      </button>
    </form>
  );
}

export function DiscoverSort({ defaultValue }: { defaultValue: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Sort by
      <select
        form="discover-filters"
        name="sort"
        defaultValue={defaultValue || "relevant"}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-indigo outline-none focus:ring-2 focus:ring-violet"
      >
        <option value="relevant">Most Relevant</option>
        <option value="followers">Followers</option>
        <option value="engagement">Engagement</option>
        <option value="name">Name</option>
      </select>
    </label>
  );
}
