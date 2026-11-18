/**
 * Account registry, capability evidence, and route activation rules for Payment Standard v2.
 * Connection health is not payment readiness. Missing movement edges block activation.
 */
import type { AccountRoleV2, MovementMethod } from "@/lib/payment-standard-v2";
import { ACCOUNT_ROLES_V2 } from "@/lib/payment-standard-v2";

export type AccountArrangement = "platform_subaccounts" | "separate_main_accounts" | "hybrid";

export type GatewayCapability =
  | "collect_payment"
  | "retain_funding"
  | "move_between_accounts"
  | "pay_beneficiary"
  | "control_bank_payout"
  | "refund_and_recover"
  | "observe_outcomes"
  | "recurring_billing";

export type CapabilityEvidence = {
  capability: GatewayCapability;
  documentationRef: string;
  environment: "sandbox" | "live";
  verifiedAt: string;
  reviewBy?: string;
  notes?: string;
};

export type GatewayAccountRecord = {
  id: string;
  integrationId: string;
  providerCode: string;
  providerAccountId: string;
  accountType: "main" | "subaccount";
  parentAccountId?: string;
  legalOwner: string;
  country: string;
  currencies: string[];
  capabilities: CapabilityEvidence[];
};

export type RoleBindingDraft = {
  role: AccountRoleV2;
  accountId: string;
  environment: "sandbox" | "live";
  payoutPolicy: "manual" | "provider_schedule" | "completion_sweep";
};

export type MovementEdge = {
  fromRole: AccountRoleV2 | "INFLUENCER_DESTINATION";
  toRole: AccountRoleV2 | "INFLUENCER_DESTINATION";
  method: MovementMethod;
  requiredCapabilities: GatewayCapability[];
};

export type PaymentRouteDraft = {
  id: string;
  label: string;
  arrangement: AccountArrangement;
  environment: "sandbox" | "live";
  chargeCurrency: string;
  bindings: RoleBindingDraft[];
  edges: MovementEdge[];
  status: "draft" | "tested" | "active" | "retired";
};

export type RouteValidation =
  | { ok: true; readiness: "ready" }
  | { ok: false; readiness: "blocked"; reasons: string[] };

const ROLE_SET = new Set<string>(ACCOUNT_ROLES_V2);

export function requiredCollaborationEdges(): MovementEdge[] {
  return [
    {
      fromRole: "COLLABORATION",
      toRole: "INFLUENCER_DESTINATION",
      method: "direct_external_payout",
      requiredCapabilities: ["pay_beneficiary", "observe_outcomes"],
    },
    {
      fromRole: "COLLABORATION",
      toRole: "OPERATIONS",
      method: "direct_wallet",
      requiredCapabilities: ["move_between_accounts", "observe_outcomes"],
    },
  ];
}

export function accountHasCapability(account: GatewayAccountRecord, capability: GatewayCapability): boolean {
  return account.capabilities.some((row) => row.capability === capability);
}

export function connectionHealthImpliesReadiness(health: "healthy" | "unknown" | "restricted", route: RouteValidation): boolean {
  // STD05: credentials/health must not imply payment readiness.
  if (health === "healthy" && !route.ok) return false;
  return route.ok;
}

export function validatePaymentRoute(
  route: PaymentRouteDraft,
  accounts: ReadonlyMap<string, GatewayAccountRecord>,
): RouteValidation {
  const reasons: string[] = [];

  for (const role of ["SUBSCRIPTION", "COLLABORATION", "OPERATIONS"] as AccountRoleV2[]) {
    const binding = route.bindings.find((row) => row.role === role);
    if (!binding) {
      reasons.push(`Missing ${role} account binding.`);
      continue;
    }
    const account = accounts.get(binding.accountId);
    if (!account) {
      reasons.push(`${role} binding points at unknown account ${binding.accountId}.`);
      continue;
    }
    if (binding.environment !== account.capabilities[0]?.environment && account.capabilities.length > 0) {
      // Soft check — environment mismatch on evidence is a warning-level block when present.
      const envMismatch = account.capabilities.some((cap) => cap.environment !== binding.environment);
      if (envMismatch) {
        reasons.push(`${role} account evidence environment does not match the route environment.`);
      }
    }
  }

  for (const edge of route.edges) {
    if (edge.method === "native_provider_split") {
      // Allowed only as optional adapter optimization; still needs capability evidence on the source.
    }
    const sourceBinding =
      edge.fromRole === "INFLUENCER_DESTINATION"
        ? null
        : route.bindings.find((row) => row.role === edge.fromRole);
    if (edge.fromRole !== "INFLUENCER_DESTINATION") {
      if (!sourceBinding) {
        reasons.push(`Movement edge ${edge.fromRole} → ${edge.toRole} has no source binding.`);
        continue;
      }
      const source = accounts.get(sourceBinding.accountId);
      if (!source) {
        reasons.push(`Movement edge source account missing for ${edge.fromRole}.`);
        continue;
      }
      for (const capability of edge.requiredCapabilities) {
        if (!accountHasCapability(source, capability)) {
          reasons.push(
            `Unsupported path ${edge.fromRole} → ${edge.toRole}: missing capability ${capability} on account ${source.providerAccountId || source.id}.`,
          );
        }
      }
    }
  }

  const hasInfluencerPath = route.edges.some(
    (edge) => edge.fromRole === "COLLABORATION" && edge.toRole === "INFLUENCER_DESTINATION",
  );
  const hasOperationsPath = route.edges.some(
    (edge) => edge.fromRole === "COLLABORATION" && edge.toRole === "OPERATIONS",
  );
  if (!hasInfluencerPath) {
    reasons.push("Collaboration route requires a Collaboration → influencer destination movement edge.");
  }
  if (!hasOperationsPath) {
    reasons.push("Collaboration route requires a Collaboration → Operations movement edge.");
  }

  // Separate mains must not silently share one physical account across roles.
  if (route.arrangement === "separate_main_accounts") {
    const collab = route.bindings.find((row) => row.role === "COLLABORATION");
    const operations = route.bindings.find((row) => row.role === "OPERATIONS");
    const subscription = route.bindings.find((row) => row.role === "SUBSCRIPTION");
    if (collab && operations && collab.accountId === operations.accountId) {
      reasons.push("Separate main-account arrangement cannot bind Collaboration and Operations to the same account.");
    }
    if (collab && subscription && collab.accountId === subscription.accountId) {
      reasons.push("Separate main-account arrangement cannot bind Subscription and Collaboration to the same account.");
    }
  }

  for (const binding of route.bindings) {
    if (!ROLE_SET.has(binding.role)) {
      reasons.push(`Unknown role ${binding.role}.`);
    }
  }

  if (reasons.length > 0) {
    return { ok: false, readiness: "blocked", reasons };
  }
  return { ok: true, readiness: "ready" };
}

export function activateRoute(
  route: PaymentRouteDraft,
  accounts: ReadonlyMap<string, GatewayAccountRecord>,
): { ok: true; version: PaymentRouteDraft } | { ok: false; reasons: string[] } {
  const validation = validatePaymentRoute(route, accounts);
  if (!validation.ok) {
    return { ok: false, reasons: validation.reasons };
  }
  // Activation never moves money.
  return {
    ok: true,
    version: { ...route, status: "active" },
  };
}
