import Link from "next/link";
import { RouteDraftForm } from "@/app/admin/payment-settings/route-draft-form";
import { RecordDialog } from "@/components/payment-journey/record-dialog";
import { prisma } from "@/lib/db";
import { maskAccountId } from "@/lib/payment-account-routing";
import { routeReadiness } from "@/lib/payment-standard-v4";

const TABS = [
  ["overview", "Overview"],
  ["mapping", "Account mapping"],
  ["capabilities", "Capabilities"],
  ["verification", "Verification"],
  ["tax", "Tax"],
  ["history", "History"],
] as const;

type TabId = (typeof TABS)[number][0];

type RoleRow = {
  role?: string;
  owner?: string;
  providerAccount?: string;
  externalAccountId?: string;
  financialAccountId?: string;
  environment?: string;
  verified?: boolean;
  operations?: string[];
};
type CapabilityRow = {
  methods?: string[];
  ach?: boolean;
  refunds?: boolean;
  reversals?: boolean;
  bankPayoutControl?: boolean;
  verificationWorkflow?: boolean;
};

function rolesOf(value: unknown): RoleRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is RoleRow => Boolean(row) && typeof row === "object");
}

function capabilitiesOf(value: unknown): CapabilityRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as CapabilityRow;
}

export async function RouteVersionPanel({ routeId, routeTab }: { routeId?: string; routeTab?: string }) {
  const [routes, policies] = await Promise.all([
    prisma.paymentRouteVersion.findMany({ orderBy: [{ countryCode: "asc" }, { version: "desc" }] }).catch(() => []),
    prisma.taxPolicyVersion.findMany({ orderBy: { createdAt: "desc" }, take: 40 }).catch(() => []),
  ]);
  const selected = routes.find((row) => row.id === routeId) ?? null;
  const tab: TabId = TABS.some(([id]) => id === routeTab) ? (routeTab as TabId) : "overview";
  const closeHref = "/admin/payment-settings?section=routes";

  return (
    <section data-screen="A01" className="mx-auto mt-6 max-w-5xl space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold text-indigo">Route versions</h2>
        <p className="mt-1 text-sm text-muted">
          View a version to see its accounts, capabilities, verification, tax, and history. Opening a route does not move money or reroute a funded agreement.
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Currency</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Environment</th>
              <th className="px-4 py-3">Readiness</th>
              <th className="px-4 py-3">New funding</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3"> </th>
            </tr>
          </thead>
          <tbody>
            {routes.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-muted" colSpan={8}>No route version yet. A draft stays off until the provider approves allocated funds.</td>
              </tr>
            ) : routes.map((route) => (
              <tr key={route.id} className="border-t border-[#f0f3fa]">
                <td className="px-4 py-3 font-semibold">{route.countryCode}</td>
                <td className="px-4 py-3">{route.currency}</td>
                <td className="px-4 py-3">{route.providerCode}</td>
                <td className="px-4 py-3">{route.environment}</td>
                <td className="px-4 py-3">{route.allocatedFundsApproved ? route.status : "Provider approval required"}</td>
                <td className="px-4 py-3">{route.newCollectionsEnabled ? "Open" : "Blocked"}</td>
                <td className="px-4 py-3">v{route.version}</td>
                <td className="px-4 py-3">
                  <Link href={`${closeHref}&route=${route.id}&routeTab=overview`} className="font-semibold text-violet">View route</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RouteDraftForm />
      {selected ? (
        <RecordDialog title={`${selected.countryCode} · ${selected.currency} · ${selected.environment}`} closeHref={closeHref}>
          <p className="text-sm text-muted">Environment {selected.environment}. A provider name is not approval.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {TABS.map(([id, label]) => (
              <Link
                key={id}
                href={`${closeHref}&route=${selected.id}&routeTab=${id}`}
                className={`inline-flex h-11 items-center rounded-full px-3 text-sm font-semibold ${tab === id ? "bg-lavender text-indigo" : "text-muted"}`}
                scroll={false}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="mt-4 text-sm">
            <RouteTab route={selected} tab={tab} policies={policies} history={routes.filter((row) => row.countryCode === selected.countryCode && row.environment === selected.environment)} />
          </div>
        </RecordDialog>
      ) : null}
    </section>
  );
}

function RouteTab({
  route,
  tab,
  policies,
  history,
}: {
  route: {
    id: string;
    countryCode: string;
    version: number;
    currency: string;
    environment: string;
    providerCode: string;
    status: string;
    newCollectionsEnabled: boolean;
    releasesEnabled: boolean;
    roleMappingJson: unknown;
    capabilitiesJson: unknown;
    taxPolicyId: string;
    approvalEvidence: string;
    allocatedFundsApproved: boolean;
    topology?: string;
    proofState?: string;
    bankPayoutControl?: boolean;
    operationsWithdrawalEnabled?: boolean;
    effectiveFrom: Date;
    createdAt: Date;
  };
  tab: TabId;
  policies: { id: string; name: string; version: number; treatment: string; filingOwner: string; status: string }[];
  history: { id: string; version: number; status: string; createdAt: Date; newCollectionsEnabled: boolean }[];
}) {
  const capabilities = capabilitiesOf(route.capabilitiesJson);
  const topologyProven = route.proofState === "sandbox_proven" || route.proofState === "live_approved";
  const readiness = routeReadiness({
    domesticRule: /^[A-Z]{2}$/.test(route.countryCode),
    currency: /^[A-Z]{3}$/.test(route.currency),
    cardMethod: (capabilities.methods ?? []).includes("card"),
    holdingEvidence: route.allocatedFundsApproved || topologyProven,
    payoutMethod: route.providerCode.trim().length > 0,
    refundSupport: capabilities.refunds !== false && capabilities.reversals !== false,
    bankPayoutControl: route.bankPayoutControl === true || capabilities.bankPayoutControl === true,
    verificationWorkflow: capabilities.verificationWorkflow === true,
    taxOwner: policies.some((policy) => policy.id === route.taxPolicyId && policy.filingOwner.trim().length > 0),
    productionApproval: route.status === "active" && route.environment === "live",
    allocatedFundsApproved: route.allocatedFundsApproved || topologyProven,
  });
  const policy = policies.find((row) => row.id === route.taxPolicyId) ?? null;
  if (tab === "mapping") {
    const roles = rolesOf(route.roleMappingJson);
    return (
      <div className="space-y-3">
        <p>Three logical roles plus the recipient account. Balances shown here are the recorded provider accounts, not a live transfer.</p>
        {roles.length === 0 ? <p>No account mapping is stored on this version.</p> : roles.map((role) => (
          <article key={role.role} className="rounded-2xl border border-border p-3">
            <p className="font-semibold">{role.role}</p>
            <p>Owner {role.owner}</p>
            <p>Account {maskAccountId(role.externalAccountId || role.providerAccount || "") || "Unverified"}</p>
            <p>Financial account {maskAccountId(role.financialAccountId || "") || "None"}</p>
            <p>{role.verified ? "Capability verified" : "Not verified"}. Environment {role.environment || route.environment}.</p>
            <p>Operations {(role.operations ?? []).join(", ") || "None recorded"}</p>
          </article>
        ))}
      </div>
    );
  }
  if (tab === "capabilities") {
    return (
      <div className="space-y-2">
        <p>Collection methods: {(capabilities.methods ?? []).join(", ") || "None recorded"}.</p>
        <p>{capabilities.ach ? "ACH is explicitly recorded." : "ACH is not approved. Card support does not imply ACH."}</p>
        <p>Refunds {capabilities.refunds === false ? "are off on this version" : "stay available"}.</p>
        <p>Reversals {capabilities.reversals === false ? "are off on this version" : "stay available"}.</p>
        <p>Turning new collections off does not disable refunds, webhook intake, or reconciliation.</p>
        <p>Bank payout control {capabilities.bankPayoutControl ? "is recorded" : "is not approved"}.</p>
      </div>
    );
  }
  if (tab === "verification") {
    return (
      <div className="space-y-2">
        <p>{readiness.checks.find((check) => check.label === "Verification workflow")?.ready ? "A verification workflow is recorded." : "Verification workflow is not recorded on this version."}</p>
        <p>This screen does not mark a business or influencer verified. A hosted return is not verification.</p>
      </div>
    );
  }
  if (tab === "tax") {
    return (
      <div className="space-y-2">
        {policy ? (
          <p>{policy.name} v{policy.version} · {policy.treatment} · {policy.status}. Filing owner {policy.filingOwner || "not set"}.</p>
        ) : (
          <p>No tax policy is linked. Unresolved tax blocks a new quote. It is not stored as zero.</p>
        )}
        <p>A fee rule never enables this country route. There is no universal tax amount on this screen.</p>
        <Link href="/admin/payment-settings?section=tax" className="font-semibold text-violet">Open Tax Settings</Link>
      </div>
    );
  }
  if (tab === "history") {
    return (
      <div className="space-y-2">
        <p>Earlier versions stay readable. A funded agreement keeps the route it already stored.</p>
        <ul className="space-y-2">
          {history.map((row) => (
            <li key={row.id}>v{row.version} · {row.status} · {row.createdAt.toISOString().slice(0, 10)} · new funding {row.newCollectionsEnabled ? "open" : "blocked"}</li>
          ))}
        </ul>
        <p>Notes: {route.approvalEvidence || "None recorded"}. A note is not capability evidence.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p>Status {route.status}. Proof {route.proofState || "draft"}. Topology {route.topology || "unavailable"}. Effective {route.effectiveFrom.toISOString().slice(0, 10)}. Version v{route.version}.</p>
      <p>New collections {route.newCollectionsEnabled ? "open" : "blocked"}. Releases {route.releasesEnabled ? "open" : "blocked"}. Operations withdrawal {route.operationsWithdrawalEnabled ? "open" : "blocked"}.</p>
      <p>Draft, sandbox-proven, and live-approved are different. This screen does not mark any of them from a note.</p>
      <p>{readiness.blocker ?? "Allocated funds are recorded as approved. That does not collect money from this screen."}</p>
      <p>Provider unavailable means new funding is blocked. Held money is not rerouted.</p>
      <ul className="space-y-1">
        {readiness.checks.map((check) => (
          <li key={check.label}>{check.ready ? "Ready" : "Missing"} · {check.label}</li>
        ))}
      </ul>
    </div>
  );
}
