import Link from "next/link";
import { redirect } from "next/navigation";
import { Panel, StatusPill } from "@/components/dashboard-ui";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { displayBio, mediaKitPhotos } from "@/lib/creator-home";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Media kit" };

export default async function CreatorMediaKitPage() {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/creator/media-kit");

  const [creator, draft] = await Promise.all([
    prisma.creator
      .findUnique({
        where: { userId: account.id },
        select: {
          slug: true,
          displayName: true,
          avatarUrl: true,
          coverUrl: true,
          bio: true,
          title: true,
        },
      })
      .catch(() => null),
    getCreatorSessionDraft().catch(() => null),
  ]);

  const photos = mediaKitPhotos(creator?.avatarUrl || draft?.image, creator?.coverUrl || draft?.coverImage);
  const slug = creator?.slug || draft?.slug || "";
  const name = creator?.displayName || draft?.displayName || account.name || "Creator";
  const bio = displayBio(creator?.bio || draft?.bio);
  const published = photos.length > 0;
  const cardHref = slug ? `/c/${slug}` : "/claim";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/creator" className="text-sm font-semibold text-violet hover:underline">
          ← Creator account
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Media Kit</h1>
        <p className="mt-1 text-sm text-muted">
          {bio || "Share the photos you uploaded. Branded default avatars and banners are not listed here."}
        </p>
      </div>

      <Panel
        title={`${name}'s media kit`}
        action={<StatusPill tone={published ? "success" : "neutral"}>{published ? "Published" : "Not published"}</StatusPill>}
      >
        <p className="text-sm text-muted">
          {published
            ? "These are the photos stored on your card."
            : "Upload a profile photo. The branded default portrait is not a media kit."}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.length === 0 ? (
            <div className="col-span-2 flex aspect-square items-center justify-center rounded-2xl bg-[#EEF2FA] text-xs font-semibold text-muted sm:col-span-4">
              No uploaded photos yet
            </div>
          ) : (
            photos.map((src) => (
              <div key={src} className="aspect-square overflow-hidden rounded-2xl bg-[#EEF2FA]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </div>
            ))
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={cardHref} className="btn-primary !py-2 text-sm">
            View media kit
          </Link>
          <Link href="/dashboard" className="btn-secondary !py-2 text-sm">
            Edit profile photos
          </Link>
        </div>
      </Panel>
    </div>
  );
}
