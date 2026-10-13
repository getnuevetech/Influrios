import Link from "next/link";
import { redirect } from "next/navigation";
import { ChecklistItem, Panel, StatCard, StatusPill, TextLink } from "@/components/dashboard-ui";
import {
  IconArrowRight,
  IconCamera,
  IconCopy,
  IconEye,
  IconLink,
  IconShare,
  IconUsers,
  IconVerified,
  IconWallet,
  SocialIcon,
} from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { completenessFor, draftToSeedCreator, getCreatorSessionDraft } from "@/lib/claim";
import { loadCreatorHub } from "@/lib/collaboration-hub";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatFollowers, specialtyLabel } from "@/lib/seed-data";
import { primaryShortHost } from "@/lib/short-link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creator account" };

async function visitSeries(shortLinkId: string | null) {
  if (!shortLinkId) return [0, 0, 0, 0, 0, 0, 0];
  const since = new Date(Date.now() - 7 * 86400000);
  const events = await prisma.shortLinkEvent
    .findMany({
      where: {
        shortLinkId,
        createdAt: { gte: since },
        eventType: { in: ["resolve", "qr_scan", "alias_redirect", "nfc_tap", "campaign_redirect"] },
      },
      select: { createdAt: true },
    })
    .catch(() => []);
  const buckets = Array.from({ length: 7 }, () => 0);
  for (const event of events) {
    const day = Math.min(6, Math.floor((Date.now() - event.createdAt.getTime()) / 86400000));
    buckets[6 - day] += 1;
  }
  return buckets;
}

export default async function CreatorHomePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; published?: string }>;
}) {
  const params = await searchParams;
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/creator");

  const [creator, draft, host] = await Promise.all([
    prisma.creator
      .findUnique({
        where: { userId: account.id },
        select: {
          id: true,
          slug: true,
          displayName: true,
          title: true,
          bio: true,
          avatarUrl: true,
          coverUrl: true,
          identityVerified: true,
          socialAccounts: { orderBy: { platform: "asc" } },
          specialties: { include: { specialty: { select: { name: true, slug: true } } } },
          payoutProfile: { select: { stripeConnectAccountId: true, providerConnectedAccountId: true } },
          shortLinks: { where: { status: { not: "archived" } }, take: 1, select: { id: true, slug: true } },
        },
      })
      .catch(() => null),
    getCreatorSessionDraft().catch(() => null),
    primaryShortHost().catch(() => "inflr.me"),
  ]);

  const shortLink = creator?.shortLinks[0] ?? null;
  const [visits, inquiries, spark] = creator
    ? await Promise.all([
        shortLink
          ? prisma.shortLinkEvent
              .count({
                where: {
                  shortLinkId: shortLink.id,
                  eventType: { in: ["resolve", "qr_scan", "alias_redirect", "nfc_tap", "campaign_redirect"] },
                },
              })
              .catch(() => 0)
          : Promise.resolve(0),
        prisma.businessInquiry.count({ where: { creatorSlug: creator.slug } }).catch(() => 0),
        visitSeries(shortLink?.id ?? null),
      ])
    : [0, 0, [0, 0, 0, 0, 0, 0, 0]];

  const seed = draft ? draftToSeedCreator(draft) : null;
  const hub =
    creator && seed
      ? await loadCreatorHub({ userId: account.id, creator: seed }).catch(() => null)
      : null;

  const completion = draft ? completenessFor(draft) : null;
  const incomplete = Boolean(completion && completion.score < 100);
  const doneCount = completion?.items.filter((item) => item.done).length ?? 0;
  const totalCount = completion?.items.length ?? 0;
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const payoutReady = Boolean(
    creator?.payoutProfile?.stripeConnectAccountId ||
      creator?.payoutProfile?.providerConnectedAccountId ||
      hub?.payout.readiness?.globalPayoutReady ||
      hub?.payout.readiness?.hasVerifiedMethod,
  );
  const identityDone = Boolean(
    hub?.payout.readiness?.identityVerified || creator?.identityVerified === "VERIFIED",
  );
  const earningsCents = hub?.earnings.releasedCents ?? 0;
  const earningsCurrency = hub?.earnings.currency || "USD";
  const activeCollabs = hub?.status.active ?? 0;
  const opportunityCount = Math.max(inquiries, hub?.brandMatches.length ?? 0);
  const displayName = creator?.displayName || draft?.displayName || account.name || "Creator";
  const firstName = (account.name || displayName).split(" ")[0];
  const slug = creator?.slug || draft?.slug || "";
  const bio = (creator?.bio || draft?.bio || "").trim();
  const title = (creator?.title || draft?.title || "").trim() || "Creator";
  const specialties =
    creator?.specialties.map((row) => row.specialty.name) ??
    (draft?.specialties.map((item) => specialtyLabel(item)) || []);
  const avatar = creator?.avatarUrl || draft?.image || null;
  const cover = creator?.coverUrl || draft?.coverImage || null;
  const socials = creator?.socialAccounts ?? [];
  const cardHref = slug ? `/c/${slug}` : "/claim";
  const profileHref = draft ? "/dashboard" : "/claim";
  const shortLabel = shortLink ? `${host}/${shortLink.slug}` : slug ? `${host}/${slug.split("-")[0]}` : `${host}/you`;
  const recentVisits = spark.slice(-3).reduce((sum, n) => sum + n, 0);
  const priorVisits = spark.slice(0, 4).reduce((sum, n) => sum + n, 0);
  const visitDelta =
    priorVisits > 0
      ? Math.round(((recentVisits - priorVisits) / priorVisits) * 100)
      : recentVisits > 0
        ? 100
        : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-indigo">Creator account</h1>
          <p className="mt-1 text-sm text-muted">
            Welcome back{firstName ? `, ${firstName}` : ""}! Here&apos;s what&apos;s happening with your creator journey.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold text-muted">{today}</p>
          <div className="rounded-2xl border border-[#E6ECF7] bg-white px-4 py-2 text-sm font-semibold text-indigo shadow-sm">
            Keep creating! More opportunities are waiting for you.
          </div>
        </div>
      </div>

      {params.published ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Your Starter card is live{slug ? <> at <Link href={cardHref} className="font-semibold underline">/c/{slug}</Link></> : null}.
        </div>
      ) : null}

      {incomplete ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div>
            <p className="font-semibold">Complete your profile ({completion?.score ?? 0}%)</p>
            <p className="text-amber-900/80">
              {params.welcome
                ? "Your account is ready. Finish the remaining profile steps so brands can find you."
                : "A few profile details are still missing."}
            </p>
          </div>
          <Link href={profileHref} className="btn-primary !py-2 text-sm">
            Edit profile
          </Link>
        </div>
      ) : null}

      {!creator && !draft ? (
        <section className="rounded-3xl border border-[#E6ECF7] bg-white p-6">
          <h2 className="font-display text-xl font-bold">Create your influencer card</h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Your email is verified and this account is active. Start a card whenever you are ready.
          </p>
          <Link href="/claim" className="btn-primary mt-4">
            Get started free
          </Link>
        </section>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(17rem,0.75fr)]">
            <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start gap-5">
                <div className="relative">
                  <span className="inline-flex h-24 w-24 overflow-hidden rounded-full bg-[#EDE7FF] text-2xl font-bold text-violet ring-4 ring-[#F5F7FB]">
                    {avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">{displayName.slice(0, 1)}</span>
                    )}
                  </span>
                  <Link
                    href="/dashboard"
                    className="absolute bottom-0 right-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white bg-violet text-white shadow"
                  >
                    <IconCamera size={14} />
                  </Link>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl font-bold">{displayName}</h2>
                    {creator?.identityVerified === "VERIFIED" ? <IconVerified size={18} /> : null}
                  </div>
                  {slug ? <p className="text-sm text-muted">@{slug}</p> : null}
                  <p className="mt-2 max-w-2xl text-sm text-indigo/80">
                    {bio && !bio.includes("Draft Influencer")
                      ? bio
                      : "Add a short bio so brands know what you create."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {specialties.length ? (
                      specialties.slice(0, 6).map((name) => (
                        <span
                          key={name}
                          className="rounded-full bg-[#E8F0FF] px-2.5 py-1 text-xs font-semibold text-[#2F5FD0]"
                        >
                          {name}
                        </span>
                      ))
                    ) : (
                      <Link href="/dashboard" className="rounded-full border border-dashed border-[#C9D3EA] px-2.5 py-1 text-xs font-semibold text-muted">
                        + Add niche tags
                      </Link>
                    )}
                  </div>

                  {completion ? (
                    <div className="mt-5 max-w-md rounded-2xl bg-[#F7F8FC] p-3">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>Profile completion</span>
                        <span>{completion.score}%</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white">
                        <div className="h-2 rounded-full bg-violet" style={{ width: `${completion.score}%` }} />
                      </div>
                      <Link href={profileHref} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-violet">
                        Complete your profile to unlock more brand opportunities
                        <IconArrowRight size={12} />
                      </Link>
                    </div>
                  ) : null}
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-48">
                  <Link href={profileHref} className="btn-primary !py-2.5 text-center text-sm">
                    Edit profile
                  </Link>
                  <Link href={cardHref} className="btn-secondary !py-2.5 text-center text-sm">
                    <span className="inline-flex items-center justify-center gap-2">
                      <IconLink size={14} /> Share Influrios Card
                    </span>
                  </Link>
                  <Link href="/dashboard#socials" className="btn-secondary !py-2.5 text-center text-sm">
                    <span className="inline-flex items-center justify-center gap-2">
                      <IconShare size={14} /> Connect socials
                    </span>
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">My INFLR.me Card</h2>
                <Link href={cardHref} className="text-muted hover:text-violet">
                  <IconArrowRight size={16} />
                </Link>
              </div>
              <div className="overflow-hidden rounded-2xl border border-[#E6ECF7] bg-gradient-to-br from-[#F7F4FF] to-white p-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-12 w-12 overflow-hidden rounded-full bg-[#EDE7FF]">
                    {avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center font-bold text-violet">
                        {displayName.slice(0, 1)}
                      </span>
                    )}
                  </span>
                  <div>
                    <p className="font-semibold">{displayName}</p>
                    <p className="text-xs text-muted">{title}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 text-violet">
                  {(socials.length ? socials : [{ platform: "INSTAGRAM" }, { platform: "TIKTOK" }, { platform: "YOUTUBE" }]).slice(0, 4).map((social) => (
                    <span key={social.platform} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white">
                      <SocialIcon platform={social.platform} size={14} />
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs font-semibold text-indigo">
                  <span className="truncate">{shortLabel}</span>
                  <IconCopy size={14} className="shrink-0 text-muted" />
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Profile views"
              value={formatFollowers(visits)}
              note="Short link, QR, and NFC visits · last 7 days trend"
              tone="blue"
              icon={<IconEye size={16} />}
              points={spark}
              delta={
                visitDelta === null
                  ? undefined
                  : { label: `${visitDelta >= 0 ? "↑" : "↓"} ${Math.abs(visitDelta)}%`, positive: visitDelta >= 0 }
              }
            />
            <StatCard
              label="Opportunity invites"
              value={String(opportunityCount)}
              note="Inquiries and scored brand requests"
              tone="violet"
              icon={<IconShare size={16} />}
              points={spark.map((n) => Math.max(opportunityCount, n > 0 ? opportunityCount : 0))}
            />
            <StatCard
              label="Active collaborations"
              value={String(activeCollabs)}
              note="Accepted collaboration records"
              tone="emerald"
              icon={<IconUsers size={16} />}
              points={Array.from({ length: 7 }, () => activeCollabs)}
            />
            <StatCard
              label="Earnings this month"
              value={formatMoney(earningsCents, earningsCurrency)}
              note="Released ledger totals — not estimates"
              tone="amber"
              icon={<IconWallet size={16} />}
              points={Array.from({ length: 7 }, (_, i) => Math.round((earningsCents * (i + 1)) / 7))}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <Panel title="Connected social profiles" action={<TextLink href="/dashboard#socials">Manage</TextLink>}>
              {socials.length === 0 ? (
                <p className="text-sm text-muted">No social profile is saved on this card yet.</p>
              ) : (
                <ul className="space-y-3">
                  {socials.map((social) => (
                    <li key={social.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#F0F3FA] px-3 py-2.5">
                      <span className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#F1ECFF] text-violet">
                          <SocialIcon platform={social.platform} size={16} />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold capitalize">{social.platform.toLowerCase()}</span>
                          <span className="text-xs text-muted">
                            {social.handle}
                            {typeof social.followers === "number" ? ` · ${formatFollowers(social.followers)} followers` : ""}
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Connected
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Media kit"
              action={<StatusPill tone={avatar ? "success" : "neutral"}>{avatar ? "Published" : "Not published"}</StatusPill>}
            >
              <p className="text-sm text-muted">
                {avatar
                  ? "Your media kit is live and ready to share with brands."
                  : "Upload profile photos to build a shareable media kit preview."}
              </p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[avatar, cover, avatar, cover].map((src, index) => (
                  <div key={index} className="aspect-square overflow-hidden rounded-xl bg-[#EEF2FA]">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    ) : index === 3 ? (
                      <div className="flex h-full items-center justify-center text-xs font-bold text-muted">+3</div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={cardHref} className="btn-secondary !py-2 text-sm">
                  View media kit
                </Link>
                <Link href="/creator/media-kit" className="btn-secondary !py-2 text-sm">
                  Edit media kit
                </Link>
              </div>
            </Panel>

            <Panel
              title="Payout status"
              action={<StatusPill tone={payoutReady ? "success" : "neutral"}>{payoutReady ? "Payout ready" : "Not set up"}</StatusPill>}
            >
              <p className="text-sm text-muted">
                {payoutReady ? "You're all set to receive brand payments." : "Add a payout method before collaborations can pay this card."}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <ChecklistItem done={identityDone} label="Identity verified" href="/dashboard/kyc" />
                <ChecklistItem done={payoutReady} label="Payout method added" href="/billing#payouts" />
                <ChecklistItem done={payoutReady} label="Ready to receive payments" href="/billing#payouts" />
              </ul>
              <Link href="/billing#payouts" className="btn-secondary mt-4 !py-2 text-sm">
                Manage payout methods
              </Link>
            </Panel>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Panel title="Recent opportunities" action={<TextLink href="/collaboration/hub?view=opportunities">View all</TextLink>}>
              {(hub?.brandMatches.length ?? 0) === 0 ? (
                <p className="text-sm text-muted">No published brand requests are matched to this card yet.</p>
              ) : (
                <ul className="space-y-3">
                  {hub!.brandMatches.slice(0, 4).map(({ request, score }, index) => (
                    <li key={request.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#F0F3FA] px-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{request.brand}</p>
                        <p className="truncate text-xs text-muted">{request.lookingFor || request.category}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {request.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="rounded-full bg-[#EEF2FA] px-2 py-0.5 text-[10px] font-semibold text-muted">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-indigo">{request.budget || "—"}</p>
                        <StatusPill tone={index === 0 ? "success" : "violet"}>{index === 0 ? "New" : `Score ${score}`}</StatusPill>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Active collaborations" action={<TextLink href="/collaboration/hub?view=collaborations">View all</TextLink>}>
              {(hub?.pipeline.length ?? 0) === 0 ? (
                <p className="text-sm text-muted">No active collaboration pipeline items yet.</p>
              ) : (
                <ul className="space-y-3">
                  {hub!.pipeline.slice(0, 4).map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#F0F3FA] px-3 py-3">
                      <div>
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="text-xs text-muted">{item.counterparty}</p>
                      </div>
                      <StatusPill
                        tone={
                          item.stage === "In Progress"
                            ? "success"
                            : item.stage === "Review"
                              ? "violet"
                              : "info"
                        }
                      >
                        {item.stage}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Account setup checklist">
              {completion ? (
                <>
                  <p className="text-xs font-semibold text-muted">
                    {doneCount} of {totalCount} complete
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-[#EEF2FA]">
                    <div
                      className="h-2 rounded-full bg-violet"
                      style={{ width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%` }}
                    />
                  </div>
                  <ul className="mt-3 space-y-1">
                    {completion.items.map((item) => (
                      <ChecklistItem
                        key={item.id}
                        done={item.done}
                        label={item.label}
                        href={item.id === "published" ? (draft ? `/claim/publish/${draft.id}` : "/claim") : "/dashboard"}
                      />
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted">The checklist appears with the creator profile.</p>
              )}
            </Panel>
          </section>
        </>
      )}
    </div>
  );
}
