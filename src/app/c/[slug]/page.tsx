import { notFound } from "next/navigation";
import { InfluencerCardView } from "@/components/influencer-card-view";
import { getCreatorBySlug } from "@/lib/seed-data";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const creator = getCreatorBySlug(slug);
  if (!creator) return { title: "Card not found" };
  return {
    title: `${creator.displayName} · Influencer Card`,
    description: `Influrios Card for ${creator.displayName}`,
  };
}

export default async function PublicCardPage({ params }: Props) {
  const { slug } = await params;
  const creator = getCreatorBySlug(slug);
  if (!creator) notFound();

  return (
    <div className="min-h-[80vh] bg-[radial-gradient(ellipse_at_top,_#EAE4FF,_#F7FAFF_55%,_#D9E8FF)] px-4 py-12">
      <InfluencerCardView creator={creator} qrDisplay="large" />
    </div>
  );
}
