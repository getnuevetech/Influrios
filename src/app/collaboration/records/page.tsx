import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { getCreatorSessionDraft } from "@/lib/claim";
import { listCollaborations } from "@/lib/collaborations";
import { contractPartyProgress, listContractsForUser } from "@/lib/contract-document";
import { getDirectory, indexCreatorsBySlug } from "@/lib/directory";
import { formatStoredMoney } from "@/lib/money";
import {
  applicationIsAcceptedPipeline,
  applicationKindLabel,
  listMarketplaceApplications,
  listWorkspaceBusinessRequests,
} from "@/lib/marketplace-listings";
import { listFundingsForBusiness, listFundingsForCreator } from "@/lib/marketplace-ledger";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Active Collaborations" };

type Props = { searchParams: Promise<{ from?: string }> };

type ActiveRow = {
  id: string;
  kind: "funding" | "proposal" | "application" | "contract";
  title: string;
  status: string;
  counterparty: string;
  meta?: string;
  href: string;
};

export default async function CollaborationRecordsPage({ searchParams }: Props) {
  const params = await searchParams;
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect("/login?next=/collaboration/records");

  const isBusiness = account.role === "BUSINESS" || account.role === "AGENCY";
  const draft = await getCreatorSessionDraft().catch(() => null);
  const creator = await prisma.creator
    .findUnique({ where: { userId: account.id }, select: { slug: true, displayName: true } })
    .catch(() => null);
  const creatorSlug = (params.from?.trim() || creator?.slug || draft?.slug || "").trim();

  const ws = isBusiness ? await getWorkspace(account.id).catch(() => null) : null;
  const directory = await getDirectory().catch(() => null);
  const bySlug = indexCreatorsBySlug(directory?.creators ?? []);

  const rows: ActiveRow[] = [];

  if (isBusiness && ws && ws.businessId !== "public") {
    const [fundings, ownRequests, contracts] = await Promise.all([
      listFundingsForBusiness(ws.businessId).catch(() => []),
      listWorkspaceBusinessRequests(ws.businessId).catch(() => []),
      listContractsForUser(account.id, account.email).catch(() => []),
    ]);
    const applications = ownRequests.length
      ? await listMarketplaceApplications({
          businessRequestIds: ownRequests.map((row) => row.id),
          limit: 40,
        }).catch(() => [])
      : [];

    for (const funding of fundings) {
      const creatorRow = bySlug.get(funding.creatorSlug);
      rows.push({
        id: `funding-${funding.id}`,
        kind: "funding",
        title: funding.title,
        status: funding.status,
        counterparty: creatorRow?.displayName ?? funding.creatorSlug,
        meta: formatStoredMoney(funding.grossCents, funding.currency),
        href: "/payments",
      });
    }

    for (const app of applications.filter((row) => applicationIsAcceptedPipeline(row.status) || row.status === "RESPONDED" || row.status === "NEGOTIATING")) {
      const creatorRow = app.creatorSlug ? bySlug.get(app.creatorSlug) : null;
      rows.push({
        id: `app-${app.id}`,
        kind: "application",
        title: app.requestBrand ?? applicationKindLabel(app),
        status: app.status,
        counterparty: creatorRow?.displayName ?? app.creatorSlug ?? "Creator",
        meta: applicationKindLabel(app),
        href: `/collaboration/applications/${app.id}`,
      });
    }

    for (const contract of contracts) {
      const progress = contractPartyProgress(contract.parties);
      rows.push({
        id: `contract-${contract.id}`,
        kind: "contract",
        title: contract.title,
        status: contract.status,
        counterparty: progress.label,
        href: `/collaboration/contracts/${contract.id}`,
      });
    }
  } else if (creatorSlug) {
    const [collaborations, fundings, applications, contracts] = await Promise.all([
      listCollaborations({ slug: creatorSlug }).catch(() => []),
      listFundingsForCreator(creatorSlug).catch(() => []),
      listMarketplaceApplications({ creatorSlug, limit: 40 }).catch(() => []),
      listContractsForUser(account.id, account.email).catch(() => []),
    ]);

    for (const funding of fundings) {
      rows.push({
        id: `funding-${funding.id}`,
        kind: "funding",
        title: funding.title,
        status: funding.status,
        counterparty: funding.businessName,
        meta: formatStoredMoney(funding.grossCents, funding.currency),
        href: "/payments",
      });
    }

    for (const record of collaborations.filter((row) =>
      ["draft", "sent", "accepted"].includes(row.status),
    )) {
      const otherSlug = record.initiatorSlug === creatorSlug ? record.recipientSlug : record.initiatorSlug;
      const other = bySlug.get(otherSlug);
      rows.push({
        id: `proposal-${record.id}`,
        kind: "proposal",
        title: record.title,
        status: record.status,
        counterparty: other?.displayName ?? otherSlug,
        href: `/collaboration/records/${record.id}`,
      });
    }

    for (const app of applications.filter(
      (row) =>
        applicationIsAcceptedPipeline(row.status) ||
        row.status === "REQUESTED" ||
        row.status === "VIEWED" ||
        row.status === "RESPONDED" ||
        row.status === "NEGOTIATING",
    )) {
      rows.push({
        id: `app-${app.id}`,
        kind: "application",
        title: app.requestBrand ?? app.opportunityLookingFor ?? applicationKindLabel(app),
        status: app.status,
        counterparty: applicationKindLabel(app),
        href: `/collaboration/applications/${app.id}`,
      });
    }

    for (const contract of contracts) {
      const progress = contractPartyProgress(contract.parties);
      rows.push({
        id: `contract-${contract.id}`,
        kind: "contract",
        title: contract.title,
        status: contract.status,
        counterparty: progress.label,
        href: `/collaboration/contracts/${contract.id}`,
      });
    }
  }

  const kindLabel: Record<ActiveRow["kind"], string> = {
    funding: "Funded collaboration",
    proposal: "Proposal",
    application: "Application",
    contract: "Contract",
  };

  const homeHref = isBusiness ? "/collaboration/business" : "/collaboration/hub?view=collaborations";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <Link href={homeHref} className="text-sm font-semibold text-violet hover:underline">
          ← Collaboration hub
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Active Collaborations</h1>
        <p className="mt-2 text-sm text-muted">
          Funded work, accepted invitations, proposals, and contracts on this account.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#C9D3EA] bg-white px-4 py-10 text-center">
          <p className="text-sm font-semibold text-indigo">No active collaborations yet</p>
          <p className="mt-2 text-sm text-muted">
            {isBusiness
              ? "When creators accept invitations or you fund a collaboration, it appears here."
              : "When you accept an invitation or a brand funds a collaboration, it appears here."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href={homeHref} className="text-sm font-bold text-violet hover:underline">
              Open collaboration hub →
            </Link>
            <Link href="/collaboration/contracts" className="text-sm font-bold text-violet hover:underline">
              View contracts →
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className="block rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm hover:border-violet"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-violet">
                      {kindLabel[row.kind]}
                    </p>
                    <p className="mt-1 font-semibold text-indigo">{row.title}</p>
                    <p className="mt-1 text-sm text-muted">
                      {row.counterparty}
                      {row.meta ? ` · ${row.meta}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#EAE4FF] px-2.5 py-1 text-[10px] font-bold uppercase text-violet">
                    {row.status.replaceAll("_", " ")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
