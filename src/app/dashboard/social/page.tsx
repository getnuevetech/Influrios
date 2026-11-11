import { CreatorProfileShell, ProfileFlash } from "@/components/creator-profile/profile-shell";
import { SocialConnectionsPanel } from "@/components/creator-profile/social-panel";
import { loadCreatorProfileBundle } from "@/lib/creator-profile-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Social accounts" };

type Props = {
  searchParams: Promise<{ social?: string; error?: string; saved?: string }>;
};

export default async function ProfileSocialPage({ searchParams }: Props) {
  const params = await searchParams;
  const { draft, score, social, primaryNiche, kycVerified, planCode } = await loadCreatorProfileBundle();

  return (
    <CreatorProfileShell
      draft={draft}
      score={score}
      primaryNiche={primaryNiche}
      planLabel={planCode}
      kycVerified={kycVerified}
      flash={<ProfileFlash params={params} />}
    >
      <SocialConnectionsPanel social={social} manualRetry={Boolean(params.error)} />
    </CreatorProfileShell>
  );
}
