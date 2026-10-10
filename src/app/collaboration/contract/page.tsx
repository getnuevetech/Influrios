import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { actionSubmitContractWizard } from "@/app/collaboration/contract/actions";
import { getAccountSession } from "@/lib/accounts";
import { businessEntitlementsForPlan } from "@/lib/entitlements-db";
import { getWorkspace } from "@/lib/business";
import { collabOsV1Enabled } from "@/lib/collab-os";
import { resolveFee, SERVICE_LEVEL_LABELS, SERVICE_LEVELS, type ServiceLevel } from "@/lib/collaboration-fees";
import {
  buildFinancialPlan,
  CONTRACT_WIZARD_STEPS,
  contractWizardFields,
  countryCodeFromLocation,
  customMilestonesGate,
  evaluatePreContractGates,
  isContractWizardStep,
  type ContractWizardStep,
  type MilestoneDraft,
} from "@/lib/contract-wizard";
import { prisma } from "@/lib/db";
import { getDirectoryCreator, listDirectoryCreators } from "@/lib/directory";
import {
  allowedServiceLevels,
  capabilitiesFromJurisdictionRow,
} from "@/lib/jurisdiction-capabilities";
import { buildFeeDisclosureSummary } from "@/lib/fee-disclosure";
import { hasCurrentLegalRecord } from "@/lib/legal";
import { formatMoney } from "@/lib/money";
import { publicStoredImage } from "@/lib/seed-data";
import { ensureMarketplaceDefaults, marketplaceConfig } from "@/lib/marketplace-ledger";
import {
  buildPayoutFeeFxQuote,
  computePayoutReadiness,
  PAYOUT_METHOD_LABELS,
  type PayoutMethod,
} from "@/lib/payout-readiness";
import { collectionPayoutReady, DEFAULT_PAYMENT_ROUTES, paymentRoutes } from "@/lib/providers";
import {
  creatorAmountsForMilestone,
  teamFundingReady,
  teamMemberReadiness,
  wizardParties,
} from "@/lib/team-proposal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contract & Milestone Wizard · Influrios" };

type Props = {
  searchParams: Promise<{
    step?: string;
    creator?: string;
    collaboration?: string;
    team?: string;
    title?: string;
    scope?: string;
    commercial?: string;
    jurisdiction?: string;
    gross?: string;
    serviceLevel?: string;
    mode?: string;
    influencerAccepted?: string;
    accepted?: string;
    feeDisclosure?: string;
    contractDocument?: string;
    error?: string;
  }>;
};

const STEP_LABELS: Record<ContractWizardStep, string> = {
  parties: "Parties",
  scope: "Scope",
  commercial: "Commercial",
  milestones: "Milestones",
  payment_readiness: "Readiness",
  preview: "Preview",
  accept: "Accept",
  funding: "Funding",
};

function dollarsToCents(raw: string) {
  const amount = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

export default async function ContractWizardPage({ searchParams }: Props) {
  if (!(await collabOsV1Enabled().catch(() => true))) {
    redirect("/collaboration/propose?notice=collab_os_off");
  }
  const params = await searchParams;
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    redirect(`/login?next=${encodeURIComponent("/collaboration/contract")}&gate=business`);
  }

  const termsOk = await hasCurrentLegalRecord({
    documentKey: "business-terms",
    userId: account.id,
  }).catch(() => false);
  if (!termsOk) {
    redirect(
      `/collaboration/business?error=${encodeURIComponent("Agree to the Business / Brand Terms before starting a contract.")}`,
    );
  }

  const step: ContractWizardStep = isContractWizardStep(params.step ?? "")
    ? (params.step as ContractWizardStep)
    : "parties";
  const stepIndex = CONTRACT_WIZARD_STEPS.indexOf(step);

  const ws = await getWorkspace(account.id);
  const entitlements = await businessEntitlementsForPlan(ws.plan);
  await ensureMarketplaceDefaults();
  const [config, creators, routes] = await Promise.all([
    marketplaceConfig(),
    listDirectoryCreators().catch(() => []),
    paymentRoutes().catch(() => []),
  ]);

  const collaborationId = (params.collaboration ?? "").trim();
  const linkedCollab = collaborationId
    ? await prisma.collaboration.findUnique({ where: { id: collaborationId } }).catch(() => null)
    : null;

  const creatorSlug =
    (params.creator ?? "").trim() ||
    linkedCollab?.recipientSlug ||
    linkedCollab?.initiatorSlug ||
    "";
  const creator = creatorSlug ? await getDirectoryCreator(creatorSlug) : null;
  const entered = contractWizardFields({
    title: params.title !== undefined ? params.title : linkedCollab?.title,
    scope: params.scope !== undefined ? params.scope : linkedCollab?.scope,
    commercial: params.commercial !== undefined ? params.commercial : linkedCollab?.commercial,
    jurisdiction: params.jurisdiction,
    serviceLevel: params.serviceLevel,
    gross: params.gross,
    creatorCountryCode: countryCodeFromLocation(creator?.locationCountry),
    jurisdictionCodes: config.jurisdictions.map((row) => row.code),
  });
  const title = entered.title;
  const scope = entered.scope;
  const commercial = entered.commercial;
  const jurisdictionCode = entered.jurisdictionCode;
  const serviceLevel = entered.serviceLevel;
  const grossRaw = entered.grossRaw;
  const grossCents = dollarsToCents(grossRaw);
  const usingCustom = params.mode === "custom" && entitlements.customMilestones;
  const influencerAccepted = params.influencerAccepted === "1";
  const partyAccepted = params.accepted === "1";
  const feeDisclosureAccepted = params.feeDisclosure === "1";

  const templates: MilestoneDraft[] = (config.templates ?? [])
    .filter((row) => row.active)
    .map((row) => ({ title: row.title, shareBps: row.shareBps }));
  const customBlank: MilestoneDraft[] = [
    { title: "", shareBps: 0 },
    { title: "", shareBps: 0 },
    { title: "", shareBps: 0 },
    { title: "", shareBps: 0 },
  ];
  const drafts = usingCustom ? customBlank : templates;

  const creatorCountry =
    countryCodeFromLocation(creator?.locationCountry) ??
    (creatorSlug && jurisdictionCode.length === 2 ? jurisdictionCode : null);
  const route = creatorCountry ? routes.find((row) => row.countryCode === creatorCountry) : undefined;
  const dbCreator = creatorSlug
    ? await prisma.creator.findUnique({ where: { slug: creatorSlug } }).catch(() => null)
    : null;
  const identityVerified = dbCreator?.identityVerified === "VERIFIED";
  const payoutReadiness = dbCreator
    ? await computePayoutReadiness({
        creatorId: dbCreator.id,
        identityVerified,
        locationCountry: dbCreator.locationCountry ?? creator?.locationCountry,
      }).catch(() => null)
    : null;

  const jurisdiction = config.jurisdictions.find((row) => row.code === jurisdictionCode);
  const provider =
    config.providers.find((row) => row.code === (jurisdiction?.providerCode || "primary")) ?? config.provider;
  const jurisdictionCaps = jurisdiction ? capabilitiesFromJurisdictionRow(jurisdiction) : null;
  const availableServiceLevels = jurisdictionCaps
    ? (allowedServiceLevels(jurisdictionCaps, SERVICE_LEVELS) as typeof SERVICE_LEVELS[number][])
    : [...SERVICE_LEVELS];
  const effectiveServiceLevel: ServiceLevel | "" =
    availableServiceLevels.find((level) => level === serviceLevel) ?? "";

  const payoutProfile = dbCreator
    ? await prisma.influencerPayoutProfile
        .findUnique({
          where: { creatorId: dbCreator.id },
          select: { stripeConnectAccountId: true, providerConnectedAccountId: true },
        })
        .catch(() => null)
    : null;
  let gates = evaluatePreContractGates({
    businessName: ws.name,
    creatorSlug: creatorSlug || "",
    identityVerified: creatorSlug ? identityVerified : false,
    creatorCountryKnown: Boolean(creatorCountry),
    corridorActive: payoutReadiness ? payoutReadiness.corridorActive : Boolean(creatorCountry),
    paymentRouteReady: collectionPayoutReady({
      providerCode: route?.providerCode,
      routeReady: Boolean(route?.ready),
      stripeConnectAccountId: payoutProfile?.stripeConnectAccountId,
      providerConnectedAccountId: payoutProfile?.providerConnectedAccountId,
    }),
    jurisdictionProtectedPayments: Boolean(jurisdiction?.protectedPaymentsEnabled),
    marketplaceProviderReady: Boolean(provider?.ready),
  });

  const teamId = (params.team ?? "").trim();
  const teamProposal = teamId
    ? await prisma.teamProposal
        .findUnique({
          where: { id: teamId },
          include: { members: { orderBy: { createdAt: "asc" } } },
        })
        .catch(() => null)
    : null;
  const teamParties =
    teamProposal && teamProposal.workspaceId === ws.businessId ? wizardParties(teamProposal) : null;
  const teamChecks = teamParties
    ? await Promise.all(
        teamParties.map((party) =>
          teamMemberReadiness({
            creatorSlug: party.creatorSlug,
            businessName: ws.name,
            jurisdictionProtectedPayments: Boolean(jurisdiction?.protectedPaymentsEnabled),
            marketplaceProviderReady: Boolean(provider?.ready),
          }),
        ),
      )
    : [];
  if (teamProposal && teamProposal.workspaceId === ws.businessId) {
    const ready = teamFundingReady({
      status: teamProposal.status,
      payoutReady: teamChecks.map((check) => check.ready),
    });
    gates = ready.ok
      ? { ok: true, status: "ROUTE_READY" as const, blockers: [] }
      : {
          ok: false,
          status: "ROUTE_BLOCKED" as const,
          blockers: teamParties
            ? teamChecks.flatMap((check) => check.blockers)
            : ["Every creator must accept before the contract opens."],
        };
  }

  const enteredMilestones = drafts.filter((row) => row.title.trim().length > 0 || row.shareBps > 0);
  const milestoneGate = customMilestonesGate({
    entitled: entitlements.customMilestones,
    usingCustom,
    milestones: enteredMilestones,
    influencerAccepted,
  });

  const quote =
    grossCents > 0 && jurisdictionCode && effectiveServiceLevel
      ? await resolveFee({
          jurisdiction: jurisdictionCode,
          serviceLevel: effectiveServiceLevel,
          grossValueCents: grossCents,
        }).catch(() => null)
      : null;

  const plan =
    grossCents > 0 && jurisdictionCode && effectiveServiceLevel && milestoneGate.ok
      ? buildFinancialPlan({
          grossCents,
          currency: jurisdiction?.currency ?? "USD",
          feeRuleId: quote?.rule?.id ?? null,
          feeRuleVersion: quote?.rule?.version ?? null,
          feeMethod: quote?.rule?.method ?? null,
          feePercentBps: quote?.rule?.percentBps ?? null,
          feeFixedCents: quote?.rule?.fixedCents ?? null,
          totalPlatformFeeCents: quote?.feeCents ?? 0,
          feePayer: quote?.rule?.payer ?? "brand",
          fundingCountry: jurisdictionCode,
          creatorCountry: creatorCountry ?? jurisdictionCode,
          payoutCurrency: jurisdiction?.currency ?? "USD",
          milestones: enteredMilestones,
          milestoneSource: usingCustom ? "custom" : "template",
        })
      : null;

  const payoutCurrency =
    (payoutReadiness?.countryCode
      ? DEFAULT_PAYMENT_ROUTES.find((row) => row.countryCode === payoutReadiness.countryCode)?.currency
      : null) ??
    plan?.payoutCurrency ??
    jurisdiction?.currency ??
    "USD";
  const feeFxQuote = plan
    ? buildPayoutFeeFxQuote({
        creatorGrossCents: plan.grossContractValueCents,
        platformFeeCents: plan.totalPlatformFeeCents,
        fundingCurrency: plan.contractCurrency,
        payoutCurrency,
      })
    : null;

  const shortlisted = ws.shortlist
    .map((item) => creators.find((c) => c.slug === item.creatorSlug))
    .filter(Boolean);
  const influencerOptions = (shortlisted.length ? shortlisted : creators.filter((c) => c.openToCollab).slice(0, 40)).filter(
    Boolean,
  );

  return (
    <div className="bg-[#F4F7FF]">
      <section className="border-b border-[#E4E9F5] bg-gradient-to-r from-[#EEF5FF] via-white to-[#F7F4FF]">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet">
            Contract & milestone wizard
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-indigo">Form the collaboration</h1>
          <p className="mt-2 text-sm text-muted">
            Parties → scope → commercial → milestones → payment readiness → preview → accept → funding.
            Custom milestones need Business Pro/Agency and influencer accept.
          </p>
          <Link href="/collaboration/business" className="mt-2 inline-flex text-xs font-bold text-violet hover:underline">
            ← Business Hub
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <ol className="mb-6 flex flex-wrap gap-1.5">
          {CONTRACT_WIZARD_STEPS.map((key, index) => (
            <li
              key={key}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                index <= stepIndex ? "bg-violet text-white" : "border border-[#E4E9F5] bg-white text-muted"
              }`}
            >
              {index + 1}. {STEP_LABELS[key]}
            </li>
          ))}
        </ol>

        {params.error ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {params.error}
          </p>
        ) : null}

        <form action={actionSubmitContractWizard} className="space-y-8 rounded-2xl border border-[#E4E9F5] bg-white p-6 shadow-sm">
          <input type="hidden" name="businessName" value={ws.name} />
          {linkedCollab ? <input type="hidden" name="collaborationId" value={linkedCollab.id} /> : null}
          {teamProposal && teamProposal.workspaceId === ws.businessId ? (
            <input type="hidden" name="teamProposalId" value={teamProposal.id} />
          ) : null}
          {params.contractDocument ? (
            <input type="hidden" name="contractDocumentId" value={params.contractDocument} />
          ) : null}

          <section id="parties">
            <h2 className="font-display text-xl font-bold text-indigo">1. Parties</h2>
            <p className="mt-1 text-sm text-muted">
              Business: <strong>{ws.name}</strong> · plan {ws.plan.replace(/_/g, " ")}
            </p>
            {teamProposal && teamProposal.workspaceId === ws.businessId ? (
              <div className="mt-4">
                <input type="hidden" name="creatorSlug" value={teamProposal.members[0]?.creatorSlug ?? ""} />
                <p className="text-sm font-semibold text-indigo">Team</p>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {teamProposal.members.map((party) => (
                    <li key={party.creatorSlug}>
                      {party.creatorSlug} · {party.status} · {(party.shareBps / 100).toFixed(2)}% of creator compensation
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">
                  {teamParties
                    ? "One funding instruction. Each milestone release pays every creator the share saved on the proposal."
                    : "The contract opens after every creator accepts. A decline closes this proposal."}
                </p>
              </div>
            ) : (
            <label className="mt-4 block text-sm font-semibold text-indigo">
              Influencer
              <select
                name="creatorSlug"
                required
                defaultValue={creatorSlug}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
              >
                <option value="">Select influencer…</option>
                {influencerOptions.map((c) =>
                  c ? (
                    <option key={c.slug} value={c.slug}>
                      {c.displayName}
                    {[c.locationCity, c.locationCountry].filter(Boolean).length
                      ? ` · ${[c.locationCity, c.locationCountry].filter(Boolean).join(", ")}`
                      : ""}
                    </option>
                  ) : null,
                )}
              </select>
            </label>
            )}
            {creator ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#F4F7FF] p-3">
                <span className="relative h-12 w-12 overflow-hidden rounded-full bg-gradient-to-br from-[#111A5A] to-[#633CFF]">
                  {publicStoredImage(creator.image) ? (
                    <Image src={publicStoredImage(creator.image)} alt="" fill className="object-cover" sizes="48px" />
                  ) : null}
                </span>
                <div>
                  <p className="text-sm font-bold text-indigo">{creator.displayName}</p>
                  <p className="text-xs text-muted">
                    {identityVerified ? "Identity verified" : "Identity not verified"} ·{" "}
                    {creatorCountry ?? "country unknown"}
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          <section id="scope">
            <h2 className="font-display text-xl font-bold text-indigo">2. Scope</h2>
            <label className="mt-4 block text-sm font-semibold text-indigo">
              Campaign title
              <input
                name="title"
                required
                placeholder="Campaign title"
                defaultValue={title}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-indigo">
              Deliverables, channels, usage & revisions
              <textarea
                name="scope"
                required
                rows={4}
                placeholder="Deliverables, channels, and revisions"
                defaultValue={scope}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
              />
            </label>
          </section>

          <section id="commercial">
            <h2 className="font-display text-xl font-bold text-indigo">3. Commercial terms</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-indigo">
                Gross value (USD)
                <input
                  name="grossUsd"
                  required
                  placeholder="Amount"
                  defaultValue={grossRaw}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
                />
              </label>
              <label className="block text-sm font-semibold text-indigo">
                Jurisdiction
                <select
                  name="jurisdictionCode"
                  required
                  defaultValue={jurisdictionCode}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
                >
                  <option value=""> </option>
                  {config.jurisdictions.map((row) => (
                    <option key={row.code} value={row.code}>
                      {row.label} ({row.currency})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-indigo sm:col-span-2">
                Collaboration service level
                <select
                  name="serviceLevel"
                  required
                  defaultValue={effectiveServiceLevel}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
                >
                  <option value=""> </option>
                  {availableServiceLevels.map((level) => (
                    <option key={level} value={level}>
                      {SERVICE_LEVEL_LABELS[level]}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-muted">
                  Affects fee matrix, legal treatment, and jurisdiction availability.
                  {jurisdictionCaps?.legalReviewStatus && jurisdictionCaps.legalReviewStatus !== "APPROVED"
                    ? ` Legal review: ${jurisdictionCaps.legalReviewStatus}.`
                    : ""}
                  {jurisdictionCaps && !jurisdictionCaps.managedIntroductionEnabled
                    ? " Managed introduction is off until admin enables it."
                    : ""}
                </span>
              </label>
              <label className="block text-sm font-semibold text-indigo sm:col-span-2">
                Commercial framing
                <input
                  name="commercial"
                  defaultValue={commercial}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
                />
              </label>
            </div>
          </section>

          <section id="milestones">
            <h2 className="font-display text-xl font-bold text-indigo">4. Milestones</h2>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2 font-semibold text-indigo">
                <input type="radio" name="milestoneMode" value="template" defaultChecked={!usingCustom} />
                Admin templates
              </label>
              <label
                className={`inline-flex items-center gap-2 font-semibold ${
                  entitlements.customMilestones ? "text-indigo" : "text-muted"
                }`}
              >
                <input
                  type="radio"
                  name="milestoneMode"
                  value="custom"
                  defaultChecked={usingCustom}
                  disabled={!entitlements.customMilestones}
                />
                Custom schedule{!entitlements.customMilestones ? " (Pro/Agency)" : ""}
              </label>
            </div>
            <ul className="mt-4 space-y-2">
              {drafts.map((row, index) => (
                <li key={`${row.title}-${index}`} className="grid grid-cols-[1fr_88px] gap-2">
                  <input
                    name="milestoneTitle"
                    defaultValue={row.title}
                    className="rounded-xl border border-border px-3 py-2 text-sm"
                  />
                  <input
                    name="milestonePercent"
                    defaultValue={row.shareBps > 0 ? (row.shareBps / 100).toFixed(0) : ""}
                    aria-label="Percent"
                    className="rounded-xl border border-border px-3 py-2 text-sm"
                  />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              {drafts.some((row) => row.title.trim())
                ? "Percents must total 100. Last share absorbs rounding."
                : usingCustom
                  ? "Enter the milestone titles and percents. Blank rows are left out."
                  : "No milestone templates are saved."}
            </p>
            {entitlements.customMilestones ? (
              <label className="mt-4 flex items-start gap-2 text-sm text-indigo">
                <input
                  type="checkbox"
                  name="influencerAccepted"
                  defaultChecked={influencerAccepted}
                  className="mt-0.5 accent-violet"
                />
                <span>Influencer accepted this custom milestone schedule (required when using custom).</span>
              </label>
            ) : null}
            {!milestoneGate.ok ? (
              <p className="mt-3 text-sm font-semibold text-amber-800">{milestoneGate.error}</p>
            ) : null}
          </section>

          <section id="payment_readiness">
            <h2 className="font-display text-xl font-bold text-indigo">5. Payment readiness</h2>
            <p className="mt-1 text-sm text-muted">
              Status:{" "}
              <strong className={gates.ok ? "text-emerald-700" : "text-amber-800"}>{gates.status}</strong>
              {payoutReadiness ? (
                <>
                  {" "}
                  · Global Payout Ready:{" "}
                  <strong className={payoutReadiness.globalPayoutReady ? "text-emerald-700" : "text-amber-800"}>
                    {payoutReadiness.globalPayoutReady ? "yes" : "not yet"}
                  </strong>
                </>
              ) : null}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              <li>Identity: {creatorSlug ? (identityVerified ? "verified" : "not verified") : "select influencer"}</li>
              <li>Payout country: {creatorCountry ?? "unknown"}</li>
              <li>
                Corridor:{" "}
                {payoutReadiness
                  ? payoutReadiness.corridorActive
                    ? "activated"
                    : "not activated"
                  : creatorCountry
                    ? "checking…"
                    : "unknown"}
              </li>
              <li>
                Payment route:{" "}
                {route?.ready ? `ready (${route.providerName})` : route ? route.reason.replace(/_/g, " ") : "no route"}
              </li>
              <li>
                Payout method:{" "}
                {payoutReadiness?.primaryMethod
                  ? `${PAYOUT_METHOD_LABELS[payoutReadiness.primaryMethod as PayoutMethod] ?? payoutReadiness.primaryMethod} (${payoutReadiness.primaryStatus})`
                  : "—"}
              </li>
              <li>Jurisdiction protected payments: {jurisdiction?.protectedPaymentsEnabled ? "on" : "off"}</li>
              <li>
                Legal review: {jurisdictionCaps?.legalReviewStatus ?? "—"}
                {jurisdictionCaps?.fullPrefundingEnabled ? " · full funding" : ""}
                {jurisdictionCaps?.managedIntroductionEnabled ? " · managed intro" : ""}
                {jurisdictionCaps?.managedNegotiationEnabled ? " · managed campaign" : ""}
              </li>
              <li>Marketplace provider: {provider?.ready ? "ready" : "not ready"}</li>
            </ul>
            {!gates.ok ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm font-semibold text-amber-900">
                {gates.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm font-semibold text-emerald-800">ROUTE_READY — funding is allowed.</p>
            )}
            {payoutReadiness && !payoutReadiness.globalPayoutReady ? (
              <p className="mt-2 text-xs text-muted">
                Funding can proceed when ROUTE_READY. Global Payout Ready still needs a verified payout method
                before the influencer can withdraw released balance.
              </p>
            ) : null}
          </section>

          <section id="preview">
            <h2 className="font-display text-xl font-bold text-indigo">6. Contract preview</h2>
            {plan ? (
              <>
                <p className="mt-1 text-sm text-muted">
                  Service level{" "}
                  <strong>
                    {effectiveServiceLevel ? SERVICE_LEVEL_LABELS[effectiveServiceLevel] : ""}
                  </strong>
                  {quote?.rule?.feeType ? (
                    <>
                      {" "}
                      · fee type <strong>{quote.rule.feeType}</strong>
                    </>
                  ) : null}{" "}
                  · rule {plan.feeRuleId ?? "none"} v{plan.feeRuleVersion ?? "—"} freezes on funding.
                  Later fee rule edits do not change locked deals.
                </p>
                {quote?.explanation ? <p className="mt-2 text-xs text-muted">{quote.explanation}</p> : null}
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Gross</dt>
                    <dd className="font-bold text-indigo">
                      {formatMoney(plan.grossContractValueCents, plan.contractCurrency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Platform fee</dt>
                    <dd className="font-bold text-indigo">
                      {formatMoney(plan.totalPlatformFeeCents, plan.contractCurrency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Influencer compensation</dt>
                    <dd className="font-bold text-indigo">
                      {formatMoney(plan.totalCreatorCompensationCents, plan.contractCurrency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Expected payout currency</dt>
                    <dd className="font-bold text-indigo">{payoutCurrency}</dd>
                  </div>
                </dl>
                {feeFxQuote?.ok ? (
                  <p className="mt-3 rounded-xl bg-[#F4F7FF] px-3 py-2 text-xs text-indigo">
                    Fee/FX before confirm: net{" "}
                    {formatMoney(feeFxQuote.quote.creatorNetCents, feeFxQuote.quote.fundingCurrency)}
                    {feeFxQuote.quote.fxApplied
                      ? ` → ≈ ${feeFxQuote.quote.payoutMinor} ${feeFxQuote.quote.payoutCurrency} minor (${feeFxQuote.quote.fxSource} FX)`
                      : " (no FX)"}
                    . Exact quote is shown again at payout.
                  </p>
                ) : feeFxQuote && !feeFxQuote.ok ? (
                  <p className="mt-3 text-xs text-amber-800">
                    Fee/FX estimate unavailable: {feeFxQuote.error}
                  </p>
                ) : null}
                <ul className="mt-4 space-y-2">
                  {plan.milestones.map((m) => {
                    const creatorShares = teamParties
                      ? creatorAmountsForMilestone(m.creatorCents, teamParties)
                      : null;
                    return (
                    <li
                      key={m.title}
                      className="rounded-xl bg-[#F4F7FF] px-3 py-2 text-sm"
                    >
                      <div className="flex justify-between gap-3">
                        <span className="font-semibold text-indigo">
                          {m.title} · {(m.shareBps / 100).toFixed(0)}%
                        </span>
                        <span className="text-muted">
                          {formatMoney(m.grossCents, plan.contractCurrency)} (fee{" "}
                          {formatMoney(m.platformFeeCents, plan.contractCurrency)})
                        </span>
                      </div>
                      {creatorShares ? (
                        <ul className="mt-1 text-xs text-muted">
                          {creatorShares.map((share) => (
                            <li key={share.creatorSlug}>
                              {share.creatorSlug} · {formatMoney(share.amountCents, plan.contractCurrency)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">Complete parties, commercial terms, and valid milestones to preview.</p>
            )}
          </section>

          <section id="accept">
            <h2 className="font-display text-xl font-bold text-indigo">7. Accept & funding instruction</h2>
            {quote && plan ? (
              <div className="mt-3 rounded-xl border border-border bg-[#F7FAFF] px-4 py-3 text-sm text-indigo">
                <p className="font-semibold">Fee disclosure</p>
                <p className="mt-1 text-xs text-muted">
                  {buildFeeDisclosureSummary({
                    feeCents: quote.feeCents,
                    ruleId: quote.rule?.id ?? null,
                    ruleName: quote.rule?.name ?? null,
                    ruleVersion: quote.rule?.version ?? null,
                    feeType: quote.rule?.feeType ?? null,
                    method: quote.rule?.method ?? null,
                    percentBps: quote.rule?.percentBps ?? null,
                    fixedCents: quote.rule?.fixedCents ?? null,
                    payer: quote.rule?.payer ?? null,
                    jurisdiction: jurisdictionCode,
                    serviceLevel: effectiveServiceLevel,
                    grossCents,
                    explanation: quote.explanation,
                  })}
                </p>
                <p className="mt-2 text-xs text-muted">
                  Legal pack references this live fee snapshot — not a hard-coded percentage. See{" "}
                  <Link href="/legal/marketplace-terms" className="font-semibold text-violet hover:underline" target="_blank">
                    Marketplace Terms
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/legal/protected-payments-policy"
                    className="font-semibold text-violet hover:underline"
                    target="_blank"
                  >
                    Protected Payments Policy
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Preview a fee quote before accepting the disclosure.</p>
            )}
            <label className="mt-3 flex items-start gap-2 text-sm text-indigo">
              <input
                type="checkbox"
                name="feeDisclosureAccepted"
                defaultChecked={feeDisclosureAccepted}
                className="mt-0.5 accent-violet"
              />
              <span>
                I accept this fee disclosure. The quoted fee rule version and calculated fee will freeze into the deal
                snapshot on funding.
              </span>
            </label>
            <label className="mt-3 flex items-start gap-2 text-sm text-indigo">
              <input
                type="checkbox"
                name="partyAccepted"
                defaultChecked={partyAccepted}
                className="mt-0.5 accent-violet"
              />
              <span>
                I accept this financial plan on behalf of {ws.name}. This checkbox does not sign the agreement. Funding
                freezes the fee rule version after DocuSign reports every party complete.
              </span>
            </label>
            <p className="mt-3 text-sm text-muted">
              The agreement is signed when DocuSign reports every party complete. Until then it stays unsigned, and
              funding does not start. The PDF is stored on each party&apos;s account.
            </p>
          </section>

          <div className="flex flex-col gap-3 border-t border-[#E4E9F5] pt-4 sm:flex-row">
            <button type="submit" name="intent" value="preview" className="btn-secondary flex-1">
              Refresh preview
            </button>
            <button type="submit" name="intent" value="sign" className="btn-secondary flex-1">
              Send for signature
            </button>
            <button type="submit" name="intent" value="fund" className="btn-primary flex-1">
              Request funding →
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          After funding is requested, manage milestones on{" "}
          <Link href="/payments" className="font-semibold text-violet hover:underline">
            Protected Payments
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
