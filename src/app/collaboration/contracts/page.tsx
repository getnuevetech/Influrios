import Link from "next/link";
import { redirect } from "next/navigation";
import { ContractAgreementDialog } from "@/components/contract-agreement-dialog";
import { ContractConfirmParties } from "@/components/contract-confirm-parties";
import { ContractTemplatesPanel } from "@/components/contract-templates-panel";
import { IconFileText } from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { newCorrelationId } from "@/lib/correlation";
import { getWorkspace } from "@/lib/business";
import { contractHrefFromCampaign, contractOfferReady } from "@/lib/campaign-contract";
import { agreementFooterAction } from "@/lib/agreement-footer";
import {
  fundingStatusLabel,
  signatureStatusBucket,
  signatureStatusLabel,
} from "@/lib/contract-catalog";
import { listContractsForUser } from "@/lib/contract-document";
import { buildMilestoneSchedule } from "@/lib/contract-milestone-schedule";
import { overviewAmountLines } from "@/lib/contract-overview-money";
import { confirmParties } from "@/lib/contract-party-confirm";
import {
  agreementActivityEvents,
  counterpartyName,
  displayAgreementReference,
  displayAgreementVersion,
  documentTypeForRow,
  readableSignedAt,
  signingAsLabel,
  stripSignatureTokens,
} from "@/lib/contract-reader";
import { contractAiEnabled } from "@/lib/contract-ai-tailor";
import { prisma } from "@/lib/db";
import {
  acceptedWorkNeedsContract,
  listMarketplaceApplications,
  listWorkspaceBusinessRequests,
} from "@/lib/marketplace-listings";
import { readSignedTermsSnapshot } from "@/lib/signed-funding";
import { repairSignedAgreements } from "@/lib/signed-funding-apply";
import { isContractDocumentTypeId } from "@/lib/contract-catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contracts" };

type ContractRow = Awaited<ReturnType<typeof listContractsForUser>>[number];

function shortDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(value);
}

const PILL = {
  yours: "bg-[#FFF4D8] text-[#B86E00]",
  others: "bg-[#F3EEFF] text-[#6D4AFF]",
  signed: "bg-[#E8F8EE] text-[#178A45]",
  expired: "bg-[#FDECEC] text-[#D14343]",
  draft: "bg-[#F4F6FB] text-[#667085]",
} as const;

const PAGE_SIZE = 8;

export default async function ContractsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    tab?: string;
    open?: string;
    q?: string;
    page?: string;
    use?: string;
    customize?: string;
    step?: string;
    panel?: string;
  }>;
}) {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect("/login?next=/collaboration/contracts");
  const params = await searchParams;
  const view = params.view === "templates" ? "templates" : "agreements";
  const aiEnabled = await contractAiEnabled().catch(() => false);

  const contractLoad = await listContractsForUser(account.id, account.email)
    .then((rows) => ({ rows, failed: false }))
    .catch(() => ({ rows: [] as ContractRow[], failed: true }));
  const [creator, workspace] = await Promise.all([
    prisma.creator.findUnique({ where: { userId: account.id }, select: { slug: true, displayName: true } }).catch(() => null),
    getWorkspace(account.id).catch(() => null),
  ]);
  const contracts = contractLoad.rows;
  if (!contractLoad.failed) {
    await repairSignedAgreements(contracts.filter((row) => row.status === "signed").map((row) => row.id)).catch(() => 0);
  }

  const fundingIds = contracts.flatMap((row) => (row.fundingId ? [row.fundingId] : []));
  const fundingRows = fundingIds.length
    ? await prisma.collaborationFunding
        .findMany({ where: { id: { in: fundingIds } }, select: { id: true, status: true } })
        .catch(() => [])
    : [];
  const fundingStatus = new Map(fundingRows.map((row) => [row.id, row.status]));
  const deliverablesHref = (fundingId: string | null | undefined) => {
    if (!fundingId) return null;
    const status = fundingStatus.get(fundingId);
    return status === "held" || status === "completed" ? `/collaboration/work/${fundingId}` : null;
  };
  const depositHref = (fundingId: string | null | undefined) => {
    if (!fundingId || !workspace || workspace.businessId === "public") return null;
    return fundingStatus.get(fundingId) === "awaiting_provider" ? `/payments/checkout/${fundingId}` : null;
  };

  const contractsFailed = contractLoad.failed;
  const contractsRef = contractsFailed ? newCorrelationId() : "";
  if (contractsFailed) console.error("contracts load failed", contractsRef);
  const creatorSlug = creator?.slug?.trim() ?? "";
  const viewerIsBusiness = account.role === "BUSINESS" || account.role === "AGENCY";

  const ownedRequests =
    workspace && workspace.businessId !== "public"
      ? await listWorkspaceBusinessRequests(workspace.businessId).catch(() => [])
      : [];
  const ownedIds = ownedRequests.map((row) => row.id);
  const ownedBriefIds = workspace?.briefs.map((brief) => brief.id) ?? [];
  const [creatorApplications, businessApplications] = await Promise.all([
    creatorSlug ? listMarketplaceApplications({ creatorSlug, limit: 40 }).catch(() => []) : Promise.resolve([]),
    ownedIds.length || ownedBriefIds.length
      ? listMarketplaceApplications({
          businessRequestIds: ownedIds,
          briefIds: ownedBriefIds,
          limit: 40,
        }).catch(() => [])
      : Promise.resolve([]),
  ]);
  const seen = new Set<string>();
  const needed = [...creatorApplications, ...businessApplications].filter((application) => {
    if (seen.has(application.id)) return false;
    seen.add(application.id);
    return acceptedWorkNeedsContract(application, contracts);
  });

  const rows = contracts.map((contract) => ({
    contract,
    kind: signatureStatusBucket({
      status: contract.status,
      parties: contract.parties,
      accountId: account.id,
      email: account.email,
      signingChannel: contract.signingChannel,
    }),
  }));

  const tab = (["yours", "others", "signed", "draft", "expired"].includes(params.tab ?? "") ? params.tab : "all") as
    | "all"
    | "yours"
    | "others"
    | "signed"
    | "draft"
    | "expired";
  const q = params.q?.trim().toLowerCase() ?? "";
  const filtered = (tab === "all" ? rows : rows.filter((row) => row.kind === tab)).filter(({ contract }) => {
    if (!q) return true;
    const hay = `${contract.title} ${contract.parties.map((party) => party.name).join(" ")} ${displayAgreementReference({
      id: contract.id,
      agreementRef: "agreementRef" in contract ? String((contract as { agreementRef?: string }).agreementRef ?? "") : "",
    })}`.toLowerCase();
    return hay.includes(q);
  });
  const page = Math.max(1, Number(params.page) || 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = params.open ? contracts.find((contract) => contract.id === params.open) ?? null : null;
  const selectedKind = selected
    ? signatureStatusBucket({
        status: selected.status,
        parties: selected.parties,
        accountId: account.id,
        email: account.email,
        signingChannel: selected.signingChannel,
      })
    : null;
  const selectedBody = selected
    ? await prisma.contractDocument
        .findUnique({
          where: { id: selected.id },
          select: {
            renderedBody: true,
            agreementRef: true,
            versionLabel: true,
            documentType: true,
            termsSnapshotJson: true,
            sourceJson: true,
            voidedAt: true,
            voidReason: true,
            createdAt: true,
            updatedAt: true,
            parties: true,
          },
        })
        .catch(() => null)
    : null;

  const listQuery = `view=agreements&tab=${tab}&q=${encodeURIComponent(params.q ?? "")}&page=${page}`;
  const closeHref = `/collaboration/contracts?${listQuery}`;

  const useType = params.use && isContractDocumentTypeId(params.use) ? params.use : null;
  const confirmStep = view === "templates" && params.step === "parties" && useType;

  let confirmResult = null as ReturnType<typeof confirmParties> | null;
  if (confirmStep) {
    const businessName =
      workspace && workspace.businessId !== "public"
        ? workspace.briefs[0]?.title
          ? account.name
          : account.name
        : account.name;
    confirmResult = confirmParties({
      business: {
        role: "business",
        legalName: workspace?.businessId && workspace.businessId !== "public" ? account.name : account.name,
        signerName: account.name,
        capacity: "Authorized representative",
        email: account.email,
        userId: account.id,
      },
      influencer: {
        role: "influencer",
        legalName: creator?.displayName || "",
        signerName: creator?.displayName || account.name,
        capacity: "Influencer",
        handle: creatorSlug,
        email: creatorSlug ? account.email : "",
        userId: creator ? account.id : null,
      },
    });
    // Prefer linked collaboration parties when Use template is opened from an existing deal — keep placeholders honest.
    void businessName;
  }

  const workspaceTemplates = workspace?.businessId
    ? await prisma.contractTemplate
        .findMany({
          where: { scope: "workspace", workspaceId: workspace.businessId, published: true },
          select: { id: true, name: true, description: true, documentType: true, versionLabel: true },
          take: 20,
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description || "Private workspace template",
            typeLabel: documentTypeForRow(row.documentType, row.name),
            versionLabel: row.versionLabel,
          })),
        )
        .catch(() => [])
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[2rem] font-bold leading-none text-[#1B1464]">Contracts</h1>
        <p className="mt-2 text-sm text-[#667085]">Agreements tied to real parties, and reusable templates to start the next draft.</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[#E7ECF5] text-sm font-semibold text-[#667085]">
        <Link
          href="/collaboration/contracts?view=agreements"
          className={`border-b-2 px-3 py-2.5 ${view === "agreements" ? "border-[#6D4AFF] text-[#6D4AFF]" : "border-transparent"}`}
        >
          Agreements
        </Link>
        <Link
          href="/collaboration/contracts?view=templates"
          className={`border-b-2 px-3 py-2.5 ${view === "templates" ? "border-[#6D4AFF] text-[#6D4AFF]" : "border-transparent"}`}
        >
          Templates
        </Link>
      </div>

      {view === "templates" ? (
        confirmStep && confirmResult && useType ? (
          <ContractConfirmParties
            documentTypeId={useType}
            result={confirmResult}
            backHref="/collaboration/contracts?view=templates"
            continueHref={
              useType === "collaboration"
                ? "/collaboration/contract"
                : `/collaboration/contracts?view=templates&use=${useType}&step=draft`
            }
          />
        ) : (
          <ContractTemplatesPanel aiEnabled={aiEnabled} workspaceTemplates={workspaceTemplates} />
        )
      ) : (
        <>
          <form action="/collaboration/contracts" className="flex flex-wrap gap-2">
            <input type="hidden" name="view" value="agreements" />
            <input type="hidden" name="tab" value={tab} />
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search agreements"
              className="h-10 min-w-[220px] flex-1 rounded-full border border-[#E7ECF5] bg-[#F8FAFC] px-4 text-sm outline-none"
            />
            <select
              name="tab"
              defaultValue={tab}
              className="h-10 rounded-full border border-[#E7ECF5] bg-white px-3 text-sm font-semibold text-[#344054]"
            >
              <option value="all">All statuses</option>
              <option value="yours">Needs my signature</option>
              <option value="others">Awaiting others</option>
              <option value="signed">Fully signed</option>
              <option value="draft">Drafts</option>
              <option value="expired">Expired</option>
            </select>
            <button type="submit" className="h-10 rounded-full bg-[#6D4AFF] px-4 text-sm font-semibold text-white">
              Apply
            </button>
          </form>

          {needed.length > 0 && (tab === "all" || tab === "yours" || tab === "draft") ? (
            <section className="rounded-[24px] border border-[#F3D7A1] bg-white p-4 sm:p-5">
              <h2 className="font-display text-lg font-bold text-[#1B1464]">Contract needed</h2>
              <ul className="mt-3 divide-y divide-[#EEF2F7]">
                {needed.map((application) => {
                  const slug = (application.fromSlug || application.toSlug || "").trim();
                  const owned = Boolean(
                    (application.businessRequestId && ownedIds.includes(application.businessRequestId)) ||
                      ((application.briefId || application.requestBriefId) &&
                        ownedBriefIds.includes((application.briefId || application.requestBriefId) ?? "")),
                  );
                  const brief =
                    workspace?.briefs.find((item) => item.id === (application.briefId || application.requestBriefId)) ?? null;
                  const title =
                    brief?.title || application.requestBrand || application.opportunityLookingFor || "Accepted collaboration";
                  const shortlisted = contractOfferReady({
                    status: application.status,
                    creatorSlug: slug,
                    shortlistedSlugs: workspace?.shortlist.map((item) => item.creatorSlug) ?? [],
                  });
                  const href =
                    owned && slug && shortlisted
                      ? contractHrefFromCampaign({
                          creatorSlug: slug,
                          brief,
                          applicationId: application.id,
                          collaborationId: application.collaborationId,
                          request: brief
                            ? null
                            : {
                                title: application.requestBrand,
                                budget: application.requestBudget,
                                currency: application.requestCurrency,
                                summary: [application.deliverables, application.requestDeliverables, application.requestSummary]
                                  .filter(Boolean)
                                  .join("\n"),
                              },
                        })
                      : `/collaboration/applications/${application.id}`;
                  return (
                    <li key={application.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1B1464]">{title}</p>
                        <p className="text-xs text-[#B86E00]">
                          {shortlisted ? "Ready for a contract" : "Shortlist this influencer before creating a contract"}
                        </p>
                      </div>
                      <Link href={href} className="rounded-full bg-[#6D4AFF] px-3 py-1.5 text-xs font-semibold text-white">
                        {owned && shortlisted ? "Create contract" : "Open application"}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {contractsFailed ? (
            <p className="rounded-2xl border border-[#F3D7A1] bg-[#FFF8EC] px-4 py-4 text-sm text-[#8A5A12]">
              Could not load agreements. Refresh this page to try again. Reference {contractsRef}.
            </p>
          ) : filtered.length === 0 && needed.length === 0 ? (
            <EmptyContracts />
          ) : filtered.length === 0 ? null : (
            <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                    <tr className="border-b border-[#EEF2F7]">
                      <th className="py-2 font-semibold">Campaign</th>
                      <th className="font-semibold">Document type</th>
                      <th className="font-semibold">Counterparty</th>
                      <th className="font-semibold">Signature status</th>
                      <th className="font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(({ contract, kind }) => {
                      const brand = counterpartyName({
                        viewerIsBusiness,
                        parties: contract.parties,
                        accountId: account.id,
                      });
                      const openHref = `/collaboration/contracts?${listQuery}&open=${contract.id}`;
                      const ref = displayAgreementReference({
                        id: contract.id,
                        agreementRef: "agreementRef" in contract ? String((contract as { agreementRef?: string }).agreementRef ?? "") : "",
                      });
                      const typeLabel = documentTypeForRow(
                        "documentType" in contract ? String((contract as { documentType?: string }).documentType ?? "") : "",
                        contract.title,
                      );
                      return (
                        <tr key={contract.id} className={selected?.id === contract.id ? "bg-[#F7F4FF]" : ""}>
                          <td className="py-3 pr-3">
                            <Link href={openHref} scroll={false} className="flex items-start gap-2 font-semibold text-[#1B1464]">
                              <span className="mt-0.5 text-[#98A2B3]">
                                <IconFileText size={16} />
                              </span>
                              <span>
                                {contract.title}
                                <span className="mt-1 block text-[11px] font-medium text-[#98A2B3]">{ref}</span>
                              </span>
                            </Link>
                          </td>
                          <td className="text-[#667085]">{typeLabel}</td>
                          <td>
                            <span className="inline-flex items-center gap-2 text-[#344054]">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F3EEFF] text-[11px] font-bold text-[#6D4AFF]">
                                {brand.slice(0, 1).toUpperCase()}
                              </span>
                              {brand}
                            </span>
                          </td>
                          <td>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${PILL[kind]}`}>
                              {signatureStatusLabel(kind)}
                            </span>
                          </td>
                          <td>
                            <Link
                              href={openHref}
                              scroll={false}
                              className="inline-flex items-center gap-1 rounded-full border border-[#E7ECF5] px-3 py-1.5 text-xs font-semibold text-[#6D4AFF]"
                            >
                              View agreement
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-[#98A2B3]">
                <span>
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                    <Link
                      key={number}
                      href={`/collaboration/contracts?view=agreements&tab=${tab}&page=${number}&q=${encodeURIComponent(params.q ?? "")}`}
                      className={`flex h-7 w-7 items-center justify-center rounded-full ${number === page ? "bg-[#6D4AFF] text-white" : "text-[#667085]"}`}
                    >
                      {number}
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {selected && selectedKind && selectedBody ? (
        <SelectedAgreementDialog
          accountId={account.id}
          accountEmail={account.email}
          accountName={account.name ?? ""}
          creatorSlug={creatorSlug}
          viewerIsBusiness={viewerIsBusiness}
          selected={selected}
          selectedKind={selectedKind}
          selectedBody={selectedBody}
          fundingStatus={fundingStatus}
          deliverablesHref={deliverablesHref}
          depositHref={depositHref}
          closeHref={closeHref}
          listQuery={listQuery}
          panel={params.panel}
        />
      ) : null}
    </div>
  );
}

async function SelectedAgreementDialog({
  accountId,
  accountEmail,
  accountName,
  creatorSlug,
  viewerIsBusiness,
  selected,
  selectedKind,
  selectedBody,
  fundingStatus,
  deliverablesHref,
  depositHref,
  closeHref,
  listQuery,
  panel,
}: {
  accountId: string;
  accountEmail: string;
  accountName: string;
  creatorSlug: string;
  viewerIsBusiness: boolean;
  selected: ContractRow;
  selectedKind: keyof typeof PILL;
  selectedBody: {
    renderedBody: string;
    agreementRef: string;
    versionLabel: string;
    documentType: string;
    termsSnapshotJson: unknown;
    sourceJson: unknown;
    voidedAt: Date | null;
    voidReason: string;
    createdAt: Date;
    updatedAt: Date;
    parties: ContractRow["parties"];
  };
  fundingStatus: Map<string, string>;
  deliverablesHref: (fundingId: string | null | undefined) => string | null;
  depositHref: (fundingId: string | null | undefined) => string | null;
  closeHref: string;
  listQuery: string;
  panel?: string;
}) {
  const progress = selected.parties.filter((party) => party.status === "signed").length;
  const total = selected.parties.length;
  const role = selected.parties.some(
    (party) => (party.role === "creator" || party.role === "influencer") && creatorSlug && party.creatorSlug === creatorSlug,
  )
    ? "influencer"
    : "business";
  const amounts = overviewAmountLines({ termsSnapshotJson: selectedBody.termsSnapshotJson, role });
  const terms = readSignedTermsSnapshot(selectedBody.termsSnapshotJson);
  const feeCents =
    terms && "financialPlan" in (terms as object)
      ? overviewInfluencerFeeCents(selectedBody.termsSnapshotJson)
      : 0;
  const schedule =
    terms && terms.milestones.length
      ? buildMilestoneSchedule({
          currency: terms.currency,
          grossCents: terms.grossCents,
          influencerFeeCents: feeCents,
          milestones: terms.milestones.map((row) => ({ title: row.title, shareBps: row.shareBps })),
        })
      : null;
  const business = selected.parties.find((party) => party.role === "business");
  const influencers = selected.parties.filter((party) => party.role === "creator" || party.role === "influencer");
  const agreementRef = displayAgreementReference({ id: selected.id, agreementRef: selectedBody.agreementRef });
  const versionLabel = displayAgreementVersion(selectedBody.versionLabel);
  const scope =
    (selectedBody.sourceJson &&
    typeof selectedBody.sourceJson === "object" &&
    !Array.isArray(selectedBody.sourceJson) &&
    typeof (selectedBody.sourceJson as Record<string, unknown>).scope === "string"
      ? String((selectedBody.sourceJson as Record<string, unknown>).scope)
      : "") ||
    terms?.title ||
    "";
  const mine = selected.parties.find((party) => {
    if (party.userId && party.userId === accountId) return true;
    if (party.email.trim().toLowerCase() !== accountEmail.trim().toLowerCase()) return false;
    return !party.userId || party.userId === accountId;
  });
  const needsSign =
    selected.signingChannel === "native" &&
    (selected.status === "sent" || selected.status === "draft") &&
    mine?.status === "pending";
  const activities = agreementActivityEvents({
    createdAt: selectedBody.createdAt,
    updatedAt: selectedBody.updatedAt,
    status: selected.status,
    parties: selected.parties,
    voidedAt: selectedBody.voidedAt,
    voidReason: selectedBody.voidReason,
  });
  const fundingLabel = selected.fundingId
    ? fundingStatusLabel(fundingStatus.get(selected.fundingId) ?? null)
    : selectedBody.documentType === "nda" || selectedBody.documentType === "statement_of_work"
      ? null
      : selected.status === "signed"
        ? "Not started"
        : null;
  const formalCompensation = (() => {
    const gross = amounts.find((row) => /gross/i.test(row.label))?.amount;
    const fee = amounts.find((row) => /fee/i.test(row.label))?.amount;
    const net = amounts.find((row) => /net/i.test(row.label))?.amount;
    const tax = amounts.find((row) => /tax/i.test(row.label))?.amount;
    if (gross && net) {
      return {
        grossLabel: gross,
        feeLabel: fee || "$0.00",
        taxLabel: tax,
        netLabel: net,
      };
    }
    if (schedule) {
      return {
        grossLabel: schedule.totals.grossLabel,
        feeLabel: schedule.totals.feeLabel,
        netLabel: schedule.totals.netLabel,
      };
    }
    return {
      grossLabel: "—",
      feeLabel: "—",
      netLabel: "—",
    };
  })();

  return (
    <ContractAgreementDialog
      title={selected.title}
      subtitle={`${business?.name || "Business"} × ${influencers.map((party) => party.name).join(", ") || "Influencer"}`}
      signatureProgress={`${progress} of ${total} signed`}
      fundingLabel={fundingLabel}
      amounts={amounts}
      formal={{
        title: "Collaboration Agreement",
        campaign: selected.title,
        agreementRef,
        versionLabel,
        parties: [
          ...(business
            ? [
                {
                  role: "business" as const,
                  legalName: business.legalEntityName || business.name,
                  signerName: business.name,
                  capacity: business.capacity || "Authorized representative",
                  signed: business.status === "signed",
                  signedAtLabel: readableSignedAt(business.signedAt),
                },
              ]
            : []),
          ...influencers.map((party) => ({
            role: "influencer" as const,
            legalName: party.legalEntityName || party.name,
            handle: party.handle || (party.creatorSlug ? `@${party.creatorSlug}` : undefined),
            signerName: party.name,
            capacity: party.capacity || "Influencer",
            signed: party.status === "signed",
            signedAtLabel: readableSignedAt(party.signedAt),
          })),
        ],
        scope: scope || stripSignatureTokens(selectedBody.renderedBody).slice(0, 280),
        compensation: formalCompensation,
        milestones: schedule
          ? schedule.rows.map((row) => ({
              title: row.title,
              shareLabel: row.shareLabel,
              grossLabel: row.grossLabel,
              feeLabel: row.feeLabel,
              netLabel: row.netLabel,
            }))
          : [],
        draft: selected.status === "draft",
      }}
      bodyFallback={stripSignatureTokens(selectedBody.renderedBody)}
      activities={activities.map((event) => ({
        id: event.id,
        atLabel: shortDate(event.at),
        label: event.label,
        detail: event.detail,
      }))}
      parties={selected.parties.map((party) => ({
        id: party.id,
        name: party.name,
        role: party.role,
        signed: party.status === "signed",
        capacity: party.capacity || (party.role === "business" ? "Authorized representative" : "Influencer"),
        entityName: party.legalEntityName || party.name,
        signedAtLabel: party.signedAt ? readableSignedAt(party.signedAt) : undefined,
      }))}
      showDeliverables={Boolean(selected.fundingId)}
      deliverablesHref={selected.fundingId ? deliverablesHref(selected.fundingId) : null}
      downloadHref={`/collaboration/contracts/${selected.id}/pdf`}
      downloadLabel={selectedKind === "signed" ? "Download signed PDF" : "Download PDF"}
      closeHref={closeHref}
      signHref={needsSign ? `/collaboration/contracts/${selected.id}#sign` : null}
      signingAs={
        needsSign
          ? signingAsLabel({
              signerName: accountName || mine?.name || "",
              entityName: mine?.legalEntityName || mine?.name || "",
            })
          : null
      }
      primary={agreementFooterAction({
        signHref: needsSign ? `/collaboration/contracts/${selected.id}#sign` : null,
        contractHref: `/collaboration/contracts/${selected.id}?${listQuery}`,
        workspaceHref: deliverablesHref(selected.fundingId),
        depositHref: depositHref(selected.fundingId),
        role,
        contractStatus: selected.status,
        fundingId: selected.fundingId,
        fundingStatus: selected.fundingId ? fundingStatus.get(selected.fundingId) : null,
      })}
      initialTab={panel === "document" || panel === "signers" || panel === "activity" || panel === "overview" ? panel : "overview"}
    />
  );
}

function overviewInfluencerFeeCents(termsSnapshotJson: unknown): number {
  const terms = readSignedTermsSnapshot(termsSnapshotJson);
  if (!terms?.financialPlan || typeof terms.financialPlan !== "object") return 0;
  const plan = terms.financialPlan as Record<string, unknown>;
  const quote =
    plan.signedQuote && typeof plan.signedQuote === "object"
      ? (plan.signedQuote as Record<string, unknown>)
      : plan;
  const fee = quote.influencerPlatformFeeCents;
  return typeof fee === "number" && Number.isInteger(fee) && fee >= 0 ? fee : 0;
}

function EmptyContracts() {
  return (
    <section className="flex flex-col items-center gap-4 rounded-[24px] border border-[#E7ECF5] bg-white px-6 py-10 text-center sm:flex-row sm:text-left">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F0FF] text-[#6D4AFF]">
        <IconFileText size={28} />
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#1B1464]">No agreements yet</p>
        <p className="mt-1 text-sm text-[#667085]">Choose a template to start a draft, or wait for a collaboration to send an agreement.</p>
      </div>
      <Link href="/collaboration/contracts?view=templates" className="rounded-full bg-[#6D4AFF] px-4 py-2.5 text-sm font-semibold text-white">
        Browse templates →
      </Link>
    </section>
  );
}
