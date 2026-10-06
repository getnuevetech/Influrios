/**
 * Collab OS §3.3 — guest collaboration suggestion sample.
 * Logged-out visitors get 2–3 anonymized / partially revealed fits before signup.
 */
import {
  fitCreatorToBrief,
  type CampaignBrief,
  type CreatorFit,
} from "@/lib/business";
import { listDirectoryCreators } from "@/lib/directory";
import { specialtyLabel, type SeedCreator } from "@/lib/seed-data";

export const GUEST_SUGGESTION_SAMPLE_MIN = 2;
export const GUEST_SUGGESTION_SAMPLE_MAX = 3;

export type GuestSuggestionInput = {
  goal?: string | null;
  specialty?: string | null;
  location?: string | null;
  platform?: string | null;
  budget?: string | null;
};

export type GuestSuggestionCard = {
  /** Opaque sample id — never a profile slug. */
  sampleId: string;
  label: string;
  specialty: string;
  specialtyName: string;
  title: string;
  score: number;
  reason: string;
  /** Soft visual only — not a deep-linkable identity cue beyond the blurred label. */
  image: string;
  followersHint: string;
};

/** Ephemeral Campaign Intent used only for guest ranking (not persisted). */
export function buildGuestSuggestionBrief(input: GuestSuggestionInput): CampaignBrief {
  const specialty = (input.specialty ?? "beauty").trim() || "beauty";
  const goal = (input.goal ?? "Brand Awareness").trim() || "Brand Awareness";
  return {
    id: "guest-sample-brief",
    title: `Guest sample · ${goal}`,
    goal,
    specialty,
    budget: (input.budget ?? "$1K – $5K").trim() || "$1K – $5K",
    location: (input.location ?? "Global").trim() || "Global",
    platform: (input.platform ?? "INSTAGRAM").trim() || "INSTAGRAM",
    summary: "Guest collaboration suggestion sample",
    createdAt: new Date(0).toISOString(),
    status: "draft",
  };
}

/** Partially reveal: first name + specialty; never full identity or slug. */
export function anonymizeGuestSuggestion(
  fit: CreatorFit,
  index: number,
): GuestSuggestionCard {
  const specialty = fit.creator.specialties[0] ?? "lifestyle";
  const specialtyName = specialtyLabel(specialty);
  const first = fit.creator.displayName.trim().split(/\s+/)[0] ?? "";
  const label =
    first.length >= 2
      ? `${first} · ${specialtyName} influencer`
      : `Influencer in ${specialtyName}`;
  const followers = fit.creator.socials.reduce((sum, social) => sum + social.followers, 0);
  const followersHint =
    followers >= 1_000_000
      ? `${(followers / 1_000_000).toFixed(1)}M+ audience`
      : followers >= 1_000
        ? `${Math.round(followers / 1_000)}K+ audience`
        : "Growing audience";
  const rawReason = fit.reasons[0] ?? "Strong specialty and market fit for this brief.";
  // Strip the full display name and slug if a reason echoed them.
  const reason = rawReason
    .replaceAll(fit.creator.displayName, label)
    .replaceAll(fit.creator.slug, "this influencer");
  return {
    sampleId: `guest-sample-${index + 1}`,
    label,
    specialty,
    specialtyName,
    title: fit.creator.title,
    score: fit.score,
    reason,
    image: fit.creator.image,
    followersHint,
  };
}

export function sampleGuestSuggestions(
  fits: CreatorFit[],
  limit = GUEST_SUGGESTION_SAMPLE_MAX,
): GuestSuggestionCard[] {
  const size = Math.min(
    Math.max(GUEST_SUGGESTION_SAMPLE_MIN, limit),
    GUEST_SUGGESTION_SAMPLE_MAX,
    fits.length,
  );
  // Prefer at least MIN when enough fits exist; otherwise return what we have (may be 0–1).
  const take = fits.length >= GUEST_SUGGESTION_SAMPLE_MIN ? size : Math.min(limit, fits.length);
  return fits.slice(0, take).map((fit, index) => anonymizeGuestSuggestion(fit, index));
}

export function rankGuestSuggestionSample(
  brief: CampaignBrief,
  creators: readonly SeedCreator[],
): GuestSuggestionCard[] {
  const ranked = creators
    .map((creator) => fitCreatorToBrief(creator, brief))
    .sort((a, b) => b.score - a.score);
  return sampleGuestSuggestions(ranked);
}

/** Assert helper for tests — guest cards must never leak profile slugs. */
export function guestCardLeaksSlug(card: GuestSuggestionCard, slug: string): boolean {
  const haystack = [card.sampleId, card.label, card.title, card.reason, card.image].join(" ");
  return haystack.includes(slug);
}

export async function loadGuestSuggestionSample(
  input: GuestSuggestionInput,
): Promise<{ brief: CampaignBrief; suggestions: GuestSuggestionCard[] }> {
  const brief = buildGuestSuggestionBrief(input);
  const creators = await listDirectoryCreators();
  return { brief, suggestions: rankGuestSuggestionSample(brief, creators) };
}
