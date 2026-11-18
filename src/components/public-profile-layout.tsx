import Image from "next/image";
import Link from "next/link";
import { AccountDialog } from "@/components/account-dialog";
import { PublicInfluencerCard } from "@/components/public-influencer-card";
import { IconMapPin, IconShare, SocialIcon } from "@/components/icons";
import { actionInviteCreatorToRequest } from "@/app/collaboration/business/actions";
import { formatFollowers, specialtyLabel, type SeedCreator } from "@/lib/seed-data";
import { metricFreshnessLabel, visibleFollowerCount } from "@/lib/profile-notes";
import { directoryLabels, profilePlace } from "@/lib/directory";

type Social = {
  platform: string;
  url: string;
  handle?: string;
  followers?: number | null;
  source?: string | null;
};

type PortfolioItem = { image: string; caption?: string; title?: string };

export function PublicProfileLayout(props: {
  creator: SeedCreator;
  specialties: string[];
  services: string[];
  interests: string[];
  languages: string[];
  socials: Social[];
  portfolio: PortfolioItem[];
  isOwner: boolean;
  isBusiness: boolean;
  loggedIn: boolean;
  inviteOpen: boolean;
  cardOpen: boolean;
  requestsForInvite: { id: string; title: string }[];
  existingInviteStatus?: string | null;
  demo?: boolean;
  guestCopy?: string;
}) {
  const slug = props.creator.slug;
  const displayName = props.creator.displayName;
  const title = props.creator.title;
  const bio = props.creator.bio.trim();
  const image = props.creator.image;
  const coverImage = props.creator.coverImage;
  const place = profilePlace(props.creator.locationCity, props.creator.locationCountry);
  const partnership = directoryLabels(Boolean(props.creator.openToCollab)).statusLabel;
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const services = [...new Set(props.services.map((item) => item.trim()).filter(Boolean))];
  const specialties = [...new Set(props.specialties.map((slug) => specialtyLabel(slug)))];
  const closeProfile = `/creators/${slug}`;
  const firstName = displayName.split(/\s+/)[0] || displayName;

  return (
    <div className="bg-[#F5F8FF] pb-24 md:pb-10">
      {props.demo ? (
        <p className="bg-[#EAE4FF] px-4 py-2 text-center text-sm font-semibold text-indigo">
          Demo profile. This card is a preview and is not a live influencer.
        </p>
      ) : null}
      {props.guestCopy ? (
        <p className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">{props.guestCopy}</p>
      ) : null}

      <div className="relative h-36 overflow-hidden sm:h-44">
        {coverImage || image ? (
          <Image src={coverImage || image} alt="" fill className="object-cover" priority sizes="100vw" />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-[#EDE7FF] via-[#F5F8FF] to-[#E8F0FF]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#F5F8FF] via-transparent to-transparent" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="-mt-12 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div>
            <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5 shadow-[0_12px_40px_rgba(17,26,90,0.06)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="relative mx-auto h-24 w-24 shrink-0 overflow-hidden rounded-full bg-[#EDE7FF] ring-4 ring-white sm:mx-0 sm:h-28 sm:w-28">
                  {image ? (
                    <Image src={image} alt={displayName} fill className="object-cover" sizes="112px" />
                  ) : null}
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-[#6D4AFF]">{initials}</span>
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <h1 className="font-display text-3xl font-bold text-[#1B1464]">{displayName}</h1>
                  {title ? <p className="mt-1 text-sm font-medium text-[#4E5872]">{title}</p> : null}
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    {place ? (
                      <span className="inline-flex items-center gap-1 text-xs text-[#667085]">
                        <IconMapPin size={12} /> {place}
                      </span>
                    ) : null}
                    {partnership ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">{partnership}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {props.isOwner ? (
                  <Link href="/creator/profile" className="inline-flex h-11 items-center rounded-full bg-[#6D4AFF] px-5 text-sm font-bold text-white">
                    Edit profile
                  </Link>
                ) : props.loggedIn && props.isBusiness ? (
                  <Link
                    href={`${closeProfile}?invite=1`}
                    scroll={false}
                    className="inline-flex h-11 items-center rounded-full bg-[#6D4AFF] px-5 text-sm font-bold text-white"
                  >
                    Invite to collaborate
                  </Link>
                ) : (
                  <Link
                    href={`/login?next=${encodeURIComponent(`${closeProfile}?invite=1`)}`}
                    className="inline-flex h-11 items-center rounded-full bg-[#6D4AFF] px-5 text-sm font-bold text-white"
                  >
                    Invite to collaborate
                  </Link>
                )}
                <Link
                  href={`${closeProfile}?card=1`}
                  scroll={false}
                  className="inline-flex h-11 items-center rounded-full border border-[#E6ECF7] px-4 text-sm font-bold text-[#1B1464]"
                >
                  View influencer card
                </Link>
                <Link
                  href={`/c/${slug}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E6ECF7] text-[#1B1464]"
                  aria-label="Share profile"
                >
                  <IconShare size={16} />
                </Link>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {props.socials.length === 0 ? (
                  <p className="col-span-full text-sm text-[#667085]">Social metrics unavailable.</p>
                ) : (
                  props.socials.map((social) => {
                    const count = visibleFollowerCount({
                      followers: Number(social.followers ?? 0),
                      refreshedAt: null,
                    });
                    const unavailable = social.followers == null;
                    return (
                      <a
                        key={social.platform}
                        href={social.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-[#E6ECF7] bg-[#F8FAFC] px-3 py-3"
                      >
                        <div className="flex items-center gap-2">
                          <SocialIcon platform={social.platform} size={14} className="text-indigo" />
                          <span className="text-xs font-semibold text-[#667085]">{social.platform}</span>
                        </div>
                        <p className="mt-2 font-display text-xl font-bold text-[#1B1464]">
                          {unavailable ? "—" : typeof count === "number" ? formatFollowers(count) : count}
                        </p>
                        <p className="text-[11px] text-[#667085]">
                          {unavailable ? "Data unavailable" : social.source === "connected" ? "Connected" : "Self-reported"}
                        </p>
                        {metricFreshnessLabel(social) ? (
                          <p className="text-[10px] text-[#98A2B3]">{metricFreshnessLabel(social)}</p>
                        ) : null}
                      </a>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-[#E6ECF7] bg-white p-5">
              <div className="flex gap-4 border-b border-[#EEF2F7] text-sm font-semibold">
                <span className="border-b-2 border-[#6D4AFF] pb-2 text-[#6D4AFF]">Overview</span>
                {props.portfolio.length ? <span className="pb-2 text-[#667085]">Portfolio</span> : null}
                {services.length || specialties.length ? <span className="pb-2 text-[#667085]">Services</span> : null}
              </div>
              {bio ? (
                <div className="mt-4">
                  <h2 className="text-sm font-bold text-[#1B1464]">About</h2>
                  <p className="mt-1 text-sm leading-relaxed text-[#4E5872]">{bio}</p>
                </div>
              ) : null}
              {(services.length > 0 || specialties.length > 0) ? (
                <div className="mt-4">
                  <h2 className="text-sm font-bold text-[#1B1464]">Services</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[...services, ...specialties.filter((item) => !services.includes(item))].map((label) => (
                      <span key={label} className="rounded-full bg-[#F1ECFF] px-3 py-1 text-xs font-semibold text-[#6D4AFF]">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {props.portfolio.length > 0 ? (
                <div className="mt-5">
                  <h2 className="text-sm font-bold text-[#1B1464]">Portfolio</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {props.portfolio.slice(0, 6).map((item) => (
                      <div key={`${item.image}-${item.caption || item.title}`} className="overflow-hidden rounded-2xl border border-[#E6ECF7]">
                        <div className="relative aspect-[4/3] bg-[#EDE7FF]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.image} alt={item.caption || item.title || ""} className="h-full w-full object-cover" />
                        </div>
                        <p className="px-3 py-2 text-xs font-semibold text-[#1B1464]">{item.caption || item.title || "Work"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <aside className="space-y-4">
            {props.interests.length ? (
              <div className="rounded-3xl border border-[#E6ECF7] bg-white p-4">
                <h2 className="text-sm font-bold text-[#1B1464]">Collaboration interests</h2>
                <ul className="mt-2 space-y-1 text-sm text-[#4E5872]">
                  {props.interests.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {props.languages.length ? (
              <div className="rounded-3xl border border-[#E6ECF7] bg-white p-4">
                <h2 className="text-sm font-bold text-[#1B1464]">Languages</h2>
                <p className="mt-2 text-sm text-[#4E5872]">{props.languages.join(", ")}</p>
              </div>
            ) : null}
            <div className="overflow-hidden rounded-3xl border border-[#E6ECF7] bg-white">
              <div className="border-b border-[#EEF2F7] px-4 py-3">
                <h2 className="text-sm font-bold text-[#1B1464]">Influencer card</h2>
              </div>
              <div className="p-3">
                <PublicInfluencerCard creator={props.creator} compact />
              </div>
              <div className="flex gap-2 border-t border-[#EEF2F7] px-4 py-3">
                <Link href={`${closeProfile}?card=1`} scroll={false} className="flex-1 rounded-full bg-[#6D4AFF] px-3 py-2 text-center text-xs font-bold text-white">
                  Enlarge
                </Link>
                <Link href={`/c/${slug}`} className="flex-1 rounded-full border border-[#E6ECF7] px-3 py-2 text-center text-xs font-bold text-indigo">
                  Share
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E6ECF7] bg-white/95 p-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          {props.isOwner ? (
            <Link href="/creator/profile" className="flex-1 rounded-full bg-[#6D4AFF] py-3 text-center text-sm font-bold text-white">Edit profile</Link>
          ) : (
            <Link
              href={props.loggedIn && props.isBusiness ? `${closeProfile}?invite=1` : `/login?next=${encodeURIComponent(`${closeProfile}?invite=1`)}`}
              scroll={false}
              className="flex-1 rounded-full bg-[#6D4AFF] py-3 text-center text-sm font-bold text-white"
            >
              Invite to collaborate
            </Link>
          )}
          <Link href={`${closeProfile}?card=1`} scroll={false} className="rounded-full border border-[#E6ECF7] px-4 py-3 text-sm font-bold text-indigo">
            View card
          </Link>
        </div>
      </div>

      {props.inviteOpen && props.isBusiness && !props.isOwner ? (
        <AccountDialog title={`Invite ${firstName} to collaborate`} closeHref={closeProfile}>
          {props.existingInviteStatus ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              An invitation already exists ({props.existingInviteStatus.replaceAll("_", " ")}). Duplicate sending is blocked.
            </p>
          ) : props.requestsForInvite.length === 0 ? (
            <div className="space-y-3 text-sm">
              <p className="text-[#4E5872]">Create an open request to invite this influencer.</p>
              <Link
                href={`/collaboration/business/request/new?creator=${encodeURIComponent(slug)}`}
                className="inline-flex rounded-full bg-[#6D4AFF] px-4 py-2 font-bold text-white"
              >
                + Create a request
              </Link>
            </div>
          ) : (
            <form action={actionInviteCreatorToRequest} className="space-y-4 text-sm">
              <input type="hidden" name="creatorSlug" value={slug} />
              <input type="hidden" name="next" value={closeProfile} />
              <label className="block">
                <span className="text-xs font-semibold text-[#667085]">Choose an open request</span>
                <select name="requestId" required className="mt-1 w-full rounded-xl border border-[#E6ECF7] px-3 py-2">
                  {props.requestsForInvite.map((request) => (
                    <option key={request.id} value={request.id}>{request.title}</option>
                  ))}
                </select>
              </label>
              <Link
                href={`/collaboration/business/request/new?creator=${encodeURIComponent(slug)}`}
                className="inline-block text-sm font-bold text-[#6D4AFF]"
              >
                + Create a request
              </Link>
              <label className="block">
                <span className="text-xs font-semibold text-[#667085]">Personal message (optional)</span>
                <textarea name="note" rows={3} placeholder="Write a short message about this collaboration..." className="mt-1 w-full rounded-xl border border-[#E6ECF7] px-3 py-2" />
              </label>
              <p className="text-xs text-[#667085]">Only this influencer receives this invitation.</p>
              <div className="flex flex-wrap gap-3">
                <Link href={closeProfile} scroll={false} className="rounded-full border border-[#E6ECF7] px-4 py-2 font-bold text-indigo">Cancel</Link>
                <button type="submit" className="rounded-full bg-[#6D4AFF] px-4 py-2 font-bold text-white">Send invitation</button>
              </div>
            </form>
          )}
        </AccountDialog>
      ) : null}

      {props.cardOpen ? (
        <AccountDialog title="Influencer card" closeHref={closeProfile} wide>
          <PublicInfluencerCard creator={props.creator} />
        </AccountDialog>
      ) : null}
    </div>
  );
}
