import Image from "next/image";
import { ContractInfluencerField } from "@/components/contract-influencer-field";
import { ContractMilestones } from "@/components/contract-milestones";
import Link from "next/link";
import { redirect } from "next/navigation";
import { actionSubmitContractWizard } from "@/app/collaboration/contract/actions";
import { requireBusinessSession } from "@/lib/account-audience";
import { businessEntitlementsForPlan } from "@/lib/entitlements-db";
import { getWorkspace, type CampaignBrief } from "@/lib/business";
import { contractTermsFromRequest, preferContractField } from "@/lib/campaign-contract";
import { collabOsV1Enabled } from "@/lib/collab-os";
import { feeRuleRateLabel, SERVICE_LEVEL_LABELS, SERVICE_LEVELS, type ServiceLevel } from "@/lib/collaboration-fees";
import { ContractServiceLevelField } from "@/components/contract-service-level-field";
import { disclosureFromDualQuote, resolveAllInBudget, resolveDualPlatformFees } from "@/lib/dual-platform-fees";
import {
  buildFinancialPlan,
  CONTRACT_WIZARD_STEPS,
  contractWizardFields,
  countryCodeFromLocation,
  customMilestonesGate,
  evaluatePreContractGates,
  isContractWizardStep,
  marketplaceProviderGateMessage,
  type ContractWizardStep,
  type MilestoneDraft,
} from "@/lib/contract-wizard";
import { findLiveContractForDeal, signatureSendBlocked } from "@/lib/contract-document";
import { isFundableServiceLevel, signedAgreementFundingLevel } from "@/lib/matching-product-boundary";
import { storedPayoutMethodList } from "@/lib/corridor-checkout";
import { prisma } from "@/lib/db";
import { getLaunchGate } from "@/lib/launch-gate";
import { getDirectoryCreator, listDirectoryCreators } from "@/lib/directory";
import { resolveCreatorIdentityVerified } from "@/lib/kyc-document";
import {
  allowedServiceLevels,
  capabilitiesFromJurisdictionRow,
} from "@/lib/jurisdiction-capabilities";
import { buildFeeDisclosureSummary } from "@/lib/fee-disclosure";
import { hasCurrentLegalRecord } from "@/lib/legal";
import { formatMoney } from "@/lib/money";
import { publicStoredImage } from "@/lib/seed-data";
import { ensureMarketplaceDefaults, marketplaceConfig } from "@/lib/marketplace-ledger";
import { acceptedContractChoices, applicationForContract, listWorkspaceBusinessRequests } from "@/lib/marketplace-listings";
import {
  buildPayoutFeeFxQuote,
  computePayoutReadiness,
  PAYOUT_METHOD_LABELS,
  PAYOUT_METHODS,
  payoutCurrencyForCountry,
  type PayoutMethod,
} from "@/lib/payout-readiness";
import {
  collectionPayoutBlocker,
  collectionPayoutReady,
  paymentRoutes,
  providerNeedsConnectedAccount,
} from "@/lib/providers";
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
    application?: string;
    team?: string;
    brief?: string;
    title?: string;
    scope?: string;
    commercial?: string;
    jurisdiction?: string;
    gross?: string;
    amountMode?: string;
    currency?: string;
    serviceLevel?: string;
    mode?: string;
    influencerAccepted?: string;
    accepted?: string;
    feeDisclosure?: string;
    contractDocument?: string;
    payoutMethod?: string;
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
  /** Creators must never enter this wizard — bounce to influencer home, not business terms. */
  const account = await requireBusinessSession("/collaboration/contract");

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
  const [config, creators, routes, corridors] = await Promise.all([
    marketplaceConfig(),
    listDirectoryCreators().catch(() => []),
    paymentRoutes().catch(() => []),
    prisma.countryActivationCorridor.findMany({ orderBy: { countryCode: "asc" } }).catch(() => []),
  ]);
  const payoutChoices = corridors.flatMap((row) =>
    storedPayoutMethodList(row.payoutMethodsJson).map((method) => ({
      countryCode: row.countryCode,
      method,
      label: (PAYOUT_METHODS as readonly string[]).includes(method)
        ? PAYOUT_METHOD_LABELS[method as PayoutMethod]
        : method,
    })),
  );

  const collaborationId = (params.collaboration ?? "").trim();
  const requestedApplicationId = (params.application ?? "").trim();
  const linkedCollab = collaborationId
    ? await prisma.collaboration.findUnique({ where: { id: collaborationId } }).catch(() => null)
    : null;
  const ownedRequests = await listWorkspaceBusinessRequests(ws.businessId).catch(() => []);
  const creatorHint =
    (params.creator ?? "").trim() || linkedCollab?.recipientSlug || linkedCollab?.initiatorSlug || "";
  const ownedRequestIds = ownedRequests.map((row) => row.id);
  const ownedBriefIds = ws.briefs.map((brief) => brief.id);
  const source = await applicationForContract({
    applicationId: requestedApplicationId,
    creatorSlug: creatorHint,
    businessRequestIds: ownedRequestIds,
    briefIds: ownedBriefIds,
  }).catch(() => null);
  const acceptedChoices = await acceptedContractChoices({
    creatorSlug: creatorHint || source?.creatorSlug || "",
    businessRequestIds: ownedRequestIds,
    briefIds: ownedBriefIds,
  }).catch(() => []);
  const applicationId = source?.id || requestedApplicationId;

  const briefId = (params.brief ?? "").trim() || source?.briefId || source?.requestBriefId || "";
  const briefRow = briefId
    ? await prisma.businessBrief
        .findFirst({ where: { id: briefId, workspaceId: ws.businessId } })
        .catch(() => null)
    : null;
  const campaignBrief: CampaignBrief | null = briefRow
    ? {
        id: briefRow.id,
        title: briefRow.title,
        goal: briefRow.goal,
        specialty: briefRow.specialty,
        budget: briefRow.budget,
        budgetCurrency: briefRow.budgetCurrency,
        collabType: briefRow.collabType,
        timeframe: briefRow.timeframe,
        location: briefRow.location,
        platform: briefRow.platform,
        summary: briefRow.summary,
        deliverables: briefRow.deliverables,
        responseDeadline: briefRow.responseDeadline ? briefRow.responseDeadline.toISOString().slice(0, 10) : null,
        createdAt: briefRow.createdAt.toISOString(),
        status: briefRow.status === "closed" || briefRow.status === "draft" ? briefRow.status : "active",
      }
    : null;
  const carried = contractTermsFromRequest({
    brief: campaignBrief,
    title: source?.requestBrand,
    summary: source?.requestSummary,
    deliverables: source?.deliverables || source?.requestDeliverables,
    offerText: source?.offerText,
    budget: source?.requestBudget,
    currency: source?.requestCurrency,
  });
  const campaignCurrency = ((params.currency ?? "").trim() || carried.currency).toUpperCase();
  const shownCurrency = /^[A-Z]{3}$/.test(campaignCurrency) ? campaignCurrency : "";
  const fromCampaign = Boolean(carried.title || carried.scope || carried.gross);

  const creatorSlug = creatorHint || source?.creatorSlug || "";
  const creator = creatorSlug ? await getDirectoryCreator(creatorSlug) : null;
  const entered = contractWizardFields({
    title: preferContractField(params.title, carried.title || linkedCollab?.title || ""),
    scope: preferContractField(params.scope, carried.scope || linkedCollab?.scope || ""),
    commercial: preferContractField(params.commercial, carried.commercial || linkedCollab?.commercial || ""),
    jurisdiction: params.jurisdiction,
    serviceLevel: params.serviceLevel,
    gross: preferContractField(params.gross, carried.gross),
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
  const fundingSwitches = await getLaunchGate().catch(() => null);
  const allInAllowed = fundingSwitches?.allInBudgetEntryEnabled === true;
  const amountMode = allInAllowed && params.amountMode === "all_in" ? "all_in" : "gross";
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
  const identityVerified = dbCreator
    ? await resolveCreatorIdentityVerified({
        creatorId: dbCreator.id,
        creatorSlug: dbCreator.slug,
        identityVerified: dbCreator.identityVerified,
      }).catch(() => dbCreator.identityVerified === "VERIFIED")
    : false;
  const payoutReadiness = dbCreator
    ? await computePayoutReadiness({
        creatorId: dbCreator.id,
        identityVerified,
        locationCountry: dbCreator.locationCountry ?? creator?.locationCountry,
      }).catch(() => null)
    : null;

  const jurisdiction = config.jurisdictions.find((row) => row.code === jurisdictionCode);
  const assignedProviderCode = jurisdiction?.providerCode || "primary";
  const provider =
    config.providers.find((row) => row.code === assignedProviderCode) ??
    (assignedProviderCode === "primary" ? config.provider : null);
  const marketplaceGate = marketplaceProviderGateMessage(provider, assignedProviderCode);
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
  const routeGateInput = {
    providerCode: route?.providerCode,
    providerName: route?.providerName,
    routeReady: Boolean(route?.ready),
    stripeConnectAccountId: payoutProfile?.stripeConnectAccountId,
    providerConnectedAccountId: payoutProfile?.providerConnectedAccountId,
  };
  const paymentRouteBlocker = collectionPayoutBlocker(routeGateInput);
  const influencerAccountConnected = providerNeedsConnectedAccount(route?.providerCode)
    ? Boolean(payoutProfile?.providerConnectedAccountId?.trim())
    : (route?.providerCode ?? "").toLowerCase() === "stripe"
      ? Boolean(payoutProfile?.stripeConnectAccountId?.trim())
      : null;
  let gates = evaluatePreContractGates({
    businessName: ws.name,
    creatorSlug: creatorSlug || "",
    identityVerified: creatorSlug ? identityVerified : false,
    creatorCountryKnown: Boolean(creatorCountry),
    corridorActive: payoutReadiness ? payoutReadiness.corridorActive : Boolean(creatorCountry),
    paymentRouteReady: collectionPayoutReady(routeGateInput),
    paymentRouteBlocker,
    jurisdictionProtectedPayments: Boolean(jurisdiction?.protectedPaymentsEnabled),
    marketplaceProviderReady: marketplaceGate.ready,
    marketplaceProviderBlocker: marketplaceGate.ready ? null : marketplaceGate.blocker,
  });

  const teamId = (params.team ?? "").trim();
  const existingContract = await findLiveContractForDeal({
    applicationId,
    collaborationId: linkedCollab?.id,
    teamProposalId: teamId,
  }).catch(() => null);
  const sendBlocked = signatureSendBlocked(existingContract);
  const signedFundingLevel =
    existingContract?.status === "signed" && !isFundableServiceLevel(effectiveServiceLevel)
      ? signedAgreementFundingLevel(effectiveServiceLevel || serviceLevel)
      : "";
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
            marketplaceProviderReady: marketplaceGate.ready,
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
      ? amountMode === "all_in"
        ? await resolveAllInBudget(
            { jurisdiction: jurisdictionCode, serviceLevel: effectiveServiceLevel },
            grossCents,
          ).catch(() => null)
        : await resolveDualPlatformFees({
            jurisdiction: jurisdictionCode,
            serviceLevel: effectiveServiceLevel,
            grossValueCents: grossCents,
          }).catch(() => null)
      : null;

  const plan =
    quote?.ok && jurisdictionCode && effectiveServiceLevel && milestoneGate.ok
      ? buildFinancialPlan({
          grossCents: quote.grossInfluencerCompensationCents,
          currency: jurisdiction?.currency,
          feeRuleId: quote.business.rule.id,
          feeRuleVersion: quote.business.rule.version,
          feeMethod: quote.business.rule.method,
          feePercentBps: quote.business.rule.percentBps,
          feeFixedCents: quote.business.rule.fixedCents,
          totalPlatformFeeCents: quote.platformFeesTotalCents,
          businessPlatformFeeCents: quote.businessPlatformFeeCents,
          influencerPlatformFeeCents: quote.influencerPlatformFeeCents,
          businessPaysCents: quote.businessPaysCents,
          feeReservation: quote.reservation,
          feePayer: "both",
          fundingCountry: jurisdictionCode,
          creatorCountry: creatorCountry ?? jurisdictionCode,
          payoutCurrency: jurisdiction?.currency,
          milestones: enteredMilestones,
          milestoneSource: usingCustom ? "custom" : "template",
        })
      : null;

  const routeCurrency = payoutCurrencyForCountry(payoutReadiness?.countryCode) ?? "";
  const payoutCurrency = (routeCurrency || plan?.payoutCurrency || jurisdiction?.currency || "").trim().toUpperCase();
  const feeFxQuote =
    plan && /^[A-Z]{3}$/.test(payoutCurrency)
      ? buildPayoutFeeFxQuote({
          creatorGrossCents: plan.grossContractValueCents,
          platformFeeCents: plan.influencerPlatformFeeCents ?? plan.totalPlatformFeeCents,
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
        {fromCampaign ? (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            “{campaignBrief?.title || title}” is already filled in
            {shownCurrency ? `, including the ${shownCurrency} value` : ""}. Add anything the agreement still needs.
          </p>
        ) : null}

        <form action={actionSubmitContractWizard} className="space-y-8 rounded-2xl border border-[#E4E9F5] bg-white p-6 shadow-sm">
          <input type="hidden" name="businessName" value={ws.name} />
          {campaignBrief ? <input type="hidden" name="briefId" value={campaignBrief.id} /> : null}
          {shownCurrency ? <input type="hidden" name="contractCurrency" value={shownCurrency} /> : null}
          {linkedCollab ? <input type="hidden" name="collaborationId" value={linkedCollab.id} /> : null}
          {applicationId ? <input type="hidden" name="applicationId" value={applicationId} /> : null}
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
            <ContractInfluencerField
              creatorSlug={creatorSlug}
              applicationId={applicationId}
              options={influencerOptions.flatMap((creator) =>
                creator
                  ? [
                      {
                        slug: creator.slug,
                        label: [
                          creator.displayName,
                          [creator.locationCity, creator.locationCountry].filter(Boolean).join(", "),
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      },
                    ]
                  : [],
              )}
              requests={acceptedChoices.map((choice) => ({
                id: choice.id,
                title:
                  ws.briefs.find((brief) => brief.id === (choice.briefId || choice.requestBriefId))?.title ||
                  choice.requestBrand ||
                  "Accepted request",
              }))}
            />
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
            {fromCampaign ? (
              <p className="mt-1 text-xs text-muted">Carried over from the accepted campaign intent.</p>
            ) : null}
            <label className="mt-4 block text-sm font-semibold text-indigo">
              Campaign title
              <input
                name="title"
                required
                placeholder="Campaign title"
                defaultValue={title}
                className={`mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet ${carried.title ? "bg-[#F4F7FF] text-indigo" : ""}`}
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
                className={`mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet ${carried.scope ? "bg-[#F4F7FF] text-indigo" : ""}`}
              />
            </label>
          </section>

          <section id="commercial">
            <h2 className="font-display text-xl font-bold text-indigo">3. Commercial terms</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-indigo">
                {amountMode === "all_in" ? "All-in budget" : "Gross influencer compensation"}
                {shownCurrency ? ` (${shownCurrency})` : ""}
                {allInAllowed ? (
                  <select name="amountInputMode" defaultValue={amountMode} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal">
                    <option value="gross">Gross influencer compensation</option>
                    <option value="all_in">All-in budget</option>
                  </select>
                ) : (
                  <input type="hidden" name="amountInputMode" value="gross" />
                )}
                <input
                  name="grossUsd"
                  required
                  placeholder="Amount"
                  defaultValue={grossRaw}
                  className={`mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet ${carried.gross ? "bg-[#F4F7FF] text-indigo" : ""}`}
                />
                <span className="mt-1 block text-xs font-normal text-muted">
                  {amountMode === "all_in"
                    ? "What the business pays before tax. The quote solves for gross influencer compensation."
                    : "The influencer amount before the influencer platform fee. The quote adds the business platform fee on top."}
                </span>
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
                Payout method
                <select
                  name="payoutMethod"
                  defaultValue={params.payoutMethod ?? ""}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
                >
                  <option value=""> </option>
                  {payoutChoices.map((choice) => (
                    <option key={`${choice.countryCode}:${choice.method}`} value={choice.method}>
                      {choice.countryCode} · {choice.label}
                    </option>
                  ))}
                </select>
              </label>
              <ContractServiceLevelField
                value={signedFundingLevel || effectiveServiceLevel}
                options={(signedFundingLevel && !availableServiceLevels.includes(signedFundingLevel)
                  ? [signedFundingLevel, ...availableServiceLevels]
                  : availableServiceLevels
                ).map((level) => ({ value: level, label: SERVICE_LEVEL_LABELS[level] ?? level }))}
                hint={
                  (availableServiceLevels.length === 0
                    ? "No service level is available because this jurisdiction is blocked pending legal review."
                    : signedFundingLevel
                    ? "This agreement is already signed, so funding uses a contracted service level."
                    : "This choice selects the business fee rule and the influencer fee rule saved in Collaboration fees.") +
                  (jurisdictionCaps?.legalReviewStatus && jurisdictionCaps.legalReviewStatus !== "APPROVED"
                    ? ` Legal review: ${jurisdictionCaps.legalReviewStatus}.`
                    : "") +
                  (jurisdictionCaps && !jurisdictionCaps.managedIntroductionEnabled
                    ? " Managed introduction is off until admin enables it."
                    : "")
                }
              />
              <div className="sm:col-span-2 rounded-xl border border-[#E4E9F5] bg-[#F7FAFF] px-4 py-3 text-sm">
                <p className="font-semibold text-indigo">Fee breakdown for this service level</p>
                {quote?.ok && plan ? (
                  <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted">Business rule</dt>
                      <dd className="font-semibold text-indigo">{quote.business.rule.name} · v{quote.business.rule.version}</dd>
                      <dd className="text-xs text-muted">{feeRuleRateLabel(quote.business.rule)} · {formatMoney(quote.businessPlatformFeeCents, plan.contractCurrency)} added on top</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Influencer rule</dt>
                      <dd className="font-semibold text-indigo">{quote.influencer.rule.name} · v{quote.influencer.rule.version}</dd>
                      <dd className="text-xs text-muted">{feeRuleRateLabel(quote.influencer.rule)} · {formatMoney(quote.influencerPlatformFeeCents, plan.contractCurrency)} deducted from the gross</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Business pays</dt>
                      <dd className="font-bold text-indigo">{formatMoney(quote.businessPaysCents, plan.contractCurrency)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Influencer receives</dt>
                      <dd className="font-bold text-indigo">{formatMoney(quote.influencerReceivesCents, plan.contractCurrency)}</dd>
                    </div>
                  </dl>
                ) : quote && !quote.ok ? (
                  <p className="mt-2 font-semibold text-amber-800">{quote.error}</p>
                ) : (
                  <p className="mt-2 text-muted">Enter the gross influencer compensation and choose a service level. The total uses the matching admin fee rules.</p>
                )}
                <p className="mt-2 text-xs text-muted">Both fees stay reserved until the agreement is signed. Changing a rule later does not change this quote after it is locked.</p>
              </div>
              <label className="block text-sm font-semibold text-indigo sm:col-span-2">
                Commercial framing
                <input
                  name="commercial"
                  defaultValue={commercial}
                  className={`mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet ${carried.commercial ? "bg-[#F4F7FF] text-indigo" : ""}`}
                />
              </label>
            </div>
          </section>

          <section id="milestones">
            <h2 className="font-display text-xl font-bold text-indigo">4. Milestones</h2>
            <ContractMilestones
              templates={templates}
              customEnabled={entitlements.customMilestones}
              initialCustom={usingCustom}
              initialAccepted={influencerAccepted}
            />
            {!milestoneGate.ok ? (
              <p className="mt-3 text-sm font-semibold text-amber-800">{milestoneGate.error}</p>
            ) : null}
            {enteredMilestones.length > 0 && enteredMilestones.length !== 1 ? (
              <p className="mt-3 text-sm font-semibold text-amber-800">
                This route allows one milestone. Nothing is signed until the schedule is a single milestone.
              </p>
            ) : null}
            {creatorCountry && jurisdictionCode && creatorCountry !== jurisdictionCode ? (
              <p className="mt-3 text-sm font-semibold text-amber-800">
                Cross-border funding is not part of this route. The influencer payout country and the deal country must match.
              </p>
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
                {route?.ready
                  ? `ready (${route.providerName})`
                  : route
                    ? route.reason.replace(/_/g, " ")
                    : "no route"}
              </li>
              {influencerAccountConnected !== null ? (
                <li>
                  Influencer payout account:{" "}
                  {influencerAccountConnected
                    ? `connected (${route?.providerName ?? route?.providerCode})`
                    : `not connected (${route?.providerName ?? route?.providerCode} required)`}
                </li>
              ) : null}
              <li>
                Withdrawal method (Global Payout Ready):{" "}
                {influencerAccountConnected
                  ? `via connected account (${route?.providerName ?? route?.providerCode})`
                  : payoutReadiness?.primaryMethod
                    ? `${PAYOUT_METHOD_LABELS[payoutReadiness.primaryMethod as PayoutMethod] ?? payoutReadiness.primaryMethod} (${payoutReadiness.primaryStatus})`
                    : "—"}
                {payoutReadiness && !payoutReadiness.hasVerifiedMethod
                  ? " — needed to withdraw released balance, not for funding"
                  : ""}
              </li>
              <li>Jurisdiction protected payments: {jurisdiction?.protectedPaymentsEnabled ? "on" : "off"}</li>
              <li>
                Legal review: {jurisdictionCaps?.legalReviewStatus ?? "—"}
                {jurisdictionCaps?.fullPrefundingEnabled ? " · full funding" : ""}
                {jurisdictionCaps?.managedIntroductionEnabled ? " · managed intro" : ""}
                {jurisdictionCaps?.managedNegotiationEnabled ? " · managed campaign" : ""}
              </li>
              <li>Marketplace provider: {marketplaceGate.detail}</li>
            </ul>
            {!gates.ok ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm font-semibold text-amber-900">
                {gates.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm font-semibold text-emerald-800">
                ROUTE_READY. Live funding stays off until the fee schedules, tax treatment, earning and refund policy, and provider route are approved.
              </p>
            )}
            {payoutReadiness && !payoutReadiness.globalPayoutReady ? (
              <p className="mt-2 text-xs text-muted">
                Funding can proceed when ROUTE_READY. Global Payout Ready is separate: after milestones release,
                the influencer withdraws through the corridor’s collection rail (Stripe Connect, etc.) — not through
                the marketplace webhook that confirms the prefund.
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
                  . Both fee rules reserve on signing. Later edits do not change a locked deal, and neither fee is earned yet.
                </p>
                {quote?.ok ? <p className="mt-2 text-xs text-muted">{quote.explanation}</p> : null}
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Gross influencer compensation</dt>
                    <dd className="font-bold text-indigo">
                      {formatMoney(plan.grossContractValueCents, plan.contractCurrency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Business platform fee</dt>
                    <dd className="font-bold text-indigo">
                      {formatMoney(plan.businessPlatformFeeCents ?? 0, plan.contractCurrency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Business pays</dt>
                    <dd className="font-bold text-indigo">
                      {formatMoney(plan.businessPaysCents ?? plan.grossContractValueCents, plan.contractCurrency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Influencer platform fee</dt>
                    <dd className="font-bold text-indigo">
                      {formatMoney(plan.influencerPlatformFeeCents ?? plan.totalPlatformFeeCents, plan.contractCurrency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Influencer receives</dt>
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
            ) : quote && !quote.ok ? (
              <p className="mt-2 text-sm font-semibold text-amber-800">{quote.error}</p>
            ) : jurisdictionCode && !(jurisdiction?.currency ?? "").trim() ? (
              <p className="mt-2 text-sm text-muted">That jurisdiction has no currency.</p>
            ) : (
              <p className="mt-2 text-sm text-muted">Complete parties, commercial terms, and valid milestones to preview.</p>
            )}
          </section>

          <section id="accept">
            <h2 className="font-display text-xl font-bold text-indigo">7. Accept & funding instruction</h2>
            {quote?.ok && plan ? (
              <div className="mt-3 rounded-xl border border-border bg-[#F7FAFF] px-4 py-3 text-sm text-indigo">
                <p className="font-semibold">Fee disclosure</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted">
                  {buildFeeDisclosureSummary(
                    disclosureFromDualQuote(quote, {
                      jurisdiction: jurisdictionCode,
                      serviceLevel: effectiveServiceLevel,
                    }),
                  )}
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
                I accept this fee disclosure. Both platform fees are reserved on the signed agreement. They are not earned,
                and live funding stays off.
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
                freezes the fee rule version after every party has signed through the active signing channel.
              </span>
            </label>
            <p className="mt-3 text-sm text-muted">
              Send for signature uses Influrios in-app signing. Each party can download the agreement before and after
              signing. Funding does not start until every party has signed.
            </p>
            {sendBlocked && existingContract ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                {sendBlocked}{" "}
                <Link href={`/collaboration/contracts/${existingContract.id}`} className="font-semibold text-violet hover:underline">
                  Open the agreement
                </Link>
              </p>
            ) : null}
          </section>

          <div className="flex flex-col gap-3 border-t border-[#E4E9F5] pt-4 sm:flex-row">
            <button type="submit" name="intent" value="preview" className="btn-secondary flex-1">
              Refresh preview
            </button>
            <button
              type="submit"
              name="intent"
              value="sign"
              disabled={Boolean(sendBlocked)}
              className="btn-secondary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendBlocked ? "Already sent for signature" : "Send for signature"}
            </button>
            {existingContract?.fundingId ? (
              <Link href={`/payments?created=${existingContract.fundingId}`} className="btn-primary flex-1 text-center">
                View funding
              </Link>
            ) : (
              <button type="submit" name="intent" value="fund" className="btn-primary flex-1">
                Start funding →
              </button>
            )}
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          After funding starts, manage milestones on{" "}
          <Link href="/payments" className="font-semibold text-violet hover:underline">
            Protected Payments
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
