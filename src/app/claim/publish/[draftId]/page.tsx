import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { actionAddDraftSocial, actionPublishDraft } from "@/app/claim/actions";
import { PublicInfluencerCard } from "@/components/public-influencer-card";
import { draftToSeedCreator, getDraft } from "@/lib/claim";

export const dynamic = "force-dynamic";
export const metadata = { title: "Publish your Influencer Card" };

type Props = {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function ClaimPublishPage({ params, searchParams }: Props) {
  const { draftId } = await params;
  const q = await searchParams;
  const draft = await getDraft(draftId);
  if (!draft) notFound();
  if (draft.stage === "draft") redirect(`/claim/preview/${draft.id}`);
  if (draft.stage === "claimed") redirect(`/claim/verify/${draft.id}`);

  const creator = draftToSeedCreator(draft);
  const alreadyLive = draft.stage === "published";

  return (
    <div className="min-h-[80vh] bg-[radial-gradient(ellipse_at_top,_#EAE4FF,_#F7FAFF_55%,_#D9E8FF)] px-4 py-10">
      <div className="mx-auto mb-8 max-w-xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Step 4 · Publish</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">
          {alreadyLive ? "Your Starter card is live" : "Publish your Starter card"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Shareable URL:{" "}
          <span className="font-semibold text-blue">influrios.com/c/{draft.slug}</span>
        </p>
      </div>

      {q.error ? (
        <div className="mx-auto mb-6 max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {q.error}
        </div>
      ) : null}

      <PublicInfluencerCard creator={creator} qrDisplay="default" />

      <div className="mx-auto mt-8 max-w-sm space-y-3">
        {alreadyLive ? (
          <>
            <Link href={`/c/${draft.slug}`} className="btn-primary flex w-full">
              Open live card →
            </Link>
            <Link href="/dashboard" className="btn-secondary flex w-full">
              Creator dashboard
            </Link>
          </>
        ) : (
          <form action={actionPublishDraft}>
            <input type="hidden" name="draftId" value={draft.id} />
            <button type="submit" className="btn-primary w-full">
              Publish Starter card →
            </button>
          </form>
        )}
        <form action={actionAddDraftSocial} className="space-y-2 rounded-2xl border border-border bg-white p-4">
          <p className="text-sm font-semibold text-indigo">Add another social</p>
          <p className="text-xs text-muted">
            Starter includes one social link. A second link returns the upgrade path.
          </p>
          <input type="hidden" name="draftId" value={draft.id} />
          <input
            name="handle"
            required
            placeholder="@anotherhandle"
            className="w-full rounded-xl border border-border px-3 py-2 text-sm"
          />
          <button type="submit" className="btn-secondary w-full !py-2 text-sm">
            Add social
          </button>
        </form>
        <p className="text-center text-xs text-muted">
          Starter cards use a shareable link. Upgrade later for shortlink + QR.
        </p>
      </div>
    </div>
  );
}
