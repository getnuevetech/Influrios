import Link from "next/link";
import { redirect } from "next/navigation";
import { actionSaveEmailPreference } from "@/app/account/actions";
import { getAccountSession } from "@/lib/accounts";
import { emailPreference } from "@/lib/email-live";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email preferences" };

export default async function EmailNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await getAccountSession();
  if (!session) redirect("/login?next=/account/notifications");
  const params = await searchParams;
  const preference = await emailPreference(session.email);

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/account" className="text-sm font-semibold text-violet hover:underline">
        ← Account
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Email preferences</h1>
      <p className="mt-2 text-sm text-muted">
        Security mail, including verification codes and password resets, stays on. These choices cover the other messages sent to {session.email}.
      </p>
      {params.saved ? <p className="mt-3 text-sm font-semibold text-emerald-700">Preferences saved.</p> : null}
      <form action={actionSaveEmailPreference} className="card-surface mt-6 space-y-3 p-6 text-sm">
        <label className="flex items-center gap-2 font-semibold text-indigo">
          <input name="collaborations" type="checkbox" defaultChecked={preference.collaborations} />
          Collaboration, invitation, and payout updates
        </label>
        <label className="flex items-center gap-2 font-semibold text-indigo">
          <input name="billing" type="checkbox" defaultChecked={preference.billing} />
          Subscription receipts and payment problems
        </label>
        <label className="flex items-center gap-2 font-semibold text-indigo">
          <input name="outreach" type="checkbox" defaultChecked={preference.outreach} />
          Claim invitations and follow-ups
        </label>
        <label className="flex items-center gap-2 font-semibold text-indigo">
          <input name="productNews" type="checkbox" defaultChecked={preference.productNews} />
          Product news
        </label>
        <button type="submit" className="btn-primary !py-2 text-sm">
          Save email preferences
        </button>
      </form>
    </div>
  );
}
