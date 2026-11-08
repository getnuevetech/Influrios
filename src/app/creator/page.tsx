import Link from "next/link";
import { redirect } from "next/navigation";
import { ChecklistItem, Panel, StatCard, StatusPill, TextLink } from "@/components/dashboard-ui";
import { PublicInfluencerCard } from "@/components/public-influencer-card";
import {
  IconArrowRight,
  IconCamera,
  IconEye,
  IconLink,
  IconShare,
  IconUsers,
  IconVerified,
  IconWallet,
  SocialIcon,
} from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { draftToSeedCreator, getCreatorSessionDraft } from "@/lib/claim";
import { getDirectoryCreator } from "@/lib/directory";
import { contractNeedsSignature, contractPartyProgress, loadCreatorHome } from "@/lib/creator-home";
import { formatMoney } from "@/lib/money";
import { formatFollowers } from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creator account" };

function moneyLabel(cents: number, currency: string) {
  if (!currency) return "—";
  return formatMoney(cents, currency);
}

export default async function CreatorHomePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; published?: string }>;
}) {
  const params = await searchParams;
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/creator");
  const home = await loadCreatorHome(account.id);
  const directoryCreator = home.slug ? await getDirectoryCreator(home.slug).catch(() => null) : null;
  const draft = directoryCreator ? null : await getCreatorSessionDraft().catch(() => null);
  const cardCreator = directoryCreator ?? (draft ? draftToSeedCreator(draft) : null);
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const hasProfile = home.hasCard;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-indigo">Creator account</h1>
          <p className="mt-1 text-sm text-muted">
            Welcome back{home.firstName ? `, ${home.firstName}` : ""}. Figures on this page come from your card, inquiries, and ledger.
          </p>
        </div>
        <p className="text-xs font-semibold text-muted">{today}</p>
      </div>

      {home.contracts.length > 0 ? (
        <Panel title="Contracts" action={<TextLink href="/collaboration/contracts">View all →</TextLink>}>
          <ul className="space-y-2 text-sm">
            {home.contracts.slice(0, 5).map((contract) => {
              const needsSign = contractNeedsSignature(contract, account.id, account.email);
              const progress = contractPartyProgress(contract.parties);
              return (
                <li key={contract.id}>
                  <Link
                    href={`/collaboration/contracts/${contract.id}${needsSign ? "#sign" : ""}`}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 hover:bg-[#F1ECFF] ${
                      needsSign ? "bg-[#F4F0FF]" : "bg-[#F7F8FC]"
                    }`}
                  >
                    <span>
                      <span className="font-semibold text-indigo">{contract.title}</span>
                      <span className="ml-2 text-xs text-muted">
                        {contract.status} · {progress.label}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-violet">{needsSign ? "Sign now →" : "Open →"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      {params.published ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Your Starter card is live
          {home.slug ? (
            <>
              {" "}
              at{" "}
              <Link href={home.cardHref} className="font-semibold underline">
                /c/{home.slug}
              </Link>
            </>
          ) : null}
          .
        </div>
      ) : null}

      {home.incomplete ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div>
            <p className="font-semibold">Account setup ({home.completionScore}%)</p>
            <p className="text-amber-900/80">
              {params.welcome
                ? "Your account is ready. Finish the remaining steps so brands see a real card."
                : "Some account steps are still open. The checklist uses your saved profile, not sample copy."}
            </p>
          </div>
          <Link href={home.profileHref} className="btn-primary !py-2 text-sm">
            Edit profile
          </Link>
        </div>
      ) : null}

      {!hasProfile && !home.slug ? (
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
                    {home.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={home.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">{home.displayName.slice(0, 1)}</span>
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
                    <h2 className="font-display text-2xl font-bold">{home.displayName}</h2>
                    {home.identityVerified ? <IconVerified size={18} /> : null}
                  </div>
                  {home.slug ? <p className="text-sm text-muted">@{home.slug}</p> : null}
                  <p className="mt-2 max-w-2xl text-sm text-indigo/80">
                    {home.bio || "Add a short bio so brands know what you create."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {home.specialties.length ? (
                      home.specialties.slice(0, 6).map((name) => (
                        <span key={name} className="rounded-full bg-[#E8F0FF] px-2.5 py-1 text-xs font-semibold text-[#2F5FD0]">
                          {name}
                        </span>
                      ))
                    ) : (
                      <Link
                        href="/dashboard"
                        className="rounded-full border border-dashed border-[#C9D3EA] px-2.5 py-1 text-xs font-semibold text-muted"
                      >
                        + Add niche tags
                      </Link>
                    )}
                  </div>
                  <div className="mt-5 max-w-md rounded-2xl bg-[#F7F8FC] p-3">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>Account setup</span>
                      <span>{home.completionScore}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white">
                      <div className="h-2 rounded-full bg-violet" style={{ width: `${home.completionScore}%` }} />
                    </div>
                    <Link href={home.profileHref} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-violet">
                      Open the steps that still use your saved profile
                      <IconArrowRight size={12} />
                    </Link>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-48">
                  <Link href={home.profileHref} className="btn-primary !py-2.5 text-center text-sm">
                    Edit profile
                  </Link>
                  <Link href={home.cardHref} className="btn-secondary !py-2.5 text-center text-sm">
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

            <div className="flex justify-center">
              {cardCreator ? (
                <PublicInfluencerCard creator={cardCreator} qrDisplay="large" hideCta />
              ) : (
                <p className="text-sm text-muted">Publish your card to see it here.</p>
              )}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Profile views"
              value={formatFollowers(home.visitCount)}
              note={
                home.shortLabel
                  ? `Short link, QR, and NFC visits · last 7 days · ${home.visitAllTime} all time`
                  : "Visits start after a published short link"
              }
              tone="blue"
              icon={<IconEye size={16} />}
              points={home.shortLabel ? home.visitSeries : undefined}
              delta={home.visitDelta ?? undefined}
            />
            <StatCard
              label="Opportunity invites"
              value={String(home.opportunityCount)}
              note="Inquiries to this card, plus requests that name your specialty"
              tone="violet"
              icon={<IconShare size={16} />}
            />
            <StatCard
              label="Active collaborations"
              value={String(home.activeCollabs)}
              note="Accepted collaboration records"
              tone="emerald"
              icon={<IconUsers size={16} />}
            />
            <StatCard
              label="Earnings this month"
              value={moneyLabel(home.monthCents, home.currency)}
              note={home.currency ? "Influencer release rows this month" : "No funding currency is stored yet"}
              tone="amber"
              icon={<IconWallet size={16} />}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <Panel title="Connected social profiles" action={<TextLink href="/dashboard#socials">Manage</TextLink>}>
              {home.socials.length === 0 ? (
                <p className="text-sm text-muted">No social profile is saved on this card yet.</p>
              ) : (
                <ul className="space-y-3">
                  {home.socials.map((social) => (
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
                      <span
                        className={`flex items-center gap-2 text-xs font-semibold ${
                          social.status === "connected"
                            ? "text-emerald-700"
                            : social.status === "attention"
                              ? "text-amber-800"
                              : "text-muted"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            social.status === "connected"
                              ? "bg-emerald-500"
                              : social.status === "attention"
                                ? "bg-amber-500"
                                : "bg-[#C9D3EA]"
                          }`}
                        />
                        {social.statusLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Media kit"
              action={
                <StatusPill tone={home.mediaPublished ? "success" : "neutral"}>
                  {home.mediaPublished ? "Published" : "Not published"}
                </StatusPill>
              }
            >
              <p className="text-sm text-muted">
                {home.mediaPublished
                  ? "Uploaded profile photos on this card."
                  : "Upload your own photos. The branded avatar and banner are not a media kit."}
              </p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {home.photos.length === 0 ? (
                  <div className="col-span-4 rounded-xl bg-[#EEF2FA] px-3 py-6 text-center text-xs font-semibold text-muted">
                    No uploaded photos yet
                  </div>
                ) : (
                  home.photos.map((src) => (
                    <div key={src} className="aspect-square overflow-hidden rounded-xl bg-[#EEF2FA]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={home.cardHref} className="btn-secondary !py-2 text-sm">
                  View card
                </Link>
                <Link href="/creator/media-kit" className="btn-secondary !py-2 text-sm">
                  Edit media kit
                </Link>
              </div>
            </Panel>

            <Panel
              title="Payout status"
              action={
                <StatusPill tone={home.payoutReady ? "success" : "neutral"}>
                  {home.payoutReady ? "Payout ready" : "Not set up"}
                </StatusPill>
              }
            >
              <p className="text-sm text-muted">
                {home.payoutReady
                  ? "A payout account is stored for this card."
                  : "Add a payout method before collaborations can pay this card."}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <ChecklistItem done={home.identityDone} label="Identity verified" href="/dashboard/kyc" />
                <ChecklistItem done={home.payoutReady} label="Payout method added" href="/creator/earnings#payouts" />
                <ChecklistItem done={home.payoutReady} label="Ready to receive payments" href="/creator/earnings#payouts" />
              </ul>
              <Link href="/creator/earnings#payouts" className="btn-secondary mt-4 !py-2 text-sm">
                Manage payout methods
              </Link>
            </Panel>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Panel title="Recent opportunities" action={<TextLink href="/collaboration/hub?view=opportunities">View all</TextLink>}>
              {home.opportunities.length === 0 ? (
                <p className="text-sm text-muted">No brand inquiry or specialty-matched request is stored for this card yet.</p>
              ) : (
                <ul className="space-y-3">
                  {home.opportunities.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#F0F3FA] px-3 py-3 hover:border-violet/40 hover:bg-[#F8F6FF]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{item.title}</p>
                          <p className="truncate text-xs text-muted">{item.subtitle}</p>
                          {item.tags.length ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.tags.slice(0, 2).map((tag) => (
                                <span key={tag} className="rounded-full bg-[#EEF2FA] px-2 py-0.5 text-[10px] font-semibold text-muted">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-indigo">{item.budget || "—"}</p>
                          <StatusPill tone={item.badgeTone}>{item.badge}</StatusPill>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Active collaborations" action={<TextLink href="/collaboration/hub?view=collaborations">View all</TextLink>}>
              {home.pipeline.length === 0 ? (
                <p className="text-sm text-muted">No active collaboration pipeline items yet.</p>
              ) : (
                <ul className="space-y-3">
                  {home.pipeline.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#F0F3FA] px-3 py-3">
                      <div>
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="text-xs text-muted">{item.counterparty}</p>
                      </div>
                      <StatusPill
                        tone={item.stage === "In Progress" ? "success" : item.stage === "Review" ? "violet" : "info"}
                      >
                        {item.stage}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Account setup checklist">
              <p className="text-xs font-semibold text-muted">
                {home.checklistDone} of {home.checklist.length} complete
              </p>
              <div className="mt-2 h-2 rounded-full bg-[#EEF2FA]">
                <div
                  className="h-2 rounded-full bg-violet"
                  style={{ width: `${home.checklist.length ? (home.checklistDone / home.checklist.length) * 100 : 0}%` }}
                />
              </div>
              <ul className="mt-3 space-y-1">
                {home.checklist.map((item) => (
                  <ChecklistItem key={item.id} done={item.done} label={item.label} href={item.href} />
                ))}
              </ul>
            </Panel>
          </section>
        </>
      )}
    </div>
  );
}
