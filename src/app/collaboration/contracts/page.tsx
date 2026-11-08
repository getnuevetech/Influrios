import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconCalendar, IconCheck, IconEye, IconFileText, IconMail } from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { contractPartyProgress, listContractsForUser } from "@/lib/contract-document";

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

function bucket(contract: ContractRow, accountId: string, email: string): Kind {
  if (contract.status === "voided" || contract.status === "declined") return "expired";
  if (contract.status === "signed") return "signed";
  if (needsYourSignature(contract, accountId, email)) return "yours";
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

function feeLabel(source: unknown) {
  return sourceText(source, "creator_compensation") || sourceText(source, "gross") || "—";
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
  const selected =
    filtered.find((row) => row.contract.id === params.open)?.contract ?? visible[0]?.contract ?? filtered[0]?.contract ?? null;
  const selectedKind = selected ? bucket(selected, account.id, account.email) : null;
  const counterparty = (contract: ContractRow) =>
    contract.parties.find((row) => row.userId !== account.id)?.name || contract.parties[0]?.name || "—";

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
            href={`/collaboration/contracts?tab=${key}`}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 ${tab === key ? "border-[#6D4AFF] text-[#6D4AFF]" : "border-transparent"}`}
          >
            {label}
            <span className={`rounded-full px-1.5 text-[11px] ${tab === key ? "bg-[#F3EEFF]" : "bg-[#F4F6FB]"}`}>{count}</span>
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyContracts />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.78fr)]">
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
                    <th className="font-semibold">Brand</th>
                    <th className="font-semibold">Status</th>
                    <th className="font-semibold">Updated</th>
                    <th className="font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(({ contract, kind }) => {
                    const sign = needsYourSignature(contract, account.id, account.email);
                    const brand = counterparty(contract);
                    return (
                      <tr key={contract.id} className={selected?.id === contract.id ? "bg-[#F7F4FF]" : ""}>
                        <td className="py-3 pr-3">
                          <Link href={`/collaboration/contracts?tab=${tab}&open=${contract.id}&q=${encodeURIComponent(params.q ?? "")}`} className="flex items-center gap-2 font-semibold text-[#1B1464]">
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
                          <Link
                            href={
                              kind === "signed"
                                ? `/collaboration/contracts/${contract.id}/pdf`
                                : `/collaboration/contracts/${contract.id}${sign ? "#sign" : ""}`
                            }
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
                              sign ? "bg-[#6D4AFF] text-white" : "border border-[#E7ECF5] text-[#344054]"
                            }`}
                          >
                            {sign ? "Review & sign" : kind === "signed" ? "Download PDF" : "View agreement"}
                            {sign ? null : <span aria-hidden>→</span>}
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
                    href={`/collaboration/contracts?tab=${tab}&page=${number}&q=${encodeURIComponent(params.q ?? "")}`}
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${number === page ? "bg-[#6D4AFF] text-white" : "text-[#667085]"}`}
                  >
                    {number}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {selected && selectedKind ? (
            <aside className="rounded-[24px] border border-[#E7ECF5] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1B1464] text-sm font-bold text-white">
                    {counterparty(selected).slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-bold text-[#1B1464]">{selected.title}</h2>
                    <p className="text-xs text-[#98A2B3]">{selected.id.slice(0, 12)}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${PILL[selectedKind]}`}>
                  {statusLabel(selectedKind)}
                </span>
              </div>
              <dl className="mt-5 space-y-3 text-sm">
                <Detail icon={<IconUsersMini />} label="Parties" value={selected.parties.map((party) => party.name).filter(Boolean).join(" and ") || "—"} />
                <Detail icon={<IconFileText size={15} />} label="Linked collaboration" value={selected.collaborationId ? selected.title : "—"} />
                <Detail icon={<IconFee />} label="Agreed fee" value={feeLabel(selected.sourceJson)} />
                <Detail icon={<IconFileText size={15} />} label="Deliverables" value={deliverableLabel(selected.sourceJson)} />
                <Detail icon={<IconCalendar size={15} />} label="Updated" value={shortDate(selected.updatedAt)} />
              </dl>
              <div className="mt-5">
                <p className="text-sm font-semibold text-[#1B1464]">Signature progress</p>
                <ul className="mt-2 space-y-2">
                  {selected.parties.map((party) => (
                    <li
                      key={party.id}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                        party.status === "signed" ? "bg-[#E8F8EE] text-[#178A45]" : "bg-[#FFF6E8] text-[#B86E00]"
                      }`}
                    >
                      <span aria-hidden>{party.status === "signed" ? "✓" : "•"}</span>
                      {party.name || party.role}: {party.status === "signed" ? "Signed" : "Pending"}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 grid gap-2">
                <Link
                  href={`/collaboration/contracts/${selected.id}${needsYourSignature(selected, account.id, account.email) ? "#sign" : ""}`}
                  className="inline-flex items-center justify-center rounded-full bg-[#6D4AFF] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Review & sign →
                </Link>
                <Link
                  href={`/collaboration/contracts/${selected.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E7ECF5] px-4 py-2.5 text-sm font-semibold text-[#344054]"
                >
                  <IconEye size={15} /> Preview document
                </Link>
              </div>
              <p className="mt-3 text-xs text-[#98A2B3]">
                Review the full agreement before signing. {contractPartyProgress(selected.parties).label}
                {selected.signingChannel === "docusign" ? " · DocuSign" : " · In-app signing"}
              </p>
            </aside>
          ) : null}
        </div>
      )}

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

function deliverableLabel(source: unknown) {
  const block = sourceText(source, "milestones_block");
  if (!block || block.includes("(None scheduled.)")) return "—";
  const lines = block.split("\n").filter((line) => /^\d+\./.test(line.trim()));
  return lines.length ? `${lines.length} milestone${lines.length === 1 ? "" : "s"}` : "—";
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

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="inline-flex items-center gap-2 text-[#98A2B3]">
        {icon}
        {label}
      </dt>
      <dd className="max-w-[55%] text-right font-semibold text-[#1B1464]">{value}</dd>
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

function IconUsersMini() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.6-2.6 2.8-4 5.5-4s4.9 1.4 5.5 4" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M16.2 15c1.8.3 3.2 1.4 3.8 3.2" />
    </svg>
  );
}

function IconFee() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}
