import Link from "next/link";
import { redirect } from "next/navigation";
import { Panel, StatCard, StatusPill } from "@/components/dashboard-ui";
import { IconEye, IconShare, IconUsers, IconWallet, SocialIcon } from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { draftToSeedCreator, getCreatorSessionDraft } from "@/lib/claim";
import { loadCreatorHub } from "@/lib/collaboration-hub";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { classifySocialRow, earningsSummaryNote } from "@/lib/creator-home";
import { formatFollowers } from "@/lib/seed-data";
import { isLiveSocialAccount } from "@/lib/social-sync";
import { getCreatorShortLinkAnalytics } from "@/lib/short-link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

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

export default async function CreatorAnalyticsPage() {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/creator/analytics");

  const [creator, draft] = await Promise.all([
    prisma.creator
      .findUnique({
        where: { userId: account.id },
        include: {
          socialAccounts: { orderBy: { platform: "asc" } },
          socialConnections: { select: { platform: true, status: true, lastError: true } },
          shortLinks: { where: { status: { not: "archived" } }, take: 1, select: { id: true, slug: true, status: true } },
        },
      })
      .catch(() => null),
    getCreatorSessionDraft().catch(() => null),
  ]);

  if (!creator && !draft) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-bold">Analytics</h1>
        <p className="text-sm text-muted">Publish a creator card to see profile, link, and social analytics.</p>
        <Link href="/claim" className="btn-primary">
          Create your card
        </Link>
      </div>
    );
  }

  const seed = draft ? draftToSeedCreator(draft) : null;
  const hub =
    creator && seed
      ? await loadCreatorHub({ userId: account.id, creator: seed }).catch(() => null)
      : null;
  const shortLink = creator?.shortLinks[0] ?? null;
  const [spark, linkAnalytics, inquiries] = await Promise.all([
    visitSeries(shortLink?.id ?? null),
    creator?.slug ? getCreatorShortLinkAnalytics(creator.slug).catch(() => null) : Promise.resolve(null),
    creator?.slug
      ? prisma.businessInquiry.count({ where: { creatorSlug: creator.slug } }).catch(() => 0)
      : Promise.resolve(0),
  ]);

  const connectionByPlatform = new Map((creator?.socialConnections ?? []).map((row) => [row.platform, row]));
  const socials = (creator?.socialAccounts ?? []).map((social) => {
    const connection = connectionByPlatform.get(social.platform);
    return classifySocialRow({
      id: social.id,
      platform: social.platform,
      handle: social.handle,
      slug: creator?.slug ?? "",
      followers: social.followers,
      source: social.source,
      refreshedAt: social.refreshedAt,
      connectionStatus: connection?.status ?? null,
      lastError: connection?.lastError ?? null,
    });
  });
  const liveSocials = (creator?.socialAccounts ?? []).filter((row) =>
    isLiveSocialAccount({
      source: row.source,
      refreshedAt: row.refreshedAt,
      followers: row.followers,
    }),
  );
  const totalFollowers = liveSocials.reduce((sum, row) => sum + (row.followers ?? 0), 0);
  const analytics = linkAnalytics && linkAnalytics.ok ? linkAnalytics.analytics : null;
  const earningsCents = hub?.earnings.releasedCents ?? 0;
  const earningsCurrency = hub?.earnings.currency || "";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-sm text-muted">
          Profile visits, social reach, and collaboration activity for this influencer account. Totals come from stored
          events only — nothing is invented.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Profile / link visits"
          value={formatFollowers(analytics?.totalVisits ?? spark.reduce((a, b) => a + b, 0))}
          note={analytics ? `Plan analytics level: ${analytics.level}` : "Last 7 days of short-link events"}
          tone="blue"
          icon={<IconEye size={16} />}
          points={spark}
        />
        <StatCard
          label="Connected social reach"
          value={liveSocials.length ? formatFollowers(totalFollowers) : "—"}
          note={
            liveSocials.length
              ? `${liveSocials.length} synced platform${liveSocials.length === 1 ? "" : "s"}`
              : "Follower totals appear after a provider sync"
          }
          tone="violet"
          icon={<IconShare size={16} />}
        />
        <StatCard
          label="Active collaborations"
          value={String(hub?.status.active ?? 0)}
          note={`${inquiries} brand inquir${inquiries === 1 ? "y" : "ies"}`}
          tone="emerald"
          icon={<IconUsers size={16} />}
        />
        <StatCard
          label="Released earnings"
          value={earningsCurrency ? formatMoney(earningsCents, earningsCurrency) : "—"}
          note={earningsSummaryNote({
            failed: Boolean(creator) && !hub,
            currency: earningsCurrency,
            cents: earningsCents,
          })}
          tone="amber"
          icon={<IconWallet size={16} />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Link & card analytics"
          action={
            analytics ? (
              <StatusPill tone="success">{analytics.level}</StatusPill>
            ) : (
              <StatusPill tone="neutral">Not available</StatusPill>
            )
          }
        >
          {analytics ? (
            <>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Total visits</dt>
                  <dd className="font-display text-2xl font-bold">{analytics.totalVisits}</dd>
                </div>
                {analytics.qrScans != null ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">QR scans</dt>
                    <dd className="font-display text-2xl font-bold">{analytics.qrScans}</dd>
                  </div>
                ) : null}
                {analytics.directVisits != null ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">Direct visits</dt>
                    <dd className="font-display text-2xl font-bold">{analytics.directVisits}</dd>
                  </div>
                ) : null}
                {analytics.ctaClicks != null ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">CTA clicks</dt>
                    <dd className="font-display text-2xl font-bold">{analytics.ctaClicks}</dd>
                  </div>
                ) : null}
                {analytics.inquiryConversions != null ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">Inquiry conversions</dt>
                    <dd className="font-display text-2xl font-bold">{analytics.inquiryConversions}</dd>
                  </div>
                ) : null}
              </dl>
              {(analytics.deviceClasses || analytics.referrerClasses) && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
                  {analytics.deviceClasses ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Devices</p>
                      <ul className="mt-1 space-y-1">
                        {Object.entries(analytics.deviceClasses).map(([key, count]) => (
                          <li key={key}>
                            {key}: {count}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {analytics.referrerClasses ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Referrers</p>
                      <ul className="mt-1 space-y-1">
                        {Object.entries(analytics.referrerClasses).map(([key, count]) => (
                          <li key={key}>
                            {key}: {count}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">
              Link analytics appear after your card is published with an active short link on Plus or Pro.{" "}
              <Link href="/billing" className="font-semibold text-violet hover:underline">
                View plans
              </Link>
            </p>
          )}
        </Panel>

        <Panel title="Connected social profiles" action={<Link href="/dashboard#socials" className="text-xs font-semibold text-violet hover:underline">Manage</Link>}>
          {socials.length === 0 ? (
            <p className="text-sm text-muted">No social accounts are saved on this card yet.</p>
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
                        {social.handle ? social.handle : social.detail ? "" : "No @username saved"}
                        {typeof social.followers === "number" ? `${social.handle ? " · " : ""}${formatFollowers(social.followers)} followers` : ""}
                        {social.detail ? `${social.handle || typeof social.followers === "number" ? " · " : ""}${social.detail}` : ""}
                      </span>
                    </span>
                  </span>
                  <StatusPill tone={social.status === "connected" ? "success" : social.status === "attention" ? "warn" : "neutral"}>
                    {social.statusLabel}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      <Panel title="Collaboration activity">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Pipeline items</dt>
            <dd className="font-display text-2xl font-bold">{hub?.pipeline.length ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Brand matches</dt>
            <dd className="font-display text-2xl font-bold">{hub?.brandMatches.length ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Applications</dt>
            <dd className="font-display text-2xl font-bold">{hub?.applications.length ?? 0}</dd>
          </div>
        </dl>
        <Link href="/collaboration/hub?view=opportunities" className="mt-4 inline-flex text-sm font-semibold text-violet hover:underline">
          Open collaboration hub →
        </Link>
      </Panel>
    </div>
  );
}
