import { InfluencerCardView } from "@/components/influencer-card-view";
import { PLAN_ENTITLEMENTS, type EntitlementLimits } from "@/lib/entitlements";
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
  /** Signup draft uses the same plan limits as publish and hides the profile CTA. */
  draftPreview?: boolean;
}) {
  const entitlements: EntitlementLimits = await entitlementsForPlan(creator.planTier).catch(
    () => PLAN_ENTITLEMENTS.STARTER,
  );
  const short = draftPreview ? null : await shortLinkPublicLabel(creator.slug).catch(() => null);
  const linkLabel =
    short ||
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
