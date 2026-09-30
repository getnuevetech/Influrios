import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { scoreCreatorPair } from "@/lib/matching";
import { getCreatorBySlug, specialtyLabel } from "@/lib/seed-data";
import { canRequestMatch } from "@/lib/matching";
import type { PlanCode } from "@/lib/entitlements";

export const metadata = {
  title: "Propose Collaboration",
};

type Props = {
  searchParams: Promise<{ a?: string; b?: string; from?: string }>;
};

async function submitProposal(formData: FormData) {
  "use server";
  const a = String(formData.get("a") ?? "");
  const b = String(formData.get("b") ?? "");
  const from = String(formData.get("from") ?? "");
  const account = await getAccountSession();
  const returnTo = `/collaboration/propose?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&from=${encodeURIComponent(from)}`;
  if (!account) redirect(`/login?next=${encodeURIComponent(returnTo)}&gate=proposal`);
  // Demo persistence: redirect with confirmation flag (Phase 3 will store Opportunity rows)
  redirect(
    `/collaboration?from=${encodeURIComponent(from)}&requested=${encodeURIComponent(`${a}+${b}`)}`,
  );
}

export default async function ProposeCollaborationPage({ searchParams }: Props) {
  const params = await searchParams;
  const creatorA = params.a ? getCreatorBySlug(params.a) : undefined;
  const creatorB = params.b ? getCreatorBySlug(params.b) : undefined;
  const from = params.from ? getCreatorBySlug(params.from) : creatorA;

  if (!creatorA || !creatorB) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-semibold text-indigo">Missing creators for this proposal.</p>
        <Link href="/collaboration" className="mt-4 inline-block text-violet">
          Back to matches
        </Link>
      </div>
    );
  }

  const match = scoreCreatorPair(creatorA, creatorB);
  const plan = (from?.planTier ?? "STARTER") as PlanCode;
  const allowed = canRequestMatch(plan);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-indigo">Collaboration requests are a Plus feature</h1>
        <p className="mt-3 text-muted">
          You&apos;re viewing as <strong>{from?.displayName}</strong> on the {plan} plan. Upgrade to
          Plus or Pro to send structured collaboration proposals.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/card" className="btn-primary">
            View card plans →
          </Link>
          <Link href="/collaboration" className="btn-secondary">
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet">Structured proposal</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Propose a collaboration</h1>
      <p className="mt-2 text-muted">
        Send a clear brief covering scope, roles, and commercial framing. No escrow yet — Phase 2 is
        about proving creators will use complementary matching.
      </p>

      <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-white p-4">
        <span className="relative h-14 w-14 overflow-hidden rounded-full">
          <Image src={creatorA.image} alt={creatorA.displayName} fill className="object-cover" sizes="56px" />
        </span>
        <div className="text-center text-sm font-bold text-violet">×</div>
        <span className="relative h-14 w-14 overflow-hidden rounded-full">
          <Image src={creatorB.image} alt={creatorB.displayName} fill className="object-cover" sizes="56px" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-indigo">
            {creatorA.displayName} + {creatorB.displayName}
          </p>
          {match ? (
            <p className="text-sm text-muted">
              {match.score}% match · {match.complementarySpecialties[0] ?? specialtyLabel(creatorA.specialties[0] ?? "")}
            </p>
          ) : null}
        </div>
      </div>

      {match ? (
        <p className="mt-4 rounded-xl bg-lavender/40 p-4 text-sm text-indigo">{match.why}</p>
      ) : null}

      <form action={submitProposal} className="card-surface mt-6 space-y-4 p-6">
        <input type="hidden" name="a" value={creatorA.slug} />
        <input type="hidden" name="b" value={creatorB.slug} />
        <input type="hidden" name="from" value={from?.slug ?? creatorA.slug} />

        <label className="block text-sm font-semibold text-indigo">
          Project title
          <input
            name="title"
            required
            defaultValue={`${creatorA.specialties[0] ?? "Creator"} × ${creatorB.specialties[0] ?? "Creator"} collab`}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
          />
        </label>

        <label className="block text-sm font-semibold text-indigo">
          What you&apos;ll create together
          <textarea
            name="scope"
            required
            rows={4}
            defaultValue={
              match?.why ??
              "Joint content series combining both audiences with clear roles and deliverables."
            }
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-indigo">
            Your role
            <input
              name="roleA"
              defaultValue={creatorA.offer ?? creatorA.title}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
            />
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Their role
            <input
              name="roleB"
              defaultValue={creatorB.offer ?? creatorB.title}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
            />
          </label>
        </div>

        <label className="block text-sm font-semibold text-indigo">
          Commercial framing
          <select
            name="commercial"
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
          >
            <option>Open to discussion</option>
            <option>Paid brand partnership</option>
            <option>Cross-promotion / barter</option>
            <option>Joint pitch to a brand</option>
          </select>
        </label>

        <button type="submit" className="btn-primary w-full">
          Send collaboration proposal →
        </button>
      </form>
    </div>
  );
}
