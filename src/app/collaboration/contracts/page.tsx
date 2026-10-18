import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { contractPartyProgress, listContractsForUser } from "@/lib/contract-document";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contracts" };

export default async function ContractsIndexPage() {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect("/login?next=/collaboration/contracts");
  const contracts = await listContractsForUser(account.id, account.email).catch(() => []);
  const awaiting = contracts.filter((contract) => {
    const yours = contract.parties.find(
      (row) =>
        row.userId === account.id || row.email.trim().toLowerCase() === account.email.trim().toLowerCase(),
    );
    return (
      contract.signingChannel === "native" &&
      (contract.status === "sent" || contract.status === "draft") &&
      yours?.status === "pending"
    );
  });
  const signed = contracts.filter((contract) => contract.status === "signed");
  const other = contracts.filter((contract) => contract.status !== "signed" && !awaiting.includes(contract));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-indigo">Contracts</h1>
        <p className="mt-1 text-sm text-muted">
          Every agreement you are a party on — awaiting signature, in progress, and fully signed.
        </p>
      </div>

      {awaiting.length > 0 ? (
        <section className="rounded-2xl border-2 border-violet bg-[#F4F0FF] p-5">
          <h2 className="font-display text-xl font-bold text-indigo">Action required</h2>
          <p className="mt-1 text-sm text-muted">Your signature is still needed on these agreements.</p>
          <ul className="mt-4 space-y-2">
            {awaiting.map((contract) => (
              <ContractRow key={contract.id} contract={contract} accountId={account.id} accountEmail={account.email} highlight />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#E4E9F5] bg-white p-5">
        <h2 className="font-display text-xl font-bold text-indigo">Fully signed</h2>
        {signed.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No fully signed contracts yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {signed.map((contract) => (
              <ContractRow key={contract.id} contract={contract} accountId={account.id} accountEmail={account.email} />
            ))}
          </ul>
        )}
      </section>

      {other.length > 0 ? (
        <section className="rounded-2xl border border-[#E4E9F5] bg-white p-5">
          <h2 className="font-display text-xl font-bold text-indigo">In progress</h2>
          <ul className="mt-4 space-y-2">
            {other.map((contract) => (
              <ContractRow key={contract.id} contract={contract} accountId={account.id} accountEmail={account.email} />
            ))}
          </ul>
        </section>
      ) : null}

      {contracts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#C9D3EA] bg-white px-4 py-8 text-center text-sm text-muted">
          No contracts on this account yet. When a collaboration is sent for signature, it appears here.
        </p>
      ) : null}
    </div>
  );
}

function ContractRow({
  contract,
  accountId,
  accountEmail,
  highlight,
}: {
  contract: Awaited<ReturnType<typeof listContractsForUser>>[number];
  accountId: string;
  accountEmail: string;
  highlight?: boolean;
}) {
  const progress = contractPartyProgress(contract.parties);
  const yours = contract.parties.find(
    (row) => row.userId === accountId || row.email.trim().toLowerCase() === accountEmail.trim().toLowerCase(),
  );
  const needsSign =
    highlight ||
    (contract.signingChannel === "native" &&
      (contract.status === "sent" || contract.status === "draft") &&
      yours?.status === "pending");
  return (
    <li>
      <Link
        href={`/collaboration/contracts/${contract.id}${needsSign ? "#sign" : ""}`}
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-3 text-sm hover:bg-[#F7F8FC] ${
          highlight ? "bg-white" : "bg-[#F4F7FF]"
        }`}
      >
        <span>
          <span className="block font-semibold text-indigo">{contract.title}</span>
          <span className="text-xs text-muted">
            {contract.status} · {progress.label}
            {contract.signingChannel === "docusign" ? " · DocuSign" : " · In-app"}
            {yours ? ` · you: ${yours.status}` : ""}
          </span>
        </span>
        <span className="text-xs font-semibold text-violet">{needsSign ? "Sign now →" : "Open →"}</span>
      </Link>
    </li>
  );
}
