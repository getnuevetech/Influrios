import { notFound, redirect } from "next/navigation";
import { PublicProfileLayout } from "@/components/public-profile-layout";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { consumeGuestQuota, type GuestQuota } from "@/lib/guest-usage";
import { publicStoredImage, specialtyLabel } from "@/lib/seed-data";
import { getDirectoryCreator, recordDirectoryEvent } from "@/lib/directory";
import { profileNeedLines, profileOfferLines } from "@/lib/profile-notes";
import { creatorShareMetadata } from "@/lib/creator-og";
import { demoCreatorBySlug } from "@/lib/presentation-demo";
import { listMarketplaceApplications, listWorkspaceBusinessRequests } from "@/lib/marketplace-listings";
import { prisma } from "@/lib/db";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ invite?: string; card?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const creator = demoCreatorBySlug(slug) ?? (await getDirectoryCreator(slug));
  if (!creator) return { title: "Influencer not found" };
  return creatorShareMetadata(creator, { surface: "profile" });
}

export default async function CreatorProfilePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const preview = demoCreatorBySlug(slug);
  const creator = preview ?? (await getDirectoryCreator(slug));
  if (!creator) notFound();
  let gate: GuestQuota = { decision: "allow", copy: "", count: 0 };
  if (!preview) {
    gate = await consumeGuestQuota("profile");
    if (gate.decision === "hard") {
      redirect(`/login?next=${encodeURIComponent(`/creators/${slug}`)}&gate=profile`);
    }
    await recordDirectoryEvent("influencer_profile_viewed", { slug, surface: "profile" });
  }

  const account = await getAccountSession().catch(() => null);
  const ownedCreator = account
    ? await prisma.creator.findFirst({ where: { userId: account.id }, select: { slug: true } }).catch(() => null)
    : null;
  const isOwner = Boolean(ownedCreator?.slug === slug);
  const isBusiness = account?.role === "BUSINESS" || account?.role === "AGENCY";
  let requestsForInvite: { id: string; title: string }[] = [];
  let existingInviteStatus: string | null = null;
  if (account && isBusiness) {
    const workspace = await getWorkspace(account.id).catch(() => null);
    if (workspace) {
      const published = await listWorkspaceBusinessRequests(workspace.businessId).catch(() => []);
      requestsForInvite = published
        .filter((row) => row.status === "published")
        .map((row) => ({ id: row.id, title: row.brand || "Untitled request" }));
      const apps = await listMarketplaceApplications({
        businessRequestIds: published.map((row) => row.id),
        briefIds: workspace.briefs.map((brief) => brief.id),
        limit: 100,
      }).catch(() => []);
      const existing = apps.find(
        (row) => row.toSlug === slug && row.status !== "WITHDRAWN" && row.status !== "DECLINED" && row.status !== "EXPIRED",
      );
      existingInviteStatus = existing?.status ?? null;
    }
  }

  const content = (creator.featuredContent ?? []).flatMap((item) => {
    const image = preview ? item.image : publicStoredImage(item.image);
    return image ? [{ image, caption: item.category || "Work", title: item.category }] : [];
  });
  const offerLines = profileOfferLines(creator).map((row) => row.summary);
  const needLines = profileNeedLines(creator).map((row) => row.summary);
  const services = [...new Set([...offerLines, ...creator.specialties.map((item) => specialtyLabel(item))])];
  const interests = [...new Set(needLines)];

  return (
    <PublicProfileLayout
      creator={{
        ...creator,
        image: preview ? creator.image : publicStoredImage(creator.image) || creator.image,
        coverImage: preview
          ? creator.coverImage
          : creator.coverImage
            ? publicStoredImage(creator.coverImage) || creator.coverImage
            : creator.coverImage,
      }}
      specialties={creator.specialties}
      services={services}
      interests={interests}
      languages={creator.languages.map((language) => language.trim()).filter(Boolean)}
      socials={creator.socials.map((social) => ({
        platform: social.platform,
        url: social.url,
        handle: social.handle,
        followers: social.followers,
        source: "self",
      }))}
      portfolio={content}
      isOwner={isOwner}
      isBusiness={Boolean(isBusiness)}
      loggedIn={Boolean(account)}
      inviteOpen={query.invite === "1"}
      cardOpen={query.card === "1"}
      requestsForInvite={requestsForInvite}
      existingInviteStatus={existingInviteStatus}
      demo={Boolean(preview)}
      guestCopy={gate.decision === "soft" ? gate.copy : ""}
    />
  );
}
