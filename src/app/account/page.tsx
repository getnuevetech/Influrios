import Link from "next/link";
import { redirect } from "next/navigation";
import { actionLogout, actionSaveCommPreference } from "@/app/account/actions";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { listContractsForUser } from "@/lib/contract-document";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await getAccountSession();
  if (!session) redirect("/login?next=/account");
  const params = await searchParams;
  const draft = await getCreatorSessionDraft();
  const [user, contracts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: { preferredCommChannel: true, phone: true },
    }),
    listContractsForUser(session.id).catch(() => []),
  ]);
  return (
    <div className="mx-auto max-w-lg px-4 py-14">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Account</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">{session.name || "Your account"}</h1>
      <p className="mt-2 text-sm text-muted">{session.email}</p>
      {params.saved ? <p className="mt-3 text-sm font-semibold text-emerald-700">Preferences saved.</p> : null}
      {params.error ? <p className="mt-3 text-sm font-semibold text-amber-800">{params.error}</p> : null}
      <div className="card-surface mt-6 space-y-3 p-6 text-sm text-indigo">
        <p>Email verified {session.emailVerifiedAt?.toLocaleString() ?? ""}.</p>
        {draft ? (
          <p>
            Claim in progress for <span className="font-semibold">{draft.displayName}</span> ({draft.stage}).{" "}
            <Link href={`/claim/preview/${draft.id}`} className="font-semibold text-violet">
              Continue
            </Link>
          </p>
        ) : (
          <p>
            <Link href="/claim" className="font-semibold text-violet">
              Claim Your Influrios Profile
            </Link>
          </p>
        )}
      </div>

      <section id="contracts" className="card-surface mt-4 space-y-3 p-6">
        <h2 className="font-display text-lg font-bold text-indigo">Contracts</h2>
        <p className="text-sm text-muted">
          Each agreement sent for signature is stored here for every party. It is signed when DocuSign reports every
          party complete.
        </p>
        {contracts.length === 0 ? <p className="text-sm text-muted">No contracts on this account yet.</p> : null}
        <ul className="space-y-2 text-sm">
          {contracts.map((contract) => (
            <li key={contract.id}>
              <Link href={`/collaboration/contracts/${contract.id}`} className="font-semibold text-violet hover:underline">
                {contract.title}
              </Link>{" "}
              · {contract.status}
            </li>
          ))}
        </ul>
      </section>

      <form action={actionSaveCommPreference} className="card-surface mt-4 space-y-3 p-6">
        <h2 className="font-display text-lg font-bold text-indigo">Communication preference</h2>
        <p className="text-sm text-muted">
          Choose how Influrios should reach you when both email and SMS are available.
        </p>
        <label className="block text-sm font-semibold text-indigo">
          Preferred channel
          <select
            name="preferredCommChannel"
            defaultValue={user?.preferredCommChannel === "sms" ? "sms" : "email"}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
          >
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
        </label>
        <label className="block text-sm font-semibold text-indigo">
          Phone (required for SMS)
          <input
            name="phone"
            defaultValue={user?.phone ?? ""}
            placeholder="+15555550100"
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
          />
        </label>
        <button type="submit" className="btn-primary !py-2 text-sm">
          Save preference
        </button>
      </form>

      <form action={actionLogout} className="mt-4">
        <button type="submit" className="btn-secondary">
          Log out
        </button>
      </form>
    </div>
  );
}
