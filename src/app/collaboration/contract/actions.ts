"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusinessSession } from "@/lib/account-audience";
import { businessEntitlementsForPlan } from "@/lib/entitlements-db";
import { closeBriefForContract, getWorkspace } from "@/lib/business";
import { contractOfferReady } from "@/lib/campaign-contract";
import { getMarketplaceApplication } from "@/lib/marketplace-listings";
import { assertCollabOsV1 } from "@/lib/collab-os";
import { disclosureFromDualQuote, resolveAllInBudget, resolveDualPlatformFees } from "@/lib/dual-platform-fees";
import { buildSignedCommercialSnapshot, domesticCollaborationGate, launchMilestoneGate, teamFundingGate } from "@/lib/payment-engine";
import { resolveLifecycleSnapshot } from "@/lib/milestone-lifecycle";
import {
  buildFinancialPlan,
  canFundContract,
  contractWizardFields,
  countryCodeFromLocation,
  customMilestonesGate,
  evaluatePreContractGates,
  lockFinancialPlan,
  marketplaceProviderGateMessage,
  parseMilestoneDraftsFromForm,
  type MilestoneDraft,
} from "@/lib/contract-wizard";
import { prisma } from "@/lib/db";
import { getDirectoryCreator } from "@/lib/directory";
import { resolveCreatorIdentityVerified } from "@/lib/kyc-document";
import {
  capabilitiesFromJurisdictionRow,
  serviceLevelAllowedByJurisdiction,
} from "@/lib/jurisdiction-capabilities";
import {
  buildFeeDisclosureSummary,
  FEE_DISCLOSURE_LEGAL_KEYS,
  requireFeeDisclosureAccepted,
} from "@/lib/fee-disclosure";
import { hasCurrentLegalRecord, recordLegalEvent } from "@/lib/legal";
import { formatMoney } from "@/lib/money";
import { resolveCreatorParties, sendCollaborationContract } from "@/lib/contract-document";
import { creatorAmountsForMilestone } from "@/lib/team-proposal";
import { ensureMarketplaceDefaults, marketplaceConfig } from "@/lib/marketplace-ledger";
import { computePayoutReadiness } from "@/lib/payout-readiness";
import { collectionPayoutBlocker, collectionPayoutReady, paymentRoutes } from "@/lib/providers";
import {
  memberShareSnapshot,
  teamFundingReady,
  teamMemberReadiness,
  wizardParties,
} from "@/lib/team-proposal";

const BASE = "/collaboration/contract";

function dollarsToCents(raw: string) {
  const amount = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

function redirectError(message: string, qs: URLSearchParams): never {
  qs.set("error", message);
  redirect(`${BASE}?${qs.toString()}`);
}

function readDrafts(formData: FormData, usingCustom: boolean, templates: MilestoneDraft[]): MilestoneDraft[] {
  if (!usingCustom) return templates;
  const titles = formData.getAll("milestoneTitle").map((v) => String(v));
  const percents = formData.getAll("milestonePercent").map((v) => String(v));
  return parseMilestoneDraftsFromForm({ titles, percents });
}

export async function actionFundSignedContract(formData: FormData) {
  const account = await requireBusinessSession("/collaboration/contracts");
  const ws = await getWorkspace(account.id);
  const documentId = String(formData.get("contractDocumentId") ?? "").trim();
  const { fundSignedAgreement } = await import("@/lib/signed-funding-apply");
  const funded = await fundSignedAgreement({
    documentId,
    workspaceId: ws.businessId,
    payoutMethod: String(formData.get("payoutMethod") ?? ""),
    submitted: { workspaceId: ws.businessId },
  });
  if (!funded.ok) {
    redirect(`/collaboration/contracts/${documentId}?error=${encodeURIComponent(funded.error)}`);
  }
  revalidatePath("/payments");
  revalidatePath(`/collaboration/contracts/${documentId}`);
  redirect(`/payments?created=${funded.id}`);
}

export async function actionSubmitContractWizard(formData: FormData) {
  await assertCollabOsV1();
  const account = await requireBusinessSession(BASE);

  const termsOk = await hasCurrentLegalRecord({
    documentKey: "business-terms",
    userId: account.id,
  }).catch(() => false);
  if (!termsOk) {
    redirect(`/collaboration/business?error=${encodeURIComponent("Agree to the Business / Brand Terms before starting a contract.")}`);
  }

  const ws = await getWorkspace(account.id);
  const entitlements = await businessEntitlementsForPlan(ws.plan);
  const creatorSlug = String(formData.get("creatorSlug") ?? "").trim();
  const teamProposalId = String(formData.get("teamProposalId") ?? "").trim();
  const collaborationId = String(formData.get("collaborationId") ?? "").trim() || undefined;
  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? ws.name).trim() || ws.name;
  const title = String(formData.get("title") ?? "").trim();
  const scope = String(formData.get("scope") ?? "").trim();
  const commercial = String(formData.get("commercial") ?? "").trim();
  const jurisdictionCode = String(formData.get("jurisdictionCode") ?? "").trim().toUpperCase();
  const serviceLevel = contractWizardFields({
    jurisdiction: jurisdictionCode,
    serviceLevel: String(formData.get("serviceLevel") ?? ""),
  }).serviceLevel;
  const grossCents = dollarsToCents(String(formData.get("grossUsd") ?? ""));
  const usingCustom = formData.get("milestoneMode") === "custom";
  const influencerAccepted = formData.get("influencerAccepted") === "on";
  const partyAccepted = formData.get("partyAccepted") === "on";
  const feeDisclosureAccepted = formData.get("feeDisclosureAccepted") === "on";
  const intent = String(formData.get("intent") ?? "preview");

  const briefId = String(formData.get("briefId") ?? "").trim();
  const qs = new URLSearchParams();
  qs.set("creator", creatorSlug);
  if (teamProposalId) qs.set("team", teamProposalId);
  if (collaborationId) qs.set("collaboration", collaborationId);
  if (briefId) qs.set("brief", briefId);
  if (applicationId) qs.set("application", applicationId);
  const contractCurrency = String(formData.get("contractCurrency") ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(contractCurrency)) qs.set("currency", contractCurrency);
  qs.set("title", title);
  qs.set("scope", scope);
  qs.set("commercial", commercial);
  qs.set("jurisdiction", jurisdictionCode);
  qs.set("serviceLevel", serviceLevel);
  qs.set("gross", String(formData.get("grossUsd") ?? ""));
  qs.set("mode", usingCustom ? "custom" : "template");
  if (influencerAccepted) qs.set("influencerAccepted", "1");
  if (partyAccepted) qs.set("accepted", "1");
  if (feeDisclosureAccepted) qs.set("feeDisclosure", "1");

  const contractDocumentIdEarly = String(formData.get("contractDocumentId") ?? "").trim();
  if (intent === "fund") {
    if (!contractDocumentIdEarly) {
      redirectError("Open the signed agreement and start funding from that agreement.", qs);
    }
    const { fundSignedAgreement } = await import("@/lib/signed-funding-apply");
    const customMilestones = usingCustom
      ? parseMilestoneDraftsFromForm({
          titles: formData.getAll("milestoneTitle").map((value) => String(value)),
          percents: formData.getAll("milestonePercent").map((value) => String(value)),
        })
      : null;
    const funded = await fundSignedAgreement({
      documentId: contractDocumentIdEarly,
      workspaceId: ws.businessId,
      payoutMethod: String(formData.get("payoutMethod") ?? ""),
      submitted: {
        workspaceId: ws.businessId,
        collaborationId,
        applicationId,
        teamProposalId,
        creatorSlug,
        currency: contractCurrency,
        grossCents,
        customMilestones,
      },
    });
    if (!funded.ok) {
      qs.set("step", "funding");
      redirectError(funded.error, qs);
    }
    revalidatePath(BASE);
    revalidatePath("/payments");
    revalidatePath("/collaboration/business");
    revalidatePath(`/collaboration/contracts/${contractDocumentIdEarly}`);
    redirect(`/payments?created=${funded.id}`);
  }

  if (!creatorSlug || !title || !scope || grossCents <= 0) {
    redirectError("Add the influencer, title, scope, and a gross amount.", qs);
  }
  if (!jurisdictionCode) redirectError("Choose a jurisdiction.", qs);
  if (!serviceLevel) redirectError("Choose a collaboration service level.", qs);

  const creator = await getDirectoryCreator(creatorSlug);
  if (!creator) redirectError("That influencer was not found in the directory.", qs);

  let linkedCollaborationId: string | null = null;
  if (collaborationId) {
    const collab = await prisma.collaboration.findUnique({ where: { id: collaborationId } });
    if (!collab) redirectError("That collaboration record was not found.", qs);
    if (collab.initiatorSlug !== creatorSlug && collab.recipientSlug !== creatorSlug) {
      redirectError("The selected influencer is not a party on that collaboration.", qs);
    }
    linkedCollaborationId = collab.id;
  }

  await ensureMarketplaceDefaults();
  const config = await marketplaceConfig();
  const templates: MilestoneDraft[] = (config.templates ?? [])
    .filter((row) => row.active)
    .map((row) => ({ title: row.title, shareBps: row.shareBps }));

  const { getLaunchGate } = await import("@/lib/launch-gate");
  const fundingSwitches = await getLaunchGate().catch(() => null);
  const drafts = readDrafts(formData, usingCustom, templates);
  const milestoneGate = customMilestonesGate({
    entitled: entitlements.customMilestones,
    usingCustom,
    milestones: drafts,
    influencerAccepted,
  });
  if (!milestoneGate.ok) redirectError(milestoneGate.error, qs);

  const creatorCountry =
    countryCodeFromLocation(creator.locationCountry) ??
    (jurisdictionCode.length === 2 ? jurisdictionCode : null);
  const routes = await paymentRoutes().catch(() => []);
  const route = creatorCountry
    ? routes.find((row) => row.countryCode === creatorCountry)
    : undefined;

  const dbCreator = await prisma.creator.findUnique({ where: { slug: creatorSlug } }).catch(() => null);
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
        locationCountry: dbCreator.locationCountry ?? creator.locationCountry,
      }).catch(() => null)
    : null;

  const jurisdiction = config.jurisdictions.find((row) => row.code === jurisdictionCode);
  const assignedProviderCode = jurisdiction?.providerCode || "primary";
  const provider =
    config.providers.find((row) => row.code === assignedProviderCode) ??
    (assignedProviderCode === "primary" ? config.provider : null);
  const marketplaceGate = marketplaceProviderGateMessage(provider, assignedProviderCode);

  const caps = jurisdiction ? capabilitiesFromJurisdictionRow(jurisdiction) : null;
  if (caps) {
    const serviceGate = serviceLevelAllowedByJurisdiction(caps, serviceLevel);
    if (!serviceGate.ok) redirectError(serviceGate.error, qs);
  }

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
  let gates = evaluatePreContractGates({
    businessName,
    creatorSlug,
    identityVerified,
    creatorCountryKnown: Boolean(creatorCountry),
    corridorActive: payoutReadiness ? payoutReadiness.corridorActive : Boolean(creatorCountry),
    paymentRouteReady: collectionPayoutReady(routeGateInput),
    paymentRouteBlocker: collectionPayoutBlocker(routeGateInput),
    jurisdictionProtectedPayments: Boolean(jurisdiction?.protectedPaymentsEnabled),
    marketplaceProviderReady: marketplaceGate.ready,
    marketplaceProviderBlocker: marketplaceGate.ready ? null : marketplaceGate.blocker,
  });

  let teamShares: { label: string; shareBps: number }[] | null = null;
  if (teamProposalId) {
    const proposal = await prisma.teamProposal.findUnique({
      where: { id: teamProposalId },
      include: { members: { orderBy: { createdAt: "asc" } } },
    });
    if (!proposal || proposal.workspaceId !== ws.businessId) {
      redirectError("That team proposal is not on this workspace.", qs);
    }
    const parties = wizardParties(proposal);
    if (!parties) redirectError("Every creator must accept before the contract opens.", qs);
    if (proposal.fundingId) redirectError("This team proposal already has a funding instruction.", qs);
    const checks = await Promise.all(
      parties.map((party) =>
        teamMemberReadiness({
          creatorSlug: party.creatorSlug,
          businessName,
          jurisdictionProtectedPayments: Boolean(jurisdiction?.protectedPaymentsEnabled),
          marketplaceProviderReady: Boolean(provider?.ready),
        }),
      ),
    );
    const ready = teamFundingReady({
      status: proposal.status,
      payoutReady: checks.map((check) => check.ready),
    });
    gates = ready.ok
      ? { ok: true, status: "ROUTE_READY", blockers: [] }
      : {
          ok: false,
          status: "ROUTE_BLOCKED",
          blockers: checks.flatMap((check) => check.blockers),
        };
    teamShares = memberShareSnapshot(parties);
    if (!teamShares) redirectError("Team creator shares must add up to 100%.", qs);
    const teamGate = teamFundingGate(parties.length, fundingSwitches?.teamFundingEnabled === true);
    if (!teamGate.ok) redirectError(teamGate.error, qs);
  }

  qs.set("step", intent === "fund" ? "funding" : intent === "accept" ? "accept" : "preview");

  if (intent === "preview" || intent === "accept") {
    if (!gates.ok && intent === "accept") {
      qs.set("step", "payment_readiness");
      redirectError(gates.blockers[0] ?? "Payment readiness is incomplete.", qs);
    }
    qs.set("step", intent === "accept" ? "accept" : "preview");
    redirect(`${BASE}?${qs.toString()}`);
  }

  if (intent !== "sign") {
    const fundGate = canFundContract({
      gates,
      milestones: milestoneGate,
      accepted: partyAccepted,
    });
    if (!fundGate.ok) {
      qs.set("step", gates.ok ? "accept" : "payment_readiness");
      redirectError(fundGate.error, qs);
    }
  }

  const amountMode = String(formData.get("amountInputMode") ?? "gross") === "all_in" ? "all_in" : "gross";
  if (amountMode === "all_in" && fundingSwitches?.allInBudgetEntryEnabled !== true) {
    qs.set("step", "commercial");
    redirectError("All-in budget entry is off. Turn it on in Payment settings, or enter gross influencer compensation.", qs);
  }
  const quote =
    amountMode === "all_in"
      ? await resolveAllInBudget({ jurisdiction: jurisdictionCode, serviceLevel }, grossCents).catch(() => null)
      : await resolveDualPlatformFees({
          jurisdiction: jurisdictionCode,
          serviceLevel,
          grossValueCents: grossCents,
        }).catch(() => null);
  if (!quote?.ok) {
    qs.set("step", "preview");
    redirectError(quote?.error ?? "A fee quote is required before accepting the fee disclosure.", qs);
  }

  const disclosureGate = requireFeeDisclosureAccepted({
    accepted: feeDisclosureAccepted,
    disclosure: disclosureFromDualQuote(quote, { jurisdiction: jurisdictionCode, serviceLevel }),
  });
  if (!disclosureGate.ok) {
    qs.set("step", "accept");
    redirectError(disclosureGate.error, qs);
  }

  await recordLegalEvent({
    trigger: "collaboration",
    context: `contract_fee_disclosure:${creatorSlug}:${jurisdictionCode}`,
    userId: account.id,
    userRole: "business",
    extraKeys: [...FEE_DISCLOSURE_LEGAL_KEYS],
  }).catch(() => null);

  const lifecycle = resolveLifecycleSnapshot({
    jurisdictionReviewWindowHours: jurisdiction?.reviewWindowHours,
    jurisdictionMaxRevisions: jurisdiction?.maxRevisions,
    settingsReviewWindowHours: config.reviewWindowHours,
    settingsMaxRevisions: config.maxRevisions,
  });
  const requestedCurrency = String(formData.get("contractCurrency") ?? "").trim().toUpperCase();
  const currency = /^[A-Z]{3}$/.test(requestedCurrency)
    ? requestedCurrency
    : (jurisdiction?.currency ?? "").trim();
  if (!/^[A-Za-z]{3}$/.test(currency)) {
    qs.set("step", "preview");
    redirectError("That jurisdiction has no currency.", qs);
  }
  const milestoneLaunch = launchMilestoneGate(drafts.length, {
    stagedAllowed: fundingSwitches?.stagedFundingEnabled === true,
    maxMilestones: config.maxStages,
  });
  if (!milestoneLaunch.ok) {
    qs.set("step", "milestones");
    redirectError(milestoneLaunch.error, qs);
  }
  const domestic = domesticCollaborationGate({
    businessCountry: jurisdictionCode,
    influencerCountry: creatorCountry ?? "",
    dealCountry: jurisdictionCode,
    businessVerified: Boolean(jurisdiction?.protectedPaymentsEnabled),
    influencerVerified: identityVerified,
    routeActive: gates.ok,
    currency,
    routeCurrency: (jurisdiction?.currency ?? "").trim(),
    payoutMethod: String(formData.get("payoutMethod") ?? ""),
    crossBorderAllowed: fundingSwitches?.crossBorderFundingEnabled === true,
  });
  if (!domestic.ok) {
    qs.set("step", "payment_readiness");
    redirectError(domestic.error, qs);
  }
  const minorDigits = jurisdiction?.minorDigits;
  if (typeof minorDigits !== "number" || !Number.isInteger(minorDigits)) {
    qs.set("step", "preview");
    redirectError("That jurisdiction has no minor digits.", qs);
  }
  const signedQuote = buildSignedCommercialSnapshot({
    quote,
    currency,
    minorDigits,
    milestoneCount: drafts.length,
    amountInputMode: amountMode === "all_in" ? "all_in_budget" : "gross_influencer_compensation",
  });
  if ("ok" in signedQuote) {
    qs.set("step", "preview");
    redirectError(signedQuote.error, qs);
  }
  const plan = buildFinancialPlan({
    grossCents: quote.grossInfluencerCompensationCents,
    currency,
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
    payoutCurrency: currency,
    milestones: drafts,
    milestoneSource: usingCustom ? "custom" : "template",
    reviewWindowHours: lifecycle.reviewWindowHours,
    revisionLimit: lifecycle.revisionLimit,
  });
  if (!plan) redirectError("Could not build a financial plan for those milestones.", qs);

  const locked = lockFinancialPlan({
    ...plan,
    signedQuote,
    feeDisclosure: {
      ...disclosureGate.record,
      summary: buildFeeDisclosureSummary(disclosureGate.record),
      acceptedByUserId: account.id,
    },
  });
  if (intent === "sign" && applicationId) {
    const application = await getMarketplaceApplication(applicationId);
    const ready = contractOfferReady({
      status: application?.status ?? "",
      creatorSlug: application?.creatorSlug,
      shortlistedSlugs: ws.shortlist.map((item) => item.creatorSlug),
    });
    if (!application || !ready) {
      redirectError("Shortlist this influencer before creating a contract.", qs);
    }
  }

  if (intent === "sign") {
    const members = teamShares
      ? teamShares.map((row) => ({ creatorSlug: row.label, shareBps: row.shareBps }))
      : [{ creatorSlug, shareBps: 10_000 }];
    const creators = await resolveCreatorParties(members);
    if (!creators.ok) redirectError(creators.error, qs);
    const sent = await sendCollaborationContract({
      workspaceId: ws.businessId,
      collaborationId: linkedCollaborationId,
      teamProposalId: teamProposalId || null,
      applicationId: applicationId || null,
      createdByUserId: account.id,
      source: Object.fromEntries(qs.entries()),
      render: {
        title,
        scope,
        commercial,
        jurisdiction: jurisdictionCode,
        serviceLevel,
        currency: plan.contractCurrency,
        grossLabel: formatMoney(plan.grossContractValueCents, plan.contractCurrency),
        platformFeeLabel: formatMoney(plan.totalPlatformFeeCents, plan.contractCurrency),
        creatorCompensationLabel: formatMoney(plan.totalCreatorCompensationCents, plan.contractCurrency),
        businessName,
        businessEmail: account.email,
        parties: [
          {
            role: "business",
            name: account.name || businessName,
            email: account.email,
            userId: account.id,
          },
          ...creators.parties,
        ],
        milestones: plan.milestones.map((milestone) => {
          const shares = teamShares
            ? creatorAmountsForMilestone(
                milestone.creatorCents,
                teamShares.map((row) => ({ creatorSlug: row.label, shareBps: row.shareBps })),
              )
            : [{ creatorSlug, amountCents: milestone.creatorCents }];
          return {
            title: milestone.title,
            shareLabel: `${(milestone.shareBps / 100).toFixed(0)}%`,
            grossLabel: formatMoney(milestone.grossCents, plan.contractCurrency),
            feeLabel: formatMoney(milestone.platformFeeCents, plan.contractCurrency),
            creatorShares:
              shares?.map((share) => `${share.creatorSlug} ${formatMoney(share.amountCents, plan.contractCurrency)}`).join(", ") ??
              "",
          };
        }),
        feeDisclosure: buildFeeDisclosureSummary(disclosureGate.record),
        generatedAt: new Date().toISOString(),
      },
      termsSnapshot: {
        version: 1 as const,
        title,
        businessName,
        jurisdictionCode,
        currency: plan.contractCurrency,
        grossCents: plan.grossContractValueCents,
        serviceLevel,
        workspaceId: ws.businessId,
        collaborationId: linkedCollaborationId,
        applicationId: applicationId || null,
        teamProposalId: teamProposalId || null,
        creators: creators.parties
          .filter((party) => party.role === "creator" && party.creatorSlug)
          .map((party) => ({ slug: party.creatorSlug as string, shareBps: party.shareBps ?? 0 })),
        milestones: plan.milestones.map((milestone) => ({ title: milestone.title, shareBps: milestone.shareBps })),
        financialPlan: locked as unknown as Record<string, unknown>,
        payoutMethod: String(formData.get("payoutMethod") ?? ""),
        lockedAt: locked.lockedAt ?? new Date().toISOString(),
      },
    });
    if (!sent.ok) {
      if ("existingId" in sent && sent.existingId) {
        redirect(
          `/collaboration/contracts/${sent.existingId}?error=${encodeURIComponent(sent.error)}`,
        );
      }
      redirectError(sent.error, qs);
    }
    if (briefId) {
      await closeBriefForContract(briefId, ws.businessId, "deal").catch(() => undefined);
    }
    redirect(`/collaboration/contracts/${sent.id}`);
  }

  redirectError("Funding starts from the signed agreement. Nothing was funded.", qs);
}
