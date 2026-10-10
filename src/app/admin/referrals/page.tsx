import Link from "next/link";
import { actionSaveReferralProgram } from "@/app/admin/referrals/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { getReferralProgram, listReferralRegistrations, referralRewardLabel } from "@/lib/referrals";
import { primaryShortHost } from "@/lib/short-link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Referrals · Admin" };

const inputClass = "mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal";

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminReferralsPage({ searchParams }: Props) {
  const session = await requireAdminPage("shortlinks");
  const canEdit = hasPermission(session, "shortlinks.edit");
  const params = await searchParams;
  const [program, rows, host] = await Promise.all([
    getReferralProgram().catch(() => null),
    listReferralRegistrations().catch(() => []),
    primaryShortHost().catch(() => "inflr.me"),
  ]);
  const saved = program ?? { enabled: false, rewardKind: "", points: 0, amountCents: 0, currency: "" };

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Referrals</h1>
      <p className="mt-2 text-sm text-muted">
        A new account that starts from an influencer&apos;s short link is logged here. The reward is the points or
        money amount saved below. A money amount is recorded on the registration. It is not paid from this page.
      </p>
      {params.saved === "1" ? <p className="mt-4 text-sm font-semibold text-emerald-700">Saved.</p> : null}
      {params.error ? <p className="mt-4 text-sm font-semibold text-amber-800">{params.error}</p> : null}

      <form action={actionSaveReferralProgram} className="mt-6 grid gap-3 rounded-2xl border border-[#E4EBFF] bg-white p-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-indigo sm:col-span-2">
          Reward
          <select
            name="rewardKind"
            defaultValue={saved.rewardKind}
            disabled={!canEdit}
            className={inputClass}
          >
            <option value="">Choose points or a money amount</option>
            <option value="points">Points</option>
            <option value="money">Money</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-indigo">
          Points
          <input
            name="points"
            inputMode="numeric"
            defaultValue={saved.rewardKind === "points" ? String(saved.points) : ""}
            disabled={!canEdit}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-semibold text-indigo">
          Money amount
          <input
            name="amount"
            inputMode="decimal"
            defaultValue={saved.rewardKind === "money" ? (saved.amountCents / 100).toFixed(2) : ""}
            disabled={!canEdit}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-semibold text-indigo">
          Currency
          <input
            name="currency"
            maxLength={3}
            defaultValue={saved.rewardKind === "money" ? saved.currency : ""}
            disabled={!canEdit}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
          <input type="checkbox" name="enabled" value="1" defaultChecked={saved.enabled} disabled={!canEdit} />
          Referral registration is on
        </label>
        {canEdit ? <button type="submit" className="btn-primary w-fit">Save referral reward</button> : null}
      </form>

      <section className="mt-6 rounded-2xl border border-[#E4EBFF] bg-white p-4">
        <h2 className="font-display text-lg font-bold text-indigo">Registrations</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No referral registrations yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {rows.map((row) => {
              const reward = referralRewardLabel(row);
              return (
                <li key={row.id} className="py-3 text-sm text-indigo">
                  <p className="font-semibold">{row.referrer.displayName}</p>
                  <p className="text-xs text-muted">
                    {host}/{row.shortLink.slug} · {row.referredEmail}
                    {reward ? ` · ${reward}` : ""} · {row.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
