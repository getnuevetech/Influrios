import { prisma } from "@/lib/db";
import { maskAccountId, stripeCapabilityStatus } from "@/lib/payment-account-routing";

const PROOF_LABEL = {
  draft: "Draft",
  sandbox_proven: "Sandbox-proven",
  live_approved: "Live-approved",
} as const;

export async function AccountRolesPanel() {
  const status = stripeCapabilityStatus();
  const [connections, accounts, routes] = await Promise.all([
    prisma.providerConnection.findMany({ orderBy: { updatedAt: "desc" }, take: 40 }).catch(() => []),
    prisma.providerAccount.findMany({ orderBy: { updatedAt: "desc" }, take: 40, include: { connection: true } }).catch(() => []),
    prisma.paymentRouteVersion.findMany({ orderBy: [{ countryCode: "asc" }, { version: "desc" }], take: 40, include: { bindings: true } }).catch(() => []),
  ]);

  return (
    <section className="mx-auto max-w-5xl space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold text-indigo">Account roles</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Subscription, Collaboration Funds, Operations, and the influencer recipient are responsibilities. A saved note does not prove Stripe access, and this screen does not move money.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-white p-5 text-sm">
        <p className="font-semibold text-indigo">Stripe capability check · {status.checkedAt}</p>
        <p className="mt-2">{status.reason}</p>
        <p className="mt-2">Allocated funds: {status.allocatedFunds}. Treasury: {status.treasury}. New collaboration funding: {status.newCollaborationFunding}.</p>
        <p className="mt-2 text-muted">Draft, sandbox-proven, and live-approved stay separate. Ordinary card checkout is not allocated-funds collection.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Connection</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Parent</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Environment</th>
              <th className="px-4 py-3">Country / currency</th>
              <th className="px-4 py-3">Capability</th>
              <th className="px-4 py-3">Last verification</th>
            </tr>
          </thead>
          <tbody>
            {routes.flatMap((route) => route.bindings).length === 0 && accounts.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-muted" colSpan={9}>
                  No verified account is stored. New collaboration funding stays off until Stripe returns allocated funds or a Treasury financial account.
                </td>
              </tr>
            ) : (
              routes.flatMap((route) =>
                route.bindings.map((binding) => {
                  const account = accounts.find((row) => row.externalAccountId && row.externalAccountId === binding.providerAccountId);
                  const proof = PROOF_LABEL[route.proofState as keyof typeof PROOF_LABEL] ?? "Draft";
                  return (
                    <tr key={binding.id} className="border-t border-[#f0f3fa]">
                      <td className="px-4 py-3 font-semibold">{binding.role}</td>
                      <td className="px-4 py-3">{account?.connection.providerCode ?? route.providerCode}</td>
                      <td className="px-4 py-3">{maskAccountId(binding.providerAccountId) || "Unverified"}</td>
                      <td className="px-4 py-3">{maskAccountId(account?.parentPlatformId ?? "") || "—"}</td>
                      <td className="px-4 py-3">{account?.accountKind ?? "—"}</td>
                      <td className="px-4 py-3">{account?.environment ?? route.environment}</td>
                      <td className="px-4 py-3">{[account?.country, route.currency].filter(Boolean).join(" · ") || route.currency}</td>
                      <td className="px-4 py-3">{proof}</td>
                      <td className="px-4 py-3">{account?.verifiedAt ? account.verifiedAt.toISOString().slice(0, 10) : "Not verified"}</td>
                    </tr>
                  );
                }),
              )
            )}
          </tbody>
        </table>
      </div>
      {connections.length > 0 ? (
        <p className="text-sm text-muted">{connections.length} provider connection{connections.length === 1 ? "" : "s"} stored. Health is unknown until a retrieve succeeds.</p>
      ) : null}
    </section>
  );
}
