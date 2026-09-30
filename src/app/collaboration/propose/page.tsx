import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import {
  commercialChoices,
  createCollaboration,
  proposalDenialMessage,
  proposalUsage,
} from "@/lib/collaborations";
import { isPlanCode, type PlanCode } from "@/lib/entitlements";
import { entitlementsForPlan } from "@/lib/entitlements-db";
import { scoreCreatorPair } from "@/lib/matching";
import { getCreatorBySlug, specialtyLabel } from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Propose Collaboration",
};

type Props = {
  searchParams: Promise<{ a?: string; b?: string; from?: string; error?: string }>;
};

async function submitProposal(formData: FormData) {
  "use server";
  const a = String(formData.get("a") ?? "");
  const b = String(formData.get("b") ?? "");
  const from = String(formData.get("from") ?? a);
  const returnTo = `/collaboration/propose?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&from=${encodeURIComponent(from)}`;
  const account = await getAccountSession();
  if (!account) redirect(`/login?next=${encodeURIComponent(returnTo)}&gate=proposal`);

  const creatorA = getCreatorBySlug(a);
  const creatorB = getCreatorBySlug(b);
  const viewer = getCreatorBySlug(from);
  const initiator = viewer?.slug === creatorB?.slug ? creatorB : creatorA;
  const recipient = initiator?.slug === creatorA?.slug ? creatorB : creatorA;
  const plan: PlanCode = initiator && isPlanCode(initiator.planTier) ? initiator.planTier : "STARTER";
  const viewerPlan: PlanCode = viewer && isPlanCode(viewer.planTier) ? viewer.planTier : plan;
  if (viewer && viewer.slug !== initiator?.slug) {
    const viewerLimits = await entitlementsForPlan(viewerPlan);
    if (viewerLimits.proposalsMax <= 0) {
      redirect(`${returnTo}&error=${encodeURIComponent("Sending proposals is off for this plan (collaboration.proposals.max).")}`);
    }
  }
  const match =
    (creatorA && creatorB ? scoreCreatorPair(creatorA, creatorB) : null) ??
    (initiator && recipient ? scoreCreatorPair(initiator, recipient) : null);
  const intent = formData.get("intent") === "draft" ? "draft" : "sent";

  const result = await createCollaboration({
    initiatorSlug: initiator?.slug ?? from,
    recipientSlug: recipient?.slug ?? "",
    initiatorUserId: account.id,
    title: String(formData.get("title") ?? ""),
    scope: String(formData.get("scope") ?? ""),
    roleInitiator: String(formData.get(initiator?.slug === creatorB?.slug ? "roleB" : "roleA") ?? ""),
    roleRecipient: String(formData.get(initiator?.slug === creatorB?.slug ? "roleA" : "roleB") ?? ""),
    commercial: String(formData.get("commercial") ?? ""),
    intent,
    why: match?.why ?? String(formData.get("scope") ?? ""),
    reasons: match?.reasons ?? [],
    score: match?.score ?? 0,
    offerSpecialty: initiator?.specialties[0] ?? null,
    needSpecialty: recipient?.specialties[0] ?? null,
    plan,
  });

  if (!result.ok) {
    redirect(`${returnTo}&error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/collaboration/records/${result.id}`);
}

export default async function ProposeCollaborationPage({ searchParams }: Props) {
  const params = await searchParams;
  const creatorA = params.a ? getCreatorBySlug(params.a) : undefined;
  const creatorB = params.b ? getCreatorBySlug(params.b) : undefined;
  const from = params.from ? getCreatorBySlug(params.from) : creatorA;

  if (!creatorA || !creatorB || !from) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-semibold text-indigo">Missing creators for this proposal.</p>
        <Link href="/collaboration" className="mt-4 inline-block text-violet">
          Back to matches
        </Link>
      </div>
    );
  }

  const initiator = from.slug === creatorB.slug ? creatorB : creatorA;
  const recipient = initiator.slug === creatorA.slug ? creatorB : creatorA;
  const match = scoreCreatorPair(creatorA, creatorB) ?? scoreCreatorPair(initiator, recipient);
  const plan: PlanCode = isPlanCode(initiator.planTier) ? initiator.planTier : "STARTER";
  const viewerPlan: PlanCode = isPlanCode(from.planTier) ? from.planTier : plan;

  let usage: Awaited<ReturnType<typeof proposalUsage>> | null = null;
  let dbError = false;
  try {
    usage = await proposalUsage(initiator.slug, plan);
  } catch (error) {
    console.error("proposal usage", error);
    dbError = true;
  }

  const viewerBlocked = viewerPlan !== plan ? (await entitlementsForPlan(viewerPlan)).proposalsMax <= 0 : false;
  if (viewerBlocked || (usage && usage.limits.proposalsMax <= 0)) {
    const denied =
      usage && !usage.decision.ok
        ? proposalDenialMessage(usage.decision, usage.settings.windowDays)
        : "Sending proposals is off for this plan (collaboration.proposals.max).";
    const blockedName = viewerBlocked ? from.displayName : initiator.displayName;
    const blockedPlan = viewerBlocked ? viewerPlan : plan;
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-indigo">Proposals are off for this plan</h1>
        <p className="mt-3 text-muted">
          You&apos;re viewing as <strong>{blockedName}</strong> on the {blockedPlan} plan. {denied}
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

  const choices = commercialChoices(usage?.settings.commercialOptions);
  const offerSpecialty = initiator.specialties[0] ?? "";
  const needSpecialty = recipient.specialties[0] ?? "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet">Structured proposal</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Propose a collaboration</h1>
      <p className="mt-2 text-muted">
        Save a draft or send it. The record keeps this match explanation, and the recipient can accept or decline.
      </p>

      <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-white p-4">
        <span className="relative h-14 w-14 overflow-hidden rounded-full">
          <Image src={initiator.image} alt={initiator.displayName} fill className="object-cover" sizes="56px" />
        </span>
        <div className="text-center text-sm font-bold text-violet">×</div>
        <span className="relative h-14 w-14 overflow-hidden rounded-full">
          <Image src={recipient.image} alt={recipient.displayName} fill className="object-cover" sizes="56px" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-indigo">
            {initiator.displayName} + {recipient.displayName}
          </p>
          {match ? (
            <p className="text-sm text-muted">
              {match.score}% match · {match.complementarySpecialties[0] ?? specialtyLabel(offerSpecialty)}
            </p>
          ) : null}
        </div>
      </div>

      {match ? (
        <div className="mt-4 rounded-xl bg-lavender/40 p-4 text-sm text-indigo">
          <p>{match.why}</p>
          {match.reasons.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              {match.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {params.error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{params.error}</p>
      ) : null}
      {usage && !usage.decision.ok ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {proposalDenialMessage(usage.decision, usage.settings.windowDays)} You can still save a draft.
        </p>
      ) : null}
      {dbError ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          Proposals cannot be saved until the database is available.
        </p>
      ) : null}
      {usage ? (
        <p className="mt-4 text-sm text-muted">
          {usage.remaining} of {usage.limits.proposalsMax} proposals left in the last {usage.settings.windowDays} days
          for {initiator.displayName}.
        </p>
      ) : null}

      <form action={submitProposal} className="card-surface mt-6 space-y-4 p-6">
        <input type="hidden" name="a" value={creatorA.slug} />
        <input type="hidden" name="b" value={creatorB.slug} />
        <input type="hidden" name="from" value={initiator.slug} />

        <label className="block text-sm font-semibold text-indigo">
          Project title
          <input
            name="title"
            required
            defaultValue={`${specialtyLabel(offerSpecialty || "Creator")} × ${specialtyLabel(needSpecialty || "Creator")} collab`}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
          />
        </label>

        <label className="block text-sm font-semibold text-indigo">
          What you&apos;ll create together
          <textarea
            name="scope"
            required
            rows={4}
            defaultValue={match?.why ?? "Joint content series combining both audiences with clear roles and deliverables."}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-indigo">
            Your role
            <input
              name="roleA"
              defaultValue={initiator.offer ?? initiator.title}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
            />
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Their role
            <input
              name="roleB"
              defaultValue={recipient.offer ?? recipient.title}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <p className="text-sm text-indigo">
            <span className="font-semibold">Offer specialty</span>
            <span className="mt-1 block font-normal text-muted">{specialtyLabel(offerSpecialty) || "—"}</span>
          </p>
          <p className="text-sm text-indigo">
            <span className="font-semibold">Need specialty</span>
            <span className="mt-1 block font-normal text-muted">{specialtyLabel(needSpecialty) || "—"}</span>
          </p>
        </div>

        <label className="block text-sm font-semibold text-indigo">
          Commercial framing
          <select
            name="commercial"
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
          >
            {choices.map((choice) => (
              <option key={choice}>{choice}</option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" name="intent" value="draft" className="btn-secondary flex-1" disabled={dbError}>
            Save draft
          </button>
          <button
            type="submit"
            name="intent" 
            value="sent"
            className="btn-primary flex-1"
            disabled={dbError || (usage ? !usage.decision.ok : false)}
          >
            Send proposal →
          </button>
        </div>
      </form>
    </div>
  );
}
