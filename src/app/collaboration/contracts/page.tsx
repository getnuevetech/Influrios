import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { contractPartyProgress, listContractsForUser } from "@/lib/contract-document";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contracts" };

type ContractRow = Awaited<ReturnType<typeof listContractsForUser>>[number];

function shortDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(value);
}

function yours(contract: ContractRow, accountId: string, email: string) {
  return contract.parties.find(
    (row) => row.userId === accountId || row.email.trim().toLowerCase() === email.trim().toLowerCase(),
  );
}

function needsYourSignature(contract: ContractRow, accountId: string, email: string) {
  const party = yours(contract, accountId, email);
  return (
    contract.signingChannel === "native" &&
    (contract.status === "sent" || contract.status === "draft") &&
    party?.status === "pending"
  );
}

function bucket(contract: ContractRow, accountId: string, email: string) {
  if (contract.status === "voided" || contract.status === "declined") return "expired";
  if (contract.status === "signed") return "signed";
  if (needsYourSignature(contract, accountId, email)) return "yours";
  return "others";
}

function statusLabel(kind: string) {
  if (kind === "yours") return "Needs your signature";
  if (kind === "others") return "Awaiting others";
  if (kind === "signed") return "Fully signed";
  return "Expired";
}

function feeLabel(source: unknown) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return "—";
  const record = source as Record<string, unknown>;
  const value = record.creator_compensation ?? record.gross ?? record.agreedFee;
  return typeof value === "string" && value.trim() ? value.trim() : "—";
}

export default async function ContractsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; open?: string }>;
}) {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect("/login?next=/collaboration/contracts");
  const params = await searchParams;
  const contracts = await listContractsForUser(account.id, account.email).catch(() => []);
  const rows = contracts.map((contract) => ({
    contract,
    kind: bucket(contract, account.id, account.email),
  }));
  const counts = {
    all: rows.length,
    yours: rows.filter((row) => row.kind === "yours").length,
    others: rows.filter((row) => row.kind === "others").length,
    signed: rows.filter((row) => row.kind === "signed").length,
    expired: rows.filter((row) => row.kind === "expired").length,
  };
  const tab = ["yours", "others", "signed", "expired"].includes(params.tab ?? "") ? params.tab! : "all";
  const visible = tab === "all" ? rows : rows.filter((row) => row.kind === tab);
  const selected =
    visible.find((row) => row.contract.id === params.open)?.contract ?? visible[0]?.contract ?? null;
  const selectedKind = selected ? bucket(selected, account.id, account.email) : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#1a1464]">Contracts</h1>
        <p className="mt-1 text-sm text-[#6b7394]">Review agreements, track signatures, and access signed copies.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Needs your signature" value={counts.yours} tone="violet" />
        <Stat label="Awaiting others" value={counts.others} tone="blue" />
        <Stat label="Fully signed" value={counts.signed} tone="green" />
        <Stat label="Expired" value={counts.expired} tone="red" />
      </div>

      {counts.yours > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F3D7A4] bg-[#FFF7E8] px-4 py-3 text-sm text-[#8A5A12]">
          <span>{counts.yours} agreement{counts.yours === 1 ? " is" : "s are"} ready for your review.</span>
          <Link href="/collaboration/contracts?tab=yours" className="rounded-full border border-[#E7C48A] bg-white px-3 py-1 text-xs font-semibold">
            Review now →
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-[#E6ECF7] text-sm font-semibold text-[#5c6588]">
        {[
          ["all", `All ${counts.all}`],
          ["yours", `Needs your signature ${counts.yours}`],
          ["others", `Awaiting others ${counts.others}`],
          ["signed", `Fully signed ${counts.signed}`],
          ["expired", `Expired ${counts.expired}`],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/collaboration/contracts?tab=${key}`}
            className={`border-b-2 px-3 py-2 ${tab === key ? "border-[#6d4aff] text-[#6d4aff]" : "border-transparent"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <section className="rounded-3xl border border-[#E6ECF7] bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-[#1a1464]">When no contracts exist</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#6b7394]">
            Your agreements will appear here when a collaboration is sent for signature.
          </p>
          <Link href="/collaboration/hub?view=collaborations" className="btn-primary mt-4 inline-flex">
            View collaborations →
          </Link>
        </section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <section className="rounded-3xl border border-[#E6ECF7] bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#1a1464]">Your agreements</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-[#8b93ad]">
                  <tr>
                    <th className="py-2">Agreement</th>
                    <th>Brand</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(({ contract, kind }) => {
                    const party = contract.parties.find((row) => row.userId !== account.id) ?? contract.parties[0];
                    const sign = needsYourSignature(contract, account.id, account.email);
                    return (
                      <tr key={contract.id} className={selected?.id === contract.id ? "bg-[#F4F0FF]" : ""}>
                        <td className="py-3 font-semibold text-[#1a1464]">
                          <Link href={`/collaboration/contracts?tab=${tab}&open=${contract.id}`}>{contract.title}</Link>
                        </td>
                        <td>{party?.name || "—"}</td>
                        <td>
                          <span className="rounded-full bg-[#F4F0FF] px-2 py-1 text-[11px] font-semibold text-[#6d4aff]">
                            {statusLabel(kind)}
                          </span>
                        </td>
                        <td className="text-[#6b7394]">{shortDate(contract.updatedAt)}</td>
                        <td>
                          <Link
                            href={
                              kind === "signed"
                                ? `/collaboration/contracts/${contract.id}/pdf`
                                : `/collaboration/contracts/${contract.id}${sign ? "#sign" : ""}`
                            }
                            className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${
                              sign ? "bg-[#6d4aff] text-white" : "border border-[#E6ECF7] text-[#1a1464]"
                            }`}
                          >
                            {sign ? "Review & sign" : kind === "signed" ? "Download PDF" : "View agreement →"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {selected && selectedKind ? (
            <aside className="rounded-3xl border border-[#E6ECF7] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-[#1a1464]">{selected.title}</h2>
                  <p className="text-xs text-[#8b93ad]">{selected.id.slice(0, 12)}</p>
                </div>
                <span className="rounded-full bg-[#FFF4D8] px-2 py-1 text-[11px] font-semibold text-[#8A5A12]">
                  {statusLabel(selectedKind)}
                </span>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Parties" value={selected.parties.map((party) => party.name).filter(Boolean).join(" and ") || "—"} />
                <Row label="Linked collaboration" value={selected.collaborationId ? selected.title : "—"} />
                <Row label="Agreed fee" value={feeLabel(selected.sourceJson)} />
                <Row label="Updated" value={shortDate(selected.updatedAt)} />
              </dl>
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8b93ad]">Signature progress</p>
                <ul className="mt-2 space-y-2">
                  {selected.parties.map((party) => (
                    <li
                      key={party.id}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                        party.status === "signed" ? "bg-[#E9F8EF] text-[#157A45]" : "bg-[#FFF4D8] text-[#8A5A12]"
                      }`}
                    >
                      {party.name || party.role}: {party.status === "signed" ? "Signed" : "Pending"}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/collaboration/contracts/${selected.id}${needsYourSignature(selected, account.id, account.email) ? "#sign" : ""}`}
                  className="btn-primary"
                >
                  Review & sign →
                </Link>
                <Link href={`/collaboration/contracts/${selected.id}`} className="btn-secondary">
                  Preview document
                </Link>
              </div>
              <p className="mt-3 text-xs text-[#8b93ad]">
                {contractPartyProgress(selected.parties).label}
                {selected.signingChannel === "docusign" ? " · DocuSign" : " · In-app"}
              </p>
            </aside>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-[#E6ECF7] bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#1a1464]">Recent contract activity</h2>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-[#6b7394]">No contract activity yet.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {rows.slice(0, 4).map(({ contract, kind }) => (
                <li key={contract.id}>
                  <p className="font-semibold text-[#1a1464]">{statusLabel(kind)}</p>
                  <p className="text-[#6b7394]">{contract.title}</p>
                  <p className="text-xs text-[#8b93ad]">{shortDate(contract.updatedAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-3xl border border-[#E6ECF7] bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#1a1464]">How contracts work</h2>
          <ol className="mt-3 space-y-2 text-sm text-[#394066]">
            <li>Review terms, deliverables, and compensation.</li>
            <li>Sign in the Influrios signing flow.</li>
            <li>Download the signed copy after every party has signed.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "violet" | "blue" | "green" | "red" }) {
  const color = { violet: "text-[#6d4aff]", blue: "text-[#3d6bff]", green: "text-[#159a4a]", red: "text-[#d14343]" }[tone];
  return (
    <div className="rounded-2xl border border-[#E6ECF7] bg-white px-4 py-3 shadow-sm">
      <p className={`font-display text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs font-semibold text-[#6b7394]">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[#8b93ad]">{label}</dt>
      <dd className="text-right font-semibold text-[#1a1464]">{value}</dd>
    </div>
  );
}
