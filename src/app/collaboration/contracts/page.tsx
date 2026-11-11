import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ContractAgreementDialog, ContractRowMenu } from "@/components/contract-agreement-dialog";
import { IconCalendar, IconCheck, IconFileText, IconMail } from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { newCorrelationId } from "@/lib/correlation";
import { getWorkspace } from "@/lib/business";
import { contractHrefFromCampaign, contractOfferReady } from "@/lib/campaign-contract";
import { listContractsForUser } from "@/lib/contract-document";
import { memberDealView } from "@/lib/member-deal-money";
import { formatStoredMoney } from "@/lib/money";
import { readSignedTermsSnapshot } from "@/lib/signed-funding";
import { repairSignedAgreements } from "@/lib/signed-funding-apply";
import { prisma } from "@/lib/db";
import {
  acceptedWorkNeedsContract,
  listMarketplaceApplications,
  listWorkspaceBusinessRequests,
} from "@/lib/marketplace-listings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contracts" };

type ContractRow = Awaited<ReturnType<typeof listContractsForUser>>[number];
type Kind = "yours" | "others" | "signed" | "expired";

function shortDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(value);
}

function yours(contract: ContractRow, accountId: string, email: string, _creatorSlug = "") {
  void _creatorSlug;
  const normalized = email.trim().toLowerCase();
  return contract.parties.find((row) => {
    if (row.userId && row.userId === accountId) return true;
    if (!normalized || row.email.trim().toLowerCase() !== normalized) return false;
    return !row.userId || row.userId === accountId;
  });
}

function needsYourSignature(contract: ContractRow, accountId: string, email: string, creatorSlug = "") {
  const party = yours(contract, accountId, email, creatorSlug);
  return (
    contract.signingChannel === "native" &&
    (contract.status === "sent" || contract.status === "draft") &&
    party?.status === "pending"
  );
}

function bucket(contract: ContractRow, accountId: string, email: string, creatorSlug = ""): Kind {
  if (contract.status === "voided" || contract.status === "declined") return "expired";
  if (contract.status === "signed") return "signed";
  if (needsYourSignature(contract, accountId, email, creatorSlug)) return "yours";
  return "others";
}

function statusLabel(kind: Kind) {
  if (kind === "yours") return "Needs your signature";
  if (kind === "others") return "Awaiting others";
  if (kind === "signed") return "Fully signed";
  return "Expired";
}

function sourceText(source: unknown, key: string) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return "";
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function viewerRole(contract: ContractRow, creatorSlug: string): "business" | "influencer" {
  const creator = contract.parties.some((party) => party.role === "creator" && creatorSlug && party.creatorSlug === creatorSlug);
  return creator ? "influencer" : "business";
}

function amountLines(contract: ContractRow, creatorSlug: string) {
  const terms = readSignedTermsSnapshot(contract.termsSnapshotJson);
  const view = memberDealView({
    role: viewerRole(contract, creatorSlug),
    grossCents: terms?.grossCents ?? 0,
    feeCents: 0,
    plan: terms?.financialPlan ? { financialPlan: terms.financialPlan } : null,
  });
  if (!terms || !view.feeReady || view.lines.length === 0) return [];
  return view.lines.map((line) => ({
    label: line.label === "You pay" ? "Total you pay" : line.label,
    amount: formatStoredMoney(line.amountCents, terms.currency),
    emphasis: line.label === "You pay" || line.label === "Net payout" || line.label === "You receive",
  }));
}

function partyNamed(contract: ContractRow, role: "business" | "creator") {
  const names = contract.parties
    .filter((party) => (role === "creator" ? party.role === "creator" || party.role === "influencer" : party.role === "business"))
    .map((party) => party.name.trim())
    .filter(Boolean);
  return names.join(", ");
}

function deliverableLines(source: unknown) {
  const block = sourceText(source, "milestones_block");
  if (!block || block.includes("(None scheduled.)")) return [];
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\./.test(line));
}

const PILL: Record<Kind, string> = {
  yours: "bg-[#FFF4D8] text-[#B86E00]",
  others: "bg-[#F3EEFF] text-[#6D4AFF]",
  signed: "bg-[#E8F8EE] text-[#178A45]",
  expired: "bg-[#FDECEC] text-[#D14343]",
};

const PAGE_SIZE = 6;

export default async function ContractsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; open?: string; q?: string; page?: string }>;
}) {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect("/login?next=/collaboration/contracts");
  const params = await searchParams;
  const contractLoad = await listContractsForUser(account.id, account.email)
    .then((rows) => ({ rows, failed: false }))
    .catch(() => ({ rows: [], failed: true }));
  const [creator, workspace] = await Promise.all([
    prisma.creator.findUnique({ where: { userId: account.id }, select: { slug: true } }).catch(() => null),
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
  const ownedRequests =
    workspace && workspace.businessId !== "public"
      ? await listWorkspaceBusinessRequests(workspace.businessId).catch(() => [])
      : [];
  const ownedIds = ownedRequests.map((row) => row.id);
  const ownedBriefIds = workspace?.briefs.map((brief) => brief.id) ?? [];
  const [creatorApplications, businessApplications] = await Promise.all([
    creatorSlug
      ? listMarketplaceApplications({ creatorSlug, limit: 40 }).catch(() => [])
      : Promise.resolve([]),
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
    kind: bucket(contract, account.id, account.email, creatorSlug),
  }));
  const counts = {
    all: rows.length + needed.length,
    yours: rows.filter((row) => row.kind === "yours").length + needed.length,
    others: rows.filter((row) => row.kind === "others").length,
    signed: rows.filter((row) => row.kind === "signed").length,
    expired: rows.filter((row) => row.kind === "expired").length,
  };
  const tab = (["yours", "others", "signed", "expired"].includes(params.tab ?? "") ? params.tab : "all") as
    | "all"
    | Kind;
  const q = params.q?.trim().toLowerCase() ?? "";
  const filtered = (tab === "all" ? rows : rows.filter((row) => row.kind === tab)).filter(({ contract }) => {
    if (!q) return true;
    const hay = `${contract.title} ${contract.parties.map((party) => party.name).join(" ")}`.toLowerCase();
    return hay.includes(q);
  });
  const page = Math.max(1, Number(params.page) || 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = params.open ? contracts.find((contract) => contract.id === params.open) ?? null : null;
  const selectedKind = selected ? bucket(selected, account.id, account.email, creatorSlug) : null;
  const selectedBody = selected
    ? await prisma.contractDocument
        .findUnique({ where: { id: selected.id }, select: { renderedBody: true } })
        .catch(() => null)
    : null;
  const viewerIsBusiness = account.role === "BUSINESS" || account.role === "AGENCY";
  const listQuery = `tab=${tab}&q=${encodeURIComponent(params.q ?? "")}&page=${page}`;
  const closeHref = `/collaboration/contracts?${listQuery}`;
  const counterparty = (contract: ContractRow) => {
    const named = viewerIsBusiness ? partyNamed(contract, "creator") : partyNamed(contract, "business");
    return named || contract.parties.find((row) => row.userId !== account.id)?.name || "—";
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[2rem] font-bold leading-none text-[#1B1464]">Contracts</h1>
        <p className="mt-2 text-sm text-[#667085]">Review agreements, track signatures, and access signed copies.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Needs your signature" value={counts.yours} tone="text-[#6D4AFF]" icon={<PenIcon />} chip="bg-[#F4F0FF] text-[#6D4AFF]" />
        <Stat label="Awaiting others" value={counts.others} tone="text-[#2F6BFF]" icon={<IconMail size={18} />} chip="bg-[#EEF3FF] text-[#2F6BFF]" />
        <Stat label="Fully signed" value={counts.signed} tone="text-[#178A45]" icon={<IconCheck size={18} />} chip="bg-[#E8F8EE] text-[#178A45]" />
        <Stat label="Expired" value={counts.expired} tone="text-[#D14343]" icon={<IconCalendar size={18} />} chip="bg-[#FDECEC] text-[#D14343]" />
      </div>

      {counts.yours > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F3D7A1] bg-[#FFF8EC] px-4 py-3 text-sm text-[#8A5A12]">
          <span className="inline-flex items-center gap-2 font-medium">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F6E2B8] text-[11px]">!</span>
            {counts.yours} agreement{counts.yours === 1 ? " is" : "s are"} ready for your review.
          </span>
          <Link href="/collaboration/contracts?tab=yours" className="rounded-full border border-[#E7C48A] bg-white px-3 py-1.5 text-xs font-semibold">
            Review now →
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1 border-b border-[#E7ECF5] text-sm font-semibold text-[#667085]">
        {(
          [
            ["all", "All", counts.all],
            ["yours", "Needs your signature", counts.yours],
            ["others", "Awaiting others", counts.others],
            ["signed", "Fully signed", counts.signed],
            ["expired", "Expired", counts.expired],
          ] as const
        ).map(([key, label, count]) => (
          <Link
            key={key}
            href={`/collaboration/contracts?tab=${key}&q=${encodeURIComponent(params.q ?? "")}`}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 ${tab === key ? "border-[#6D4AFF] text-[#6D4AFF]" : "border-transparent"}`}
          >
            {label}
            <span className={`rounded-full px-1.5 text-[11px] ${tab === key ? "bg-[#F3EEFF]" : "bg-[#F4F6FB]"}`}>{count}</span>
          </Link>
        ))}
      </div>

      {needed.length > 0 && (tab === "all" || tab === "yours") ? (
        <section className="rounded-[24px] border border-[#F3D7A1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
          <h2 className="font-display text-lg font-bold text-[#1B1464]">Contract needed</h2>
          <p className="mt-1 text-sm text-[#667085]">
            These accepted collaborations do not have an agreement yet. A signature request appears here after the agreement is created.
          </p>
          <ul className="mt-3 divide-y divide-[#EEF2F7]">
            {needed.map((application) => {
              const slug = (application.fromSlug || application.toSlug || "").trim();
              const owned = Boolean(
                (application.businessRequestId && ownedIds.includes(application.businessRequestId)) ||
                  ((application.briefId || application.requestBriefId) &&
                    ownedBriefIds.includes((application.briefId || application.requestBriefId) ?? "")),
              );
              const brief =
                workspace?.briefs.find((item) => item.id === (application.briefId || application.requestBriefId)) ??
                null;
              const title = brief?.title || application.requestBrand || application.opportunityLookingFor || "Accepted collaboration";
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
                      {shortlisted ? "Ready for a contract" : "Shortlist this influencer before creating a contract"} ·{" "}
                      {application.status.replaceAll("_", " ")}
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
        <div>
          <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-[#1B1464]">Your agreements</h2>
              <form action="/collaboration/contracts" className="flex flex-wrap gap-2">
                <input type="hidden" name="tab" value={tab} />
                <input
                  name="q"
                  defaultValue={params.q ?? ""}
                  placeholder="Search agreements..."
                  className="h-10 w-44 rounded-full border border-[#E7ECF5] bg-[#F8FAFC] px-4 text-sm outline-none"
                />
              </form>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                  <tr className="border-b border-[#EEF2F7]">
                    <th className="py-2 font-semibold">Agreement</th>
                    <th className="font-semibold">{viewerIsBusiness ? "Influencer" : "Company"}</th>
                    <th className="font-semibold">Status</th>
                    <th className="font-semibold">Updated</th>
                    <th className="font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(({ contract, kind }) => {
                    const sign = needsYourSignature(contract, account.id, account.email, creatorSlug);
                    const brand = counterparty(contract);
                    const work = deliverablesHref(contract.fundingId);
                    const openHref = `/collaboration/contracts?${listQuery}&open=${contract.id}`;
                    const menu = [
                      ...(sign
                        ? [{ href: `/collaboration/contracts/${contract.id}#sign`, label: "Review & sign" }]
                        : []),
                      {
                        href: `/collaboration/contracts/${contract.id}/pdf`,
                        label: kind === "signed" ? "Download signed copy" : "Download",
                      },
                      ...(work ? [{ href: work, label: "Deliverables" }] : []),
                      ...(depositHref(contract.fundingId)
                        ? [{ href: depositHref(contract.fundingId)!, label: "Deposit funds" }]
                        : []),
                    ];
                    return (
                      <tr key={contract.id} className={selected?.id === contract.id ? "bg-[#F7F4FF]" : ""}>
                        <td className="py-3 pr-3">
                          <Link href={openHref} scroll={false} className="flex items-center gap-2 font-semibold text-[#1B1464]">
                            <span className="text-[#98A2B3]">
                              <IconFileText size={16} />
                            </span>
                            {contract.title}
                          </Link>
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-2 text-[#344054]">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F3EEFF] text-[11px] font-bold text-[#6D4AFF]">
                              {brand.slice(0, 1).toUpperCase()}
                            </span>
                            {brand}
                          </span>
                        </td>
                        <td>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${PILL[kind]}`}>{statusLabel(kind)}</span>
                        </td>
                        <td className="text-[#667085]">{shortDate(contract.updatedAt)}</td>
                        <td>
                          <span className="inline-flex items-center gap-1">
                            <Link
                              href={openHref}
                              scroll={false}
                              className="inline-flex items-center gap-1 rounded-full border border-[#E7ECF5] px-3 py-1.5 text-xs font-semibold text-[#344054]"
                            >
                              View agreement
                              <span aria-hidden>→</span>
                            </Link>
                            <ContractRowMenu items={menu} />
                          </span>
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
                    href={`/collaboration/contracts?tab=${tab}&page=${number}&q=${encodeURIComponent(params.q ?? "")}`}
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${number === page ? "bg-[#6D4AFF] text-white" : "text-[#667085]"}`}
                  >
                    {number}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {selected && selectedKind ? (
        <ContractAgreementDialog
          title={selected.title}
          status={statusLabel(selectedKind)}
          statusClass={PILL[selectedKind]}
          company={partyNamed(selected, "business") || "—"}
          influencer={partyNamed(selected, "creator") || "—"}
          updated={shortDate(selected.updatedAt)}
          parties={selected.parties.map((party) => ({
            id: party.id,
            name: party.name,
            role: party.role,
            signed: party.status === "signed",
          }))}
          amounts={amountLines(selected, creatorSlug)}
          body={selectedBody?.renderedBody ?? ""}
          deliverables={deliverableLines(selected.sourceJson)}
          showDeliverables={Boolean(selected.fundingId)}
          deliverablesHref={selected.fundingId ? deliverablesHref(selected.fundingId) : null}
          downloadHref={`/collaboration/contracts/${selected.id}/pdf`}
          downloadLabel={selectedKind === "signed" ? "Download signed copy" : "Download"}
          closeHref={closeHref}
          signHref={
            needsYourSignature(selected, account.id, account.email, creatorSlug)
              ? `/collaboration/contracts/${selected.id}#sign`
              : null
          }
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-[#1B1464]">Recent contract activity</h2>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-[#667085]">No contract activity yet.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {rows.slice(0, 4).map(({ contract, kind }) => (
                <li key={contract.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#6D4AFF]" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#1B1464]">{statusLabel(kind)}</p>
                    <p className="text-sm text-[#667085]">{contract.title}</p>
                  </div>
                  <span className="text-xs text-[#98A2B3]">{shortDate(contract.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-[#1B1464]">How contracts work</h2>
          <ol className="mt-4 space-y-4 text-sm text-[#344054]">
            <li className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F4F0FF] text-[#6D4AFF]">
                <IconFileText size={16} />
              </span>
              <span>
                <span className="block font-semibold text-[#1B1464]">Review terms</span>
                Read the agreement details, deliverables, and compensation.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F4F0FF] text-[#6D4AFF]">
                <PenIcon />
              </span>
              <span>
                <span className="block font-semibold text-[#1B1464]">Sign securely</span>
                Add your signature through the Influrios signing flow.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F4F0FF] text-[#6D4AFF]">
                <IconCheck size={16} />
              </span>
              <span>
                <span className="block font-semibold text-[#1B1464]">Download signed copy</span>
                Access a copy once every party has signed.
              </span>
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}

function EmptyContracts() {
  return (
    <section className="flex flex-col items-center gap-4 rounded-[24px] border border-[#E7ECF5] bg-white px-6 py-10 text-center sm:flex-row sm:text-left">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F0FF] text-[#6D4AFF]">
        <IconFileText size={28} />
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#1B1464]">When no contracts exist</p>
        <p className="mt-1 text-sm text-[#667085]">Your agreements will appear here when a collaboration is sent for signature.</p>
      </div>
      <Link href="/collaboration/hub?view=collaborations" className="rounded-full bg-[#6D4AFF] px-4 py-2.5 text-sm font-semibold text-white">
        View collaborations →
      </Link>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
  chip,
}: {
  label: string;
  value: number;
  tone: string;
  icon: ReactNode;
  chip: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#E7ECF5] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${chip}`}>{icon}</span>
      <div>
        <p className="text-[13px] font-medium text-[#667085]">{label}</p>
        <p className={`font-display text-[1.7rem] font-bold leading-none ${tone}`}>{value}</p>
      </div>
    </div>
  );
}

function PenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 20h4l10-10-4-4L4 16v4Z" />
      <path d="M13 7l4 4" />
    </svg>
  );
}

