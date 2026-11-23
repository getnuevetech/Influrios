import Link from "next/link";
import { redirect } from "next/navigation";
import { PrintButton } from "@/app/creator/media-kit/print/print-button";
import { getAccountSession } from "@/lib/accounts";
import { displayBio, mediaKitPhotos } from "@/lib/creator-home";
import { prisma } from "@/lib/db";
import { creatorCanonicalUrl } from "@/lib/creator-og";

export const dynamic = "force-dynamic";
export const metadata = { title: "Media kit (print)" };

const PLATFORM_LABEL: Record<string, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  X: "X",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
  PINTEREST: "Pinterest",
  WEBSITE: "Website",
};

const compact = (value: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);

/** One-page media kit from the influencer's own profile, laid out for "Save as PDF". */
export default async function MediaKitPrintPage() {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/creator/media-kit/print");
  const creator = await prisma.creator
    .findUnique({
      where: { userId: account.id },
      select: {
        slug: true,
        displayName: true,
        title: true,
        bio: true,
        avatarUrl: true,
        coverUrl: true,
        locationCity: true,
        locationState: true,
        locationCountry: true,
        socialAccounts: { select: { platform: true, handle: true, url: true, followers: true } },
        specialties: { select: { isPrimary: true, specialty: { select: { name: true } } } },
      },
    })
    .catch(() => null);
  if (!creator) redirect("/creator/media-kit");

  const photos = mediaKitPhotos(creator.avatarUrl, creator.coverUrl);
  const bio = displayBio(creator.bio);
  const location = [creator.locationCity, creator.locationState, creator.locationCountry].filter(Boolean).join(", ");
  const specialties = [...creator.specialties]
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map((row) => row.specialty.name);
  const socials = creator.socialAccounts.filter((row) => row.handle.trim());
  const reach = socials.reduce((sum, row) => sum + (row.followers ?? 0), 0);
  const cardUrl = creatorCanonicalUrl(creator.slug);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <style>{`
        @media print {
          @page { margin: 14mm; }
          body * { visibility: hidden !important; }
          #media-kit-sheet, #media-kit-sheet * { visibility: visible !important; }
          #media-kit-sheet { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0 !important; box-shadow: none !important; }
        }
      `}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/creator/media-kit" className="text-sm font-semibold text-violet hover:underline">
          ← Media kit
        </Link>
        <PrintButton />
      </div>
      <p className="text-xs text-muted print:hidden">In the print window, choose &ldquo;Save as PDF&rdquo; as the destination.</p>

      <article id="media-kit-sheet" className="space-y-6 rounded-3xl border border-[#E6ECF7] bg-white p-8 text-[#1B1464]">
        <header className="flex items-center gap-5">
          {photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photos[0]} alt="" className="h-24 w-24 rounded-full object-cover" />
          ) : null}
          <div>
            <h1 className="font-display text-3xl font-bold">{creator.displayName}</h1>
            {creator.title ? <p className="text-sm text-[#475467]">{creator.title}</p> : null}
            {location ? <p className="text-sm text-[#667085]">{location}</p> : null}
          </div>
        </header>

        {bio ? <p className="whitespace-pre-wrap text-sm leading-6 text-[#344054]">{bio}</p> : null}

        {socials.length > 0 ? (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-[#6D4AFF]">
              Audience{reach > 0 ? ` · ${compact(reach)} followers in total` : ""}
            </h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {socials.map((row) => (
                <li key={row.platform} className="rounded-xl border border-[#E6ECF7] px-3 py-2 text-sm">
                  <span className="font-semibold">{PLATFORM_LABEL[row.platform] ?? row.platform}</span>
                  <span className="text-[#667085]"> · @{row.handle.replace(/^@/, "")}</span>
                  {row.followers ? <span className="float-right font-semibold">{compact(row.followers)}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {specialties.length > 0 ? (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-[#6D4AFF]">Content focus</h2>
            <p className="mt-2 text-sm">{specialties.join(" · ")}</p>
          </section>
        ) : null}

        {photos.length > 1 ? (
          <section className="grid grid-cols-2 gap-3">
            {photos.slice(1, 5).map((src) => (
              <div key={src} className="aspect-[4/3] overflow-hidden rounded-2xl bg-[#EEF2FA]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </section>
        ) : null}

        <footer className="border-t border-[#E6ECF7] pt-4 text-sm">
          <p>
            Work with {creator.displayName} on Influrios: <span className="font-semibold">{cardUrl}</span>
          </p>
        </footer>
      </article>
    </div>
  );
}
