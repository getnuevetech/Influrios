import Link from "next/link";
import { BusinessMarketingPage } from "@/components/business-marketing";
import { getAccountSession } from "@/lib/accounts";
import { getDirectory } from "@/lib/directory";
import { getBusinessLanding } from "@/lib/landing-pages";
import { formatFollowers, specialtyLabel } from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "For Businesses · Influrios",
  description:
    "Find the right influencers, get AI-powered suggestions, and run protected collaborations on Influrios.",
};

export default async function BusinessPage() {
  const [account, directory, landing] = await Promise.all([
    getAccountSession().catch(() => null),
    getDirectory().catch(() => null),
    getBusinessLanding(),
  ]);
  const recommended = (directory?.creators ?? []).slice(0, 4).map((creator) => ({
    slug: creator.slug,
    displayName: creator.displayName,
    title: creator.title,
    image: creator.image,
    locationCity: creator.locationCity,
    locationCountry: creator.locationCountry,
    specialty: specialtyLabel(creator.specialties[0] ?? "lifestyle"),
    specialtySlug: creator.specialties[0] ?? "lifestyle",
    followers: formatFollowers(creator.socials.reduce((sum, social) => sum + social.followers, 0)),
    engagement: creator.stats?.engagementRate ?? "—",
    why: `Strong specialty fit for ${specialtyLabel(creator.specialties[0] ?? "lifestyle").toLowerCase()} campaigns and audience-aligned collaborations.`,
    platforms: creator.socials.map((social) => social.platform),
  }));

  return (
    <>
      {account ? (
        <div className="border-b border-[#E4EBFF] bg-[#EAE4FF]">
          <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
            <p className="text-sm font-medium text-indigo">
              You are signed in — open your Business Collaboration Hub to manage campaigns.
            </p>
            <Link href="/business/home" className="btn-primary !px-4 !py-2 text-sm">
              Open business account →
            </Link>
          </div>
        </div>
      ) : null}
      <BusinessMarketingPage landing={landing} recommended={recommended} />
    </>
  );
}
