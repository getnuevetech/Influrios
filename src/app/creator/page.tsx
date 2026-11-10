import Link from "next/link";
import { redirect } from "next/navigation";
import { CopyTextButton } from "@/components/copy-text-button";
import { ChecklistItem } from "@/components/dashboard-ui";
import { IconArrowRight, IconEye, IconHandshake, IconMail, IconWallet } from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { loadCreatorHome } from "@/lib/creator-home";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Home" };

function moneyLabel(cents: number, currency: string, failed: boolean) {
  if (failed || !currency) return "—";
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
  const connected = home.socials.filter((social) => social.status === "connected").length;
  const checklistOpen = home.checklist.some((item) => !item.done);
  const shareUrl = home.shortLabel
    ? home.shortLabel.startsWith("http")
      ? home.shortLabel
      : `https://${home.shortLabel}`
    : home.slug
      ? `https://influrios.com/c/${home.slug}`
      : "";
  const viewCount = home.visitsFailed ? "—" : home.visitCount30 === null ? "—" : String(home.visitCount30);
  const viewNote = home.visitsFailed
    ? "Profile views could not be loaded. This is not zero."
    : home.visitCount30 === null
      ? "Views start after your card link is live"
      : "Last 30 days";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1B1464] sm:text-4xl">
            Welcome back{home.firstName ? `, ${home.firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-[#667085]">Here&apos;s what&apos;s happening with your account.</p>
        </div>
      </div>

      {params.published ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Your Starter card is live{home.slug ? ` at /c/${home.slug}` : ""}.
        </p>
      ) : null}
      {params.welcome ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E4EBFF] bg-white px-4 py-3 text-sm">
          <div>
            <p className="font-semibold text-[#1B1464]">Connect a social account</p>
            <p className="text-[#667085]">You can do this later. A declined connection keeps this profile so you can retry.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/social" className="btn-primary !py-2 text-sm">
              Connect a social account
            </Link>
            <Link href="/creator" className="btn-secondary !py-2 text-sm">
              Do this later
            </Link>
          </div>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat href="/collaboration/hub?view=collaborations&tab=invitations" label="Pending invitations" value={String(home.pendingInvitations)} icon={<IconMail size={16} />} />
        <Stat href="/collaboration/hub?view=collaborations&tab=active" label="Active collaborations" value={String(home.activeCollabs)} icon={<IconHandshake size={16} />} />
        <Stat href="/creator/analytics" label="Profile views · 30 days" value={viewCount} note={viewNote} icon={<IconEye size={16} />} />
        <Stat
          href="/creator/earnings"
          label="Released this month"
          value={moneyLabel(home.earnings.cents, home.earnings.currency, home.earnings.failed)}
          note={home.earnings.note}
          icon={<IconWallet size={16} />}
        />
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-[#1B1464]">Needs your attention</h2>
              {home.attention.length > 0 ? (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#F3EEFF] px-2 text-xs font-bold text-[#6D4AFF]">
                  {home.attention.length}
                </span>
              ) : null}
            </div>
            {home.attention.length === 0 ? (
              <p className="mt-3 text-sm text-[#667085]">Nothing is waiting on you. New invitations appear here.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[#EEF2F7]">
                {home.attention.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1B1464]">{item.title}</p>
                      <p className="text-xs text-[#667085]">{item.detail}</p>
                    </div>
                    <Link href={item.href} className="rounded-full bg-[#6D4AFF] px-3 py-2 text-xs font-semibold text-white">
                      {item.action} →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-[#1B1464]">Active collaborations</h2>
              <Link href="/collaboration/hub?view=collaborations&tab=active" className="text-xs font-semibold text-[#6D4AFF]">
                View all
              </Link>
            </div>
            {home.pipeline.length === 0 ? (
              <p className="mt-3 text-sm text-[#667085]">
                No current work. Invitations and proposals stay in Needs your attention until they become a collaboration.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[#EEF2F7]">
                {home.pipeline.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1B1464]">{item.title}</p>
                      <p className="text-xs text-[#667085]">
                        {item.counterparty ? `${item.counterparty} · ` : ""}
                        {item.next}
                      </p>
                    </div>
                    {item.stage === "Expecting funding" ? (
                      <span className="rounded-full border border-[#E7ECF5] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#98A2B3]">
                        Expecting funding
                      </span>
                    ) : (
                      <span className="flex flex-wrap gap-2">
                        {item.contractHref ? (
                          <Link href={item.contractHref} className="rounded-full border border-[#E4E9F5] px-3 py-2 text-xs font-semibold text-[#6D4AFF]">
                            Contract
                          </Link>
                        ) : null}
                        <Link href={item.href} className="rounded-full bg-[#6D4AFF] px-3 py-2 text-xs font-semibold text-white">
                          {item.href.includes("/collaboration/work/") ? "Deliverables" : "Open workspace →"}
                        </Link>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#1B1464]">Your Influencer Card</h2>
            {home.slug ? (
              <div className="mt-3 overflow-hidden rounded-2xl bg-gradient-to-br from-[#5B4DFF] to-[#8B5CF6] p-4 text-white">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-14 w-14 overflow-hidden rounded-full bg-white/20 text-lg font-bold">
                    {home.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={home.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">{home.displayName.slice(0, 1)}</span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{home.displayName}</p>
                    {home.title ? <p className="truncate text-xs text-white/80">{home.title}</p> : null}
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/qr/${encodeURIComponent(home.slug)}?size=160&logo=0`}
                    alt=""
                    width={64}
                    height={64}
                    className="ml-auto h-16 w-16 rounded-lg bg-white p-1"
                  />
                </div>
                {home.shortLabel ? <p className="mt-3 text-xs font-semibold text-white/90">{home.shortLabel}</p> : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#667085]">Create your card to get a share link. The full portrait stays on its own page.</p>
            )}
            <div className="mt-3 flex gap-2">
              <Link href={home.cardHref} className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-[#6D4AFF] px-3 py-2 text-sm font-semibold text-white">
                View card <IconArrowRight size={14} />
              </Link>
              {shareUrl ? <CopyTextButton value={shareUrl} /> : null}
            </div>
          </section>

          <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#1B1464]">Account status</h2>
            <ul className="mt-3 space-y-2 text-sm text-[#1B1464]">
              <StatusRow done={home.published} label="Profile published" href={home.profileHref} />
              <StatusRow
                done={connected > 0}
                label={connected > 0 ? `${connected} social${connected === 1 ? "" : "s"} connected` : "No social connected"}
                href="/dashboard/social"
              />
              <StatusRow done={home.payoutReady} label={home.payoutReady ? "Payout ready" : "Payout not ready"} href="/creator/earnings#payouts" />
            </ul>
            {checklistOpen ? (
              <div className="mt-4 border-t border-[#EEF2F7] pt-3">
                <p className="text-xs font-semibold text-[#667085]">
                  Setup {home.checklistDone} of {home.checklist.length}
                </p>
                <ul className="mt-2">
                  {home.checklist
                    .filter((item) => !item.done)
                    .map((item) => (
                      <ChecklistItem key={item.id} done={item.done} label={item.label} href={item.href} />
                    ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({
  href,
  label,
  value,
  note,
  icon,
}: {
  href: string;
  label: string;
  value: string;
  note?: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="rounded-2xl border border-[#E7ECF5] bg-white p-4 shadow-sm hover:border-[#C9B8FF]">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#F3EEFF] text-[#6D4AFF]">{icon}</span>
      <p className="mt-3 text-xs font-semibold text-[#667085]">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-[#1B1464]">{value}</p>
      {note ? <p className="mt-1 text-[11px] leading-snug text-[#667085]">{note}</p> : null}
    </Link>
  );
}

function StatusRow({ done, label, href }: { done: boolean; label: string; href: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-2 hover:text-[#6D4AFF]">
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${done ? "bg-[#E8F8EE] text-[#178A45]" : "bg-[#F4F6FB] text-[#98A2B3]"}`}>
          {done ? "✓" : "–"}
        </span>
        {label}
      </Link>
    </li>
  );
}
