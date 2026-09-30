import { InfluencerCardView } from "@/components/influencer-card-view";
import { entitlementsForPlan } from "@/lib/entitlements-db";
import { shortLinkPublicLabel } from "@/lib/short-link";
import type { SeedCreator } from "@/lib/seed-data";

/** Server wrapper: resolves plan limits from the database before rendering the card. */
export async function PublicInfluencerCard({
  creator,
  qrDisplay = "default",
  compact = false,
  hideCta = false,
}: {
  creator: SeedCreator;
  qrDisplay?: "default" | "large";
  compact?: boolean;
  hideCta?: boolean;
}) {
  const entitlements = await entitlementsForPlan(creator.planTier);
  const linkLabel = await shortLinkPublicLabel(creator.slug).catch(() => null);
  return (
    <InfluencerCardView
      creator={creator}
      entitlements={entitlements}
      qrDisplay={qrDisplay}
      compact={compact}
      hideCta={hideCta}
      linkLabel={linkLabel}
    />
  );
}
