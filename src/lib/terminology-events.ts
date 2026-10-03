/**
 * Terminology addendum §5.2 — canonical Influencer analytics event names.
 * New writes use influencer_* ; meta.legacyEventType preserves warehouse continuity.
 */

export const LEGACY_TO_INFLUENCER_EVENTS = {
  profile_viewed: "influencer_profile_viewed",
  search_submitted: "influencer_search_submitted",
} as const;

export const INFLUENCER_TO_LEGACY_EVENTS = Object.fromEntries(
  Object.entries(LEGACY_TO_INFLUENCER_EVENTS).map(([legacy, canonical]) => [canonical, legacy]),
) as Record<string, string>;

export type LegacyDirectoryEvent = keyof typeof LEGACY_TO_INFLUENCER_EVENTS;
export type InfluencerDirectoryEvent = (typeof LEGACY_TO_INFLUENCER_EVENTS)[LegacyDirectoryEvent];

/** Map a legacy directory event to the canonical influencer_* name for new writes. */
export function canonicalDirectoryEvent(legacyOrCanonical: string): string {
  if (legacyOrCanonical in LEGACY_TO_INFLUENCER_EVENTS) {
    return LEGACY_TO_INFLUENCER_EVENTS[legacyOrCanonical as LegacyDirectoryEvent];
  }
  return legacyOrCanonical;
}

/** Meta enrichment so warehouse views can join legacy columns. */
export function withLegacyEventMeta(
  legacyOrCanonical: string,
  meta: Record<string, unknown> = {},
): Record<string, unknown> {
  const legacy =
    legacyOrCanonical in LEGACY_TO_INFLUENCER_EVENTS
      ? legacyOrCanonical
      : INFLUENCER_TO_LEGACY_EVENTS[legacyOrCanonical];
  if (legacy) {
    return {
      ...meta,
      legacyEventType: legacy,
    };
  }
  return meta;
}
