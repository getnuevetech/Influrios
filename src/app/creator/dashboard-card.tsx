import Link from "next/link";
import { CopyTextButton } from "@/components/copy-text-button";
import { PublicInfluencerCard } from "@/components/public-influencer-card";
import { WalletButtons } from "@/components/wallet-buttons";
import { draftToSeedCreator, getCreatorSessionDraft } from "@/lib/claim";
import { loadPublicCreator } from "@/lib/directory";

/** The signed-in member's Influencer Card in the dashboard column, with the public inquiry action omitted. */
export async function DashboardInfluencerCard({
  slug,
  cardHref,
  shareUrl,
  identityVerified,
}: {
  slug: string;
  cardHref: string;
  shareUrl: string;
  identityVerified: boolean;
}) {
  const published = slug ? await loadPublicCreator(slug).catch(() => null) : null;
  let creator = published;
  if (!creator && slug) {
    const draft = await getCreatorSessionDraft().catch(() => null);
    if (draft?.slug === slug) {
      const seeded = draftToSeedCreator(draft);
      creator = identityVerified ? { ...seeded, verified: true } : seeded;
    }
  }

  return (
    <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-4 shadow-sm">
      <h2 className="font-display text-lg font-bold text-[#1B1464]">Influencer Card</h2>
      {creator ? (
        <div className="mt-3">
          <PublicInfluencerCard creator={creator} qrDisplay="large" compact hideCta />
        </div>
      ) : (
        <p className="mt-3 text-sm text-[#667085]">Create your card to get a share link. The full portrait stays on its own page.</p>
      )}
      <div className="mt-3 flex gap-2">
        {shareUrl ? <CopyTextButton value={shareUrl} /> : null}
        {creator ? null : (
          <Link href={cardHref} className="inline-flex flex-1 items-center justify-center rounded-full bg-[#6D4AFF] px-3 py-2 text-sm font-semibold text-white">
            Create card
          </Link>
        )}
      </div>
      {published ? <WalletButtons slug={published.slug} className="mt-2" /> : null}
    </section>
  );
}
