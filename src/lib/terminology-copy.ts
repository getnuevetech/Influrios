/**
 * Public-facing role language helpers (Terminology addendum).
 * Do not rewrite creative-activity phrases like "Content Creator" as a designation.
 */

/** Replace standalone Creator (platform role) with Influencer in titles/labels. */
export function normalizeInfluencerRoleTitle(title: string): string {
  return title
    .replace(/\bCreators\b/g, "Influencers")
    .replace(/(?<!Content )\bCreator\b/g, "Influencer");
}
