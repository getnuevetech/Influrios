import Link from "next/link";
import { redirect } from "next/navigation";
import { actionLogout } from "@/app/account/actions";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account" };

export default async function AccountPage() {
  const session = await getAccountSession();
  if (!session) redirect("/login?next=/account");
  const draft = await getCreatorSessionDraft();
  return (
    <div className="mx-auto max-w-lg px-4 py-14">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Account</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">{session.name || "Your account"}</h1>
      <p className="mt-2 text-sm text-muted">{session.email}</p>
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
              Start a creator claim
            </Link>
          </p>
        )}
      </div>
      <form action={actionLogout} className="mt-4">
        <button type="submit" className="btn-secondary">
          Log out
        </button>
      </form>
    </div>
  );
}
