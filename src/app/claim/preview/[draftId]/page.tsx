import Link from "next/link";
import { notFound } from "next/navigation";
import { actionClaimDraft } from "@/app/claim/actions";
import { PublicInfluencerCard } from "@/components/public-influencer-card";
import { draftToSeedCreator, getDraft } from "@/lib/claim";
import { getInfluencerIdentity } from "@/lib/landing-pages";

export const dynamic = "force-dynamic";
export const metadata = { title: "Preview your Influencer Card" };

type Props = {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<{ error?: string }>;
};

const STAGES = ["Preview", "Claim", "Verify", "Publish"] as const;

export default async function ClaimPreviewPage({ params, searchParams }: Props) {
  const { draftId } = await params;
  const q = await searchParams;
  const draft = await getDraft(draftId);
  if (!draft) notFound();
  const [creator, identity] = await Promise.all([
    Promise.resolve(draftToSeedCreator(draft)),
    getInfluencerIdentity(),
  ]);

  return (
    <div className="min-h-[80vh] bg-[radial-gradient(ellipse_at_top,_#EAE4FF,_#F7FAFF_55%,_#D9E8FF)] px-4 py-10">
      <div className="mx-auto mb-8 max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Draft preview</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">
          Your Influencer Card — before you sign up
        </h1>
        <p className="mt-2 text-sm text-muted">
          Generated from <span className="font-semibold text-indigo">{draft.inputHandle}</span>. This is a
          temporary full-card preview — nothing is public until you claim, verify, and publish.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
          {STAGES.map((s, i) => (
            <span
              key={s}
              className={`rounded-full px-3 py-1 ${
                i === 0 ? "bg-violet text-white" : "bg-white text-muted ring-1 ring-border"
              }`}
            >
              {i + 1}. {s}
            </span>
          ))}
        </div>
      </div>

      {q.error ? (
        <div className="mx-auto mb-6 max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {q.error}
        </div>
      ) : null}

      <PublicInfluencerCard creator={creator} qrDisplay="large" draftPreview />

      <div className="mx-auto mt-8 max-w-sm card-surface space-y-4 p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Claim this Influencer Profile</h2>
        <p className="text-sm text-muted">
          Attach your email to take ownership. Your temporary card shows the full Influrios experience —
          publishing starts on the Starter plan.
        </p>
        <form action={actionClaimDraft} className="space-y-3">
          <input type="hidden" name="draftId" value={draft.id} />
          <label className="block text-sm font-semibold text-indigo">
            Display name
            <input
              name="name"
              required
              defaultValue={draft.displayName}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold text-indigo">
            How do you describe yourself?
            <select
              name="title"
              defaultValue={draft.title || "Influencer"}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
            >
              {identity.selfDescriptions.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-muted">
              Your platform role is Influencer. This is how you describe your influence.
            </span>
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Gender (optional — picks your default avatar)
            <select
              name="gender"
              defaultValue={draft.gender || "unspecified"}
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
              placeholder="you@email.com"
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
            />
          </label>
          <button type="submit" className="btn-primary w-full">
            Claim & continue →
          </button>
        </form>
        <p className="text-center text-xs text-muted">
          <Link href="/claim" className="font-semibold text-violet hover:underline">
            ← Start over
          </Link>
        </p>
      </div>
    </div>
  );
}
