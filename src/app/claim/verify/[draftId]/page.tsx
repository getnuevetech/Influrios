import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { actionVerifyDraft } from "@/app/claim/actions";
import { getDraft } from "@/lib/claim";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify your channel" };

type Props = {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function ClaimVerifyPage({ params, searchParams }: Props) {
  const { draftId } = await params;
  const q = await searchParams;
  const draft = await getDraft(draftId);
  if (!draft) notFound();
  if (draft.stage === "draft") redirect(`/claim/preview/${draft.id}`);
  if (draft.stage === "verified" || draft.stage === "published") {
    redirect(`/claim/publish/${draft.id}`);
  }

  const mailed = draft.verificationDelivery === "email";

  return (
    <div className="mx-auto max-w-lg px-4 py-14 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Step 3 · Verify</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Verify your email</h1>
      <p className="mt-3 text-sm text-muted">
        Confirm the email on this claim. This does not verify @
        {draft.socials[0]?.handle.replace(/^@/, "")} — social verification stays separate until the network
        connects.
      </p>

      {q.error ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {q.error}
        </div>
      ) : null}

      <div className="card-surface mt-8 space-y-4 p-6">
        {mailed ? (
          <div className="rounded-xl bg-[#EEF4FF] px-4 py-3 text-sm text-indigo">
            <p className="font-semibold">Check {draft.email}</p>
            <p className="mt-1 text-xs text-muted">
              We sent a verification code to that address. Enter it below to continue.
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-[#EEF4FF] px-4 py-3 text-sm text-indigo">
            <p className="font-semibold">Nothing was sent to {draft.email}</p>
            <p className="mt-1 text-xs text-muted">
              SMTP is not configured. Nothing was verified and no code is shown. A social challenge on{" "}
              {draft.platform} stays a separate verification.
            </p>
          </div>
        )}

        {mailed ? (
          <form action={actionVerifyDraft} className="space-y-3">
            <input type="hidden" name="draftId" value={draft.id} />
            <label className="block text-sm font-semibold text-indigo">
              Enter verification code
              <input
                name="code"
                required
                inputMode="numeric"
                placeholder="6-digit code"
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal tracking-widest"
              />
            </label>
            <button type="submit" className="btn-primary w-full">
              Verify email →
            </button>
          </form>
        ) : null}
      </div>

      <p className="mt-6 text-center text-sm">
        <Link href={`/claim/preview/${draft.id}`} className="font-semibold text-violet hover:underline">
          ← Back to preview
        </Link>
      </p>
    </div>
  );
}
