import Link from "next/link";
import { Chip } from "@/components/creator-profile/summary-card";
import { LinksManagementPanel } from "@/components/creator-profile/links-panel";
import { CreatorProfileShell, ProfileFlash } from "@/components/creator-profile/profile-shell";
import { loadCreatorProfileBundle } from "@/lib/creator-profile-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Links & payments" };

type Props = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    confirmSlug?: string;
    published?: string;
  }>;
};

export default async function ProfileLinksPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await loadCreatorProfileBundle();
  const {
    draft,
    score,
    shortLink,
    shortHost,
    linkLimits,
    slugHistory,
    referrals,
    destinationHistory,
    pendingSchedules,
    campaignLinks,
    campaignMax,
    campaignRoom,
    linkAnalytics,
    fundings,
    primaryNiche,
    kycVerified,
    planCode,
  } = data;

  const paymentLabel = !fundings.length
    ? "Not configured"
    : fundings.some((f) => f.status === "awaiting_provider" || f.status === "held")
      ? "Action required"
      : "Ready";

  return (
    <CreatorProfileShell
      draft={draft}
      score={score}
      primaryNiche={primaryNiche}
      planLabel={planCode}
      kycVerified={kycVerified}
      flash={<ProfileFlash params={params} />}
    >
      <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5 shadow-[0_8px_24px_rgba(17,26,90,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-indigo">Protected payments</h2>
            <p className="mt-1 text-sm text-muted">
              Profile only tracks readiness. Manage payouts and escrow in their dedicated areas.
            </p>
          </div>
          <Chip
            tone={
              paymentLabel === "Ready" ? "emerald" : paymentLabel === "Action required" ? "blue" : "muted"
            }
          >
            {paymentLabel}
          </Chip>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/creator/earnings" className="btn-primary !py-2 text-sm">
            Open earnings →
          </Link>
          <Link href="/payments" className="btn-secondary !py-2 text-sm">
            Protected payments
          </Link>
        </div>
      </section>

      <LinksManagementPanel
        draft={draft}
        shortLink={shortLink}
        shortHost={shortHost}
        linkLimits={linkLimits}
        slugHistory={slugHistory}
        referrals={referrals}
        destinationHistory={destinationHistory}
        pendingSchedules={pendingSchedules}
        campaignLinks={campaignLinks}
        campaignMax={campaignMax}
        campaignRoom={campaignRoom}
        linkAnalytics={linkAnalytics}
        confirmSlug={params.confirmSlug}
      />
    </CreatorProfileShell>
  );
}
