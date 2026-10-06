import { notFound } from "next/navigation";
import { PublicInfluencerCard } from "@/components/public-influencer-card";
import { creatorShareMetadata } from "@/lib/creator-og";
import { getDirectoryCreator, recordDirectoryEvent } from "@/lib/directory";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const creator = await getDirectoryCreator(slug);
  if (!creator) return { title: "Card not found" };
  return creatorShareMetadata(creator, { surface: "card" });
}

export default async function PublicCardPage({ params }: Props) {
  const { slug } = await params;
  const creator = await getDirectoryCreator(slug);
  if (!creator) notFound();
  await recordDirectoryEvent("influencer_profile_viewed", { slug, surface: "card" });

  return (
    <div className="min-h-[80vh] bg-[radial-gradient(ellipse_at_top,_#EAE4FF,_#F7FAFF_55%,_#D9E8FF)] px-4 py-12">
      <PublicInfluencerCard creator={creator} qrDisplay="large" />
    </div>
  );
}
