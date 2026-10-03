import { InfluencerCardView } from "@/components/influencer-card-view";
import { DRAFT_PREVIEW_ENTITLEMENTS, type EntitlementLimits } from "@/lib/entitlements";
import { entitlementsForPlan } from "@/lib/entitlements-db";
import { shortLinkPublicLabel } from "@/lib/short-link";
import type { SeedCreator } from "@/lib/seed-data";

/** Server wrapper: resolves plan limits from the database before rendering the card. */
export async function PublicInfluencerCard({
  creator,
  qrDisplay = "default",
  compact = false,
  hideCta = false,
  draftPreview = false,
}: {
  creator: SeedCreator;
  qrDisplay?: "default" | "large";
  compact?: boolean;
  hideCta?: boolean;
  /** Signup draft: full-card chrome + INFLR.me label, no profile CTA (user has not published yet). */
  draftPreview?: boolean;
}) {
  const entitlements: EntitlementLimits = draftPreview
    ? DRAFT_PREVIEW_ENTITLEMENTS
    : await entitlementsForPlan(creator.planTier);
  const short = await shortLinkPublicLabel(creator.slug).catch(() => null);
  const linkLabel = draftPreview
    ? `INFLR.me/${creator.slug.split("-")[0]}`
    : short ||
      (entitlements.shortlink
        ? `INFLR.me/${creator.slug.split("-")[0]}`
        : `influrios.com/c/${creator.slug}`);
  return (
    <InfluencerCardView
      creator={creator}
      entitlements={entitlements}
      qrDisplay={qrDisplay}
      compact={compact}
      hideCta={draftPreview || hideCta}
      linkLabel={linkLabel}
    />
  );
}
