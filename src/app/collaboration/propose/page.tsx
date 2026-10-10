import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GuestGateBanner } from "@/components/guest-gate-banner";
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
import { getDirectoryCreator } from "@/lib/directory";
import { consumeGuestQuota } from "@/lib/guest-usage";
import { publicStoredImage, specialtyLabel } from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Propose Collaboration",
};

type Props = {
  searchParams: Promise<{ a?: string; b?: string; from?: string; error?: string; notice?: string }>;
};

async function submitProposal(formData: FormData) {
  "use server";
  const a = String(formData.get("a") ?? "");
  const b = String(formData.get("b") ?? "");
  const from = String(formData.get("from") ?? a);
  const returnTo = `/collaboration/propose?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&from=${encodeURIComponent(from)}`;
  const account = await getAccountSession();
  if (!account) redirect(`/login?next=${encodeURIComponent(returnTo)}&gate=proposal`);

  const creatorA = await getDirectoryCreator(a);
  const creatorB = await getDirectoryCreator(b);
  const viewer = await getDirectoryCreator(from);
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
    why: match?.why ?? "",
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
  const collabOsOffNotice = params.notice === "collab_os_off";
  const returnPath = `/collaboration/propose?a=${encodeURIComponent(params.a ?? "")}&b=${encodeURIComponent(params.b ?? "")}&from=${encodeURIComponent(params.from ?? params.a ?? "")}`;
  const guestGate = await consumeGuestQuota("propose");
  if (guestGate.decision === "hard") {
    redirect(`/login?next=${encodeURIComponent(returnPath)}&gate=proposal`);
  }
  const creatorA = params.a ? await getDirectoryCreator(params.a) : undefined;
  const creatorB = params.b ? await getDirectoryCreator(params.b) : undefined;
  const from = params.from ? await getDirectoryCreator(params.from) : creatorA;

  if (!creatorA || !creatorB || !from) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        {collabOsOffNotice ? (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Collaboration OS hubs are turned off. Propose and records stay available.
          </p>
        ) : null}
        <p className="font-semibold text-indigo">Missing influencers for this proposal.</p>
        <Link href="/collaboration" className="mt-4 inline-block text-violet">
          Back to matches
        </Link>
        <div className="mt-6 flex justify-center gap-4 text-sm">
          <Link href="/collaboration/records" className="font-semibold text-violet hover:underline">
            Contracts &amp; records
          </Link>
          <Link href="/collaboration?landing=1" className="font-semibold text-violet hover:underline">
            Public matches
          </Link>
        </div>
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
      {guestGate.decision === "soft" ? (
        <div className="mb-6 -mx-4 sm:-mx-6">
          <GuestGateBanner copy={guestGate.copy} next={returnPath} />
        </div>
      ) : null}
      <p className="text-xs font-semibold uppercase tracking-wide text-violet">Structured proposal</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Propose a collaboration</h1>
      <p className="mt-2 text-muted">
        Save a draft or send it. The record keeps this match explanation, and the recipient can accept or decline.
      </p>

      <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-white p-4">
        <span className="relative h-14 w-14 overflow-hidden rounded-full bg-gradient-to-br from-[#111A5A] to-[#633CFF]">
          {publicStoredImage(initiator.image) ? (
            <Image src={publicStoredImage(initiator.image)} alt={initiator.displayName} fill className="object-cover" sizes="56px" />
          ) : null}
        </span>
        <div className="text-center text-sm font-bold text-violet">×</div>
        <span className="relative h-14 w-14 overflow-hidden rounded-full bg-gradient-to-br from-[#111A5A] to-[#633CFF]">
          {publicStoredImage(recipient.image) ? (
            <Image src={publicStoredImage(recipient.image)} alt={recipient.displayName} fill className="object-cover" sizes="56px" />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-indigo">
            {initiator.displayName} + {recipient.displayName}
          </p>
          {match ? (
            <p className="text-sm text-muted">
              {match.score}% match
              {match.complementarySpecialties[0]
                ? ` · ${match.complementarySpecialties[0]}`
                : offerSpecialty
                  ? ` · ${specialtyLabel(offerSpecialty)}`
                  : ""}
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
            placeholder="Project title"
            defaultValue=""
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
          />
        </label>

        <label className="block text-sm font-semibold text-indigo">
          What you&apos;ll create together
          <textarea
            name="scope"
            required
            rows={4}
            placeholder="Deliverables and timing"
            defaultValue=""
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-indigo">
            Your role
            <input
              name="roleA"
              placeholder="Your role"
              defaultValue={initiator.offer?.trim() || initiator.title.trim()}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
            />
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Their role
            <input
              name="roleB"
              placeholder="Their role"
              defaultValue={recipient.offer?.trim() || recipient.title.trim()}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
            />
          </label>
        </div>

        {offerSpecialty || needSpecialty ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {offerSpecialty ? (
              <p className="text-sm text-indigo">
                <span className="font-semibold">Offer specialty</span>
                <span className="mt-1 block font-normal text-muted">{specialtyLabel(offerSpecialty)}</span>
              </p>
            ) : null}
            {needSpecialty ? (
              <p className="text-sm text-indigo">
                <span className="font-semibold">Need specialty</span>
                <span className="mt-1 block font-normal text-muted">{specialtyLabel(needSpecialty)}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        <label className="block text-sm font-semibold text-indigo">
          Commercial framing
          <select
            name="commercial"
            required
            defaultValue=""
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
          >
            <option value=""> </option>
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
