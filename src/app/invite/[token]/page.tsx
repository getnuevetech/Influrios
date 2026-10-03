import Link from "next/link";
import { notFound } from "next/navigation";
import { actionClaimDraft } from "@/app/claim/actions";
import { actionDeclineInvitation } from "@/app/invite/actions";
import { PublicInfluencerCard } from "@/components/public-influencer-card";
import { draftToSeedCreator } from "@/lib/claim";
import { openInvitation, renderInvitationCopy } from "@/lib/invitations";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> };

export default async function InvitationPage({ params, searchParams }: Props) {
  const { token } = await params;
  const query = await searchParams;
  const opened = await openInvitation(token).catch(() => null);
  if (!opened || opened.state === "missing") notFound();

  const invitation = opened.invitation;
  const when = invitation.expiresAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const message = renderInvitationCopy(invitation.template.body, {
    name: invitation.displayName,
    profile: invitation.creatorSlug,
    link: `/invite/${invitation.token}`,
    expiry: when,
  });

  return (
    <div className="min-h-[80vh] bg-[radial-gradient(ellipse_at_top,_#EAE4FF,_#F7FAFF_55%,_#D9E8FF)] px-4 py-10">
      <div className="mx-auto mb-8 max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Your profile</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">{invitation.displayName}</h1>
        <p className="mt-3 text-sm text-muted">{message}</p>
        {invitation.campaign ? (
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-violet">{invitation.campaign.name}</p>
        ) : null}
      </div>

      {query.error ? (
        <div className="mx-auto mb-6 max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {query.error}
        </div>
      ) : null}

      {opened.state === "ready" || opened.state === "claimed" ? (
        <PublicInfluencerCard creator={draftToSeedCreator(opened.draft)} qrDisplay="default" draftPreview />
      ) : null}

      <div className="mx-auto mt-8 max-w-md card-surface space-y-4 p-6">
        {opened.state === "ready" ? (
          <>
            <h2 className="font-display text-xl font-bold text-indigo">Claim {invitation.displayName}&apos;s card</h2>
            <p className="text-sm text-muted">
              This draft is the directory profile we prepared. It is not a blank signup.
            </p>
            <form action={actionClaimDraft} className="space-y-3">
              <input type="hidden" name="draftId" value={opened.draft.id} />
              <input type="hidden" name="next" value={`/invite/${invitation.token}`} />
              <label className="block text-sm font-semibold text-indigo">
                Display name
                <input
                  name="name"
                  required
                  defaultValue={opened.draft.displayName}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold text-indigo">
                Gender (optional — picks your default avatar)
                <select
                  name="gender"
                  defaultValue={opened.draft.gender || "unspecified"}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
                >
                  <option value="unspecified">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-indigo">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={invitation.email ?? ""}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
                />
              </label>
              <button type="submit" className="btn-primary w-full">
                Claim this profile →
              </button>
            </form>
            <form action={actionDeclineInvitation}>
              <input type="hidden" name="token" value={invitation.token} />
              <button type="submit" className="text-sm font-semibold text-muted hover:text-indigo">
                This isn&apos;t my profile
              </button>
            </form>
          </>
        ) : null}
        {opened.state === "claimed" ? (
          <>
            <h2 className="font-display text-xl font-bold text-indigo">Continue this claim</h2>
            <p className="text-sm text-muted">The profile is claimed. Verify the email to publish it.</p>
            <Link href={`/claim/verify/${opened.draft.id}`} className="btn-primary inline-flex">
              Continue verification
            </Link>
          </>
        ) : null}
        {opened.state === "published" ? (
          <>
            <h2 className="font-display text-xl font-bold text-indigo">This profile is live</h2>
            <Link href={`/creators/${invitation.creatorSlug}`} className="font-semibold text-violet">
              View {invitation.displayName}
            </Link>
          </>
        ) : null}
        {opened.state === "expired" ? (
          <p className="text-sm text-muted">This invitation expired on {when}. Ask Influrios for a new link.</p>
        ) : null}
        {opened.state === "suppressed" ? (
          <p className="text-sm text-muted">This invitation is no longer active.</p>
        ) : null}
        {opened.state === "declined" ? (
          <p className="text-sm text-muted">This invitation was declined. You can still create a card from scratch.</p>
        ) : null}
        {opened.state === "declined" || opened.state === "expired" ? (
          <Link href="/claim" className="inline-block text-sm font-semibold text-violet">
            Start a new card
          </Link>
        ) : null}
      </div>
    </div>
  );
}
