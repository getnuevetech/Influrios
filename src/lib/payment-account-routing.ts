/**
 * Account routing for the payment standard.
 * Commercial rates stay in the fee engine. This module decides which account
 * may move money, and it refuses a movement that the provider has not proven.
 * A checkbox, a note, or a browser return is not proof.
 */
import type { AccountRole } from "@/lib/payment-standard-v4";

const ACCOUNT_ROLES: AccountRole[] = ["SUBSCRIPTIONS", "COLLABORATION_FUNDS", "OPERATIONS", "RECIPIENT"];

export const STRIPE_STABLE_API_VERSION = "2025-02-24.acacia";

export const STRIPE_CAPABILITY_REVIEWED_ON = "2026-11-13";

export type PaymentTopology = "connect_allocated_funds" | "treasury_financial_accounts" | "unavailable";

export type RouteProofState = "draft" | "sandbox_proven" | "live_approved";

export type CapabilityKind = "allocated_funds" | "treasury";

export type CapabilityEvidence = {
  source: "stripe_account_retrieve";
  capability: CapabilityKind;
  environment: "sandbox" | "live";
  objectId: string;
  apiVersion: string;
  retrievedAt: string;
};

export type VerifiedRoleAccount = {
  externalAccountId: string;
  financialAccountId?: string;
  owner: string;
  capabilities: string[];
  country?: string;
  currency?: string;
};

export type RoleAccountMapping = {
  role: AccountRole;
  owner: string;
  providerAccount: string;
  externalAccountId: string;
  financialAccountId: string;
  environment: "sandbox" | "live";
  verified: boolean;
  capabilities: string[];
  operations: string[];
};

const ACCOUNT_ID = /^acct_[A-Za-z0-9]+$/;
const FINANCIAL_ACCOUNT_ID = /^fa_[A-Za-z0-9]+$/;
const PROVIDER_OBJECT_ID = /^(pi|ch|tr|po|re|py|fa|obp|obt|cs|acct)_[A-Za-z0-9]+$/;

export function stripeCapabilityStatus(input?: { secretPresent?: boolean }) {
  const secretPresent = input?.secretPresent ?? Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const reason = secretPresent
    ? "A Stripe secret is present, but no retrieved allocated-funds preview or Treasury financial account is stored. New collaboration funding stays disabled."
    : "No Stripe secret is configured, and neither Connect allocated funds nor Treasury was retrieved for the Influrios account. New collaboration funding stays disabled.";
  return {
    checkedAt: STRIPE_CAPABILITY_REVIEWED_ON,
    credentialsPresent: secretPresent,
    allocatedFunds: "unproven" as const,
    treasury: "unproven" as const,
    newCollaborationFunding: "disabled" as const,
    reason,
  };
}

/** A normal Connect account payload does not prove either preview. */
export function interpretStripeAccountPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {
      allocatedFunds: false,
      treasury: false,
      reason: "Stripe did not return an account. Nothing was enabled.",
    };
  }
  const record = payload as Record<string, unknown>;
  const capabilities =
    record.capabilities && typeof record.capabilities === "object"
      ? (record.capabilities as Record<string, unknown>)
      : {};
  const allocatedFunds = record.allocated_funds === "active" || capabilities.allocated_funds === "active";
  const treasuryFlag = capabilities.treasury === "active" || capabilities.treasury_payments === "active";
  const financialAccounts = Array.isArray(record.financial_accounts) ? record.financial_accounts : [];
  const treasury = treasuryFlag && financialAccounts.length > 0;
  return {
    allocatedFunds,
    treasury,
    reason:
      allocatedFunds || treasury
        ? "The retrieved account names a capability. Publishing still needs the stored evidence record."
        : "The account payload does not prove allocated funds or Treasury. New collaboration funding stays disabled.",
  };
}

export function acceptCapabilityEvidence(
  value: unknown,
  expectedEnvironment: "sandbox" | "live",
): { ok: true; evidence: CapabilityEvidence } | { ok: false; error: string } {
  if (typeof value === "string" || value == null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "An evidence note is not provider access. New funding stays off." };
  }
  const row = value as Partial<CapabilityEvidence>;
  if (row.source !== "stripe_account_retrieve") {
    return { ok: false, error: "Capability evidence must come from a retrieved Stripe account. Nothing was enabled." };
  }
  if (row.capability !== "allocated_funds" && row.capability !== "treasury") {
    return { ok: false, error: "The retrieved capability is not allocated funds or Treasury. Nothing was enabled." };
  }
  if (row.environment !== expectedEnvironment) {
    return { ok: false, error: "The capability environment does not match this route. Nothing was enabled." };
  }
  const objectId = String(row.objectId ?? "").trim();
  const apiVersion = String(row.apiVersion ?? "").trim();
  const retrievedAt = String(row.retrievedAt ?? "").trim();
  if (row.capability === "allocated_funds" && !ACCOUNT_ID.test(objectId)) {
    return { ok: false, error: "Allocated-funds evidence needs the platform acct id from Stripe. Nothing was enabled." };
  }
  if (row.capability === "treasury" && !FINANCIAL_ACCOUNT_ID.test(objectId) && !ACCOUNT_ID.test(objectId)) {
    return { ok: false, error: "Treasury evidence needs a retrieved account id. Nothing was enabled." };
  }
  if (!apiVersion || apiVersion === STRIPE_STABLE_API_VERSION) {
    return {
      ok: false,
      error: "Preview access needs its own API version. The stable 2025-02-24.acacia client is not that proof.",
    };
  }
  if (Number.isNaN(new Date(retrievedAt).getTime())) {
    return { ok: false, error: "Capability evidence needs the time Stripe returned it. Nothing was enabled." };
  }
  return {
    ok: true,
    evidence: {
      source: "stripe_account_retrieve",
      capability: row.capability,
      environment: expectedEnvironment,
      objectId,
      apiVersion,
      retrievedAt,
    },
  };
}

export function proofStateFor(evidence: CapabilityEvidence | null, environment: "sandbox" | "live"): RouteProofState {
  if (!evidence) return "draft";
  if (evidence.environment !== environment) return "draft";
  return environment === "live" ? "live_approved" : "sandbox_proven";
}

export function selectStripeTopology(input: {
  providerCode: string;
  evidence: CapabilityEvidence | null;
}): { topology: PaymentTopology; newCollectionsEnabled: boolean; blocker: string | null } {
  const provider = input.providerCode.trim().toLowerCase();
  if (provider !== "stripe" || !input.evidence) {
    return {
      topology: "unavailable",
      newCollectionsEnabled: false,
      blocker: "New collaboration funding is disabled until Stripe allocated funds or Treasury access is proven. Nothing was charged.",
    };
  }
  if (input.evidence.capability === "allocated_funds") {
    return { topology: "connect_allocated_funds", newCollectionsEnabled: true, blocker: null };
  }
  return { topology: "treasury_financial_accounts", newCollectionsEnabled: true, blocker: null };
}

export function collaborationCollectionGate(proof: { allocatedFunds: boolean; treasury: boolean }) {
  if (proof.allocatedFunds || proof.treasury) return { ok: true as const };
  return {
    ok: false as const,
    error: "New collaboration funding is disabled until Stripe allocated funds or Treasury access is proven. Nothing was charged.",
  };
}

function accountVerified(account: VerifiedRoleAccount | undefined) {
  if (!account) return false;
  return ACCOUNT_ID.test(account.externalAccountId.trim());
}

export function buildRoleMapping(input: {
  environment: "sandbox" | "live";
  accounts?: Partial<Record<AccountRole, VerifiedRoleAccount>>;
  collaborationReady: boolean;
}): RoleAccountMapping[] {
  const accounts = input.accounts ?? {};
  return ACCOUNT_ROLES.map((role) => {
    const account = accounts[role];
    const verified = accountVerified(account);
    const externalAccountId = verified ? account!.externalAccountId.trim() : "";
    const financialAccountId =
      account?.financialAccountId && FINANCIAL_ACCOUNT_ID.test(account.financialAccountId.trim())
        ? account.financialAccountId.trim()
        : "";
    let operations: string[];
    if (role === "SUBSCRIPTIONS") {
      operations = verified ? ["collect_subscription", "invoice_tax", "subscription_refund"] : ["blocked_until_provider_approval"];
    } else if (role === "COLLABORATION_FUNDS") {
      operations =
        verified && input.collaborationReady ? ["collect_once", "allocate", "partial_transfer"] : ["blocked_until_provider_approval"];
    } else if (role === "OPERATIONS") {
      operations = verified ? ["receive_application_fee"] : ["blocked_until_provider_approval"];
    } else {
      operations = verified ? ["receive_transfer", "external_payout"] : ["blocked_until_provider_approval"];
    }
    return {
      role,
      owner: account?.owner?.trim() || "Unassigned",
      providerAccount: externalAccountId,
      externalAccountId,
      financialAccountId,
      environment: input.environment,
      verified,
      capabilities: verified ? account!.capabilities : [],
      operations,
    };
  });
}

export function maskAccountId(value: string) {
  const id = value.trim();
  if (id.length < 10) return "";
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export function planRouteDraft(input: {
  countryCode: string;
  environment: "sandbox" | "live";
  currency: string;
  providerCode: string;
  allocatedFundsApproved?: boolean;
  newCollectionsEnabled: boolean;
  releasesEnabled: boolean;
  operationsWithdrawalEnabled?: boolean;
  bankPayoutControl?: boolean;
  evidence?: string;
  capabilityEvidence?: unknown;
  accounts?: Partial<Record<AccountRole, VerifiedRoleAccount>>;
  collaborationProvider?: string;
  operationsProvider?: string;
  transferBridgeApproved?: boolean;
}) {
  const countryCode = input.countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) return { ok: false as const, error: "Enter a two-letter country code." };
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false as const, error: "Enter a three-letter currency." };
  const providerCode = input.providerCode.trim().toLowerCase() || "stripe";
  if (providerCode !== "stripe" && input.allocatedFundsApproved) {
    return { ok: false as const, error: "Stripe account mapping cannot be saved on a non-Stripe route." };
  }
  const bridge = collaborationOperationsBridge({
    collaborationProvider: input.collaborationProvider || providerCode,
    operationsProvider: input.operationsProvider || providerCode,
    bridgeApproved: input.transferBridgeApproved === true,
  });
  if (!bridge.ok) return bridge;
  const proof = acceptCapabilityEvidence(input.capabilityEvidence, input.environment);
  const evidence = proof.ok ? proof.evidence : null;
  if (input.newCollectionsEnabled && !evidence) {
    return { ok: false as const, error: "Provider approval required. New funding stays off." };
  }
  if (providerCode !== "stripe" && input.newCollectionsEnabled) {
    return {
      ok: false as const,
      error: "New collaboration funding stays disabled on a route that is not a proven Stripe topology.",
    };
  }
  const topology = selectStripeTopology({ providerCode, evidence });
  const mapping =
    providerCode === "stripe"
      ? buildRoleMapping({
          environment: input.environment,
          accounts: input.accounts,
          collaborationReady: topology.newCollectionsEnabled,
        })
      : buildRoleMapping({
          environment: input.environment,
          collaborationReady: false,
        }).map((row) => ({
          ...row,
          owner: `${providerCode} ${row.role.toLowerCase()}`,
          operations: ["blocked_until_provider_approval"],
          verified: false,
          providerAccount: "",
          externalAccountId: "",
        }));
  return {
    ok: true as const,
    countryCode,
    currency,
    providerCode,
    environment: input.environment,
    topology: topology.topology,
    proofState: proofStateFor(evidence, input.environment),
    allocatedFundsApproved: evidence?.capability === "allocated_funds",
    newCollectionsEnabled: topology.newCollectionsEnabled && input.newCollectionsEnabled,
    releasesEnabled: input.releasesEnabled,
    operationsWithdrawalEnabled: input.operationsWithdrawalEnabled === true,
    bankPayoutControl: input.bankPayoutControl === true,
    approvalEvidence: (input.evidence ?? "").trim(),
    roleMapping: mapping,
    capabilities: {
      methods: ["card"],
      ach: false,
      refunds: true,
      reversals: true,
      bankPayoutControl: input.bankPayoutControl === true,
      topology: topology.topology,
      proofState: proofStateFor(evidence, input.environment),
    },
  };
}

export function collaborationOperationsBridge(input: {
  collaborationProvider: string;
  operationsProvider: string;
  bridgeApproved: boolean;
}) {
  const collaboration = input.collaborationProvider.trim().toLowerCase();
  const operations = input.operationsProvider.trim().toLowerCase();
  if (!collaboration || !operations) return { ok: false as const, error: "Choose the Collaboration and Operations providers." };
  if (collaboration === operations) return { ok: true as const, bridge: false };
  if (!input.bridgeApproved) {
    return {
      ok: false as const,
      error: "Different providers for Collaboration and Operations need an approved transfer bridge. Nothing was moved.",
    };
  }
  return { ok: true as const, bridge: true };
}

export type CountryRule = {
  id: string;
  country: string;
  currency: string;
  priority: number;
  provider: string;
  concrete: boolean;
};

/** A concrete country and currency wins over a group default. Equal concrete rules that disagree block publication. */
export function publishCountryRules(rules: CountryRule[]) {
  const grouped = new Map<string, CountryRule[]>();
  for (const rule of rules) {
    const country = rule.country.trim().toUpperCase();
    const list = grouped.get(country) ?? [];
    list.push({ ...rule, country, currency: rule.currency.trim().toUpperCase(), provider: rule.provider.trim().toLowerCase() });
    grouped.set(country, list);
  }
  const published: CountryRule[] = [];
  const blocked: { country: string; error: string }[] = [];
  for (const [country, list] of grouped) {
    const concrete = list.filter((rule) => rule.concrete);
    const pool = concrete.length > 0 ? concrete : list;
    const top = Math.max(...pool.map((rule) => rule.priority));
    const winners = pool.filter((rule) => rule.priority === top);
    const currencies = new Set(winners.map((rule) => rule.currency));
    const providers = new Set(winners.map((rule) => rule.provider));
    if (currencies.size > 1 || providers.size > 1) {
      blocked.push({ country, error: `${country} has conflicting rules at the same priority. Publication stays blocked.` });
      continue;
    }
    published.push(winners[0]);
  }
  return { ok: blocked.length === 0, published, blocked };
}

export function domesticLaunchAllowed(input: { routeCountry: string; businessCountry: string; influencerCountry: string }) {
  const route = input.routeCountry.trim().toUpperCase();
  const business = input.businessCountry.trim().toUpperCase();
  const influencer = input.influencerCountry.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(route) || !/^[A-Z]{2}$/.test(business) || !/^[A-Z]{2}$/.test(influencer)) {
    return { ok: false as const, error: "The route, the business, and the influencer each need a verified country." };
  }
  if (route !== business || route !== influencer) {
    return { ok: false as const, error: "The business and the influencer payout country must match this route. Nothing was converted." };
  }
  return { ok: true as const, country: route };
}

export function providerSubmissionAccepted(result: { providerObjectId?: string | null }) {
  const id = result.providerObjectId?.trim() ?? "";
  return PROVIDER_OBJECT_ID.test(id);
}

export type AllocationRow = {
  milestoneId?: string;
  grossCents: number;
  businessCollaborationFeeCents: number;
  influencerFeeCents: number;
  influencerNetCents?: number;
};

export function stampAllocationMilestoneIds(snapshot: unknown, milestoneIds: string[]) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const root = snapshot as { financialPlan?: { signedQuote?: { milestoneAllocations?: unknown } } };
  const plan = root.financialPlan;
  const quote = plan?.signedQuote;
  const rows = quote?.milestoneAllocations;
  if (!plan || !quote || !Array.isArray(rows) || rows.length === 0) return null;
  if (rows.length !== milestoneIds.length) return null;
  if (milestoneIds.some((id) => !id.trim())) return null;
  const already = rows.some(
    (row) => row && typeof row === "object" && typeof (row as { milestoneId?: unknown }).milestoneId === "string" && (row as { milestoneId: string }).milestoneId.trim(),
  );
  if (already) return null;
  const milestoneAllocations = rows.map((row, index) =>
    row && typeof row === "object" ? { ...(row as object), milestoneId: milestoneIds[index] } : row,
  );
  return {
    ...(snapshot as object),
    financialPlan: {
      ...plan,
      signedQuote: {
        ...quote,
        milestoneAllocations,
      },
    },
  };
}

export function readAgreementVersion(quote: unknown): { ok: true; version: number } | { ok: false; error: string } {
  if (!quote || typeof quote !== "object") {
    return { ok: false, error: "The signed agreement version is missing. Nothing was released." };
  }
  const version = Number((quote as { agreementVersion?: unknown }).agreementVersion);
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, error: "The signed agreement version is missing. Nothing was released." };
  }
  return { ok: true, version };
}

function allocationAmounts(row: unknown): AllocationRow | null {
  if (!row || typeof row !== "object") return null;
  const record = row as AllocationRow;
  const amounts = [record.grossCents, record.businessCollaborationFeeCents, record.influencerFeeCents];
  if (amounts.some((amount) => !Number.isInteger(amount) || amount < 0)) return null;
  const net = record.grossCents - record.influencerFeeCents;
  const operations = record.businessCollaborationFeeCents + record.influencerFeeCents;
  if (net < 0) return null;
  if (record.grossCents + record.businessCollaborationFeeCents !== net + operations) return null;
  if (record.influencerNetCents != null && record.influencerNetCents !== net) return null;
  return {
    milestoneId: typeof record.milestoneId === "string" ? record.milestoneId : undefined,
    grossCents: record.grossCents,
    businessCollaborationFeeCents: record.businessCollaborationFeeCents,
    influencerFeeCents: record.influencerFeeCents,
    influencerNetCents: net,
  };
}

/** Match a milestone by its signed id. Rows with no ids stay on the original approval path. */
export function readMilestoneAllocation(input: { allocations: unknown; milestoneId: string }):
  | { kind: "legacy" }
  | { kind: "match"; row: AllocationRow }
  | { kind: "reject"; error: string } {
  if (!Array.isArray(input.allocations) || input.allocations.length === 0) {
    return { kind: "reject", error: "This agreement has no frozen milestone allocation. Nothing was released." };
  }
  const rows = input.allocations.map(allocationAmounts);
  if (rows.some((row) => !row)) {
    return { kind: "reject", error: "This agreement has no frozen milestone allocation. Nothing was released." };
  }
  const bound = rows.filter((row): row is AllocationRow => Boolean(row?.milestoneId));
  if (bound.length === 0) return { kind: "legacy" };
  if (bound.length !== rows.length) {
    return { kind: "reject", error: "The signed allocation is missing a milestone id. Nothing was released." };
  }
  const match = bound.find((row) => row.milestoneId === input.milestoneId);
  if (!match) return { kind: "reject", error: "That milestone is not in the signed allocation. Nothing was released." };
  return { kind: "match", row: match };
}

export function settlementCommandKey(input: { milestoneId: string; agreementVersion: number }) {
  return `${input.milestoneId}:${input.agreementVersion}:release`;
}

export function duplicateSettlement(existingKey: string | null, nextKey: string) {
  if (existingKey && existingKey === nextKey) return { reuse: true as const };
  return { reuse: false as const };
}

export function timeoutAfterProviderCall(input: { timedOut: boolean; providerObjectId?: string | null }) {
  if (!input.timedOut) {
    return providerSubmissionAccepted({ providerObjectId: input.providerObjectId })
      ? { state: "submitted" as const, retryMovement: false }
      : { state: "unknown" as const, retryMovement: false };
  }
  return { state: "unknown" as const, retryMovement: false, lookup: true as const };
}

export function partialLegRecovery(input: { influencer: "confirmed" | "failed" | "planned"; operations: "confirmed" | "failed" | "planned" }) {
  if (input.influencer === "confirmed" && input.operations === "failed") {
    return { retry: ["operations_fees"] as const, secondInfluencerTransfer: false, partial: true as const };
  }
  if (input.influencer === "failed" && input.operations === "confirmed") {
    return { retry: ["influencer_net"] as const, secondInfluencerTransfer: false, partial: true as const };
  }
  return { retry: [] as const, secondInfluencerTransfer: false, partial: false as const };
}

export function payoutFailureKeepsTransfer(input: { transferConfirmed: boolean; payout: "failed" | "returned" | "paid" }) {
  if ((input.payout === "failed" || input.payout === "returned") && input.transferConfirmed) {
    return { createTransfer: false, retryPayoutOnly: true, restrictOperationsFee: true };
  }
  return { createTransfer: !input.transferConfirmed, retryPayoutOnly: false, restrictOperationsFee: false };
}

export function executionContextAllowed(input: {
  routeEnvironment: "sandbox" | "live";
  requestEnvironment: "sandbox" | "live";
  routeCurrency: string;
  requestCurrency: string;
  routeAccount: string;
  requestAccount: string;
}) {
  if (input.routeEnvironment !== input.requestEnvironment) {
    return { ok: false as const, error: "The provider environment does not match this route. Nothing was sent." };
  }
  if (input.routeCurrency.trim().toUpperCase() !== input.requestCurrency.trim().toUpperCase()) {
    return { ok: false as const, error: "The currency does not match this route. Nothing was converted." };
  }
  if (input.routeAccount.trim() !== input.requestAccount.trim()) {
    return { ok: false as const, error: "The account does not match this route. Nothing was sent." };
  }
  return { ok: true as const };
}

export function webhookAttachesToDeal(input: {
  signatureValid: boolean;
  eventAccount: string;
  dealAccount: string;
  eventFundingId: string;
  dealFundingId: string;
}) {
  if (!input.signatureValid) return { attach: false as const, reason: "The webhook signature did not match." };
  if (input.eventAccount.trim() !== input.dealAccount.trim() || input.eventFundingId.trim() !== input.dealFundingId.trim()) {
    return { attach: false as const, reason: "A valid signature cannot attach an unrelated event to this deal." };
  }
  return { attach: true as const };
}

export function capabilityLossAllows(input: { capabilityActive: boolean; action: "new_collection" | "release" | "refund" | "reconcile" | "event" }) {
  if (input.capabilityActive) return { allowed: true as const, blocker: null };
  if (input.action === "new_collection" || input.action === "release") {
    return { allowed: false as const, blocker: "This capability is restricted. New collection and release stay paused." };
  }
  return { allowed: true as const, blocker: null };
}

export function frozenDealRoute(input: { signedAccountId: string; editedAccountId: string }) {
  return { accountId: input.signedAccountId.trim(), replaced: false as const, editedAccountId: input.editedAccountId.trim() };
}

export function providerOutageResult() {
  return { state: "unknown" as const, balanceCents: null, reconciled: false as const };
}

export function subscriptionEffect(eventType: string) {
  const billing = eventType.startsWith("customer.subscription") || eventType.startsWith("invoice.") || eventType === "checkout.session.completed";
  return { touchesSubscriptionLedger: billing, createsCollaborationSettlement: false as const };
}

export function operationsWithdrawal(input: {
  earningsCents: number;
  reserveCents: number;
  taxLiabilityCents: number;
  unsettledFeeCents: number;
  unrelatedDealCents: number;
  influencerPayoutConfirmed: boolean;
  requestedCents: number;
}) {
  const amounts = [
    input.earningsCents,
    input.reserveCents,
    input.taxLiabilityCents,
    input.unsettledFeeCents,
    input.unrelatedDealCents,
    input.requestedCents,
  ];
  if (amounts.some((amount) => !Number.isInteger(amount) || amount < 0)) {
    return { ok: false as const, error: "Withdrawal amounts must be zero or positive minor units." };
  }
  if (!input.influencerPayoutConfirmed) {
    return { ok: false as const, error: "Fees stay restricted until the influencer bank payout is confirmed." };
  }
  const eligible = input.earningsCents - input.reserveCents - input.taxLiabilityCents - input.unsettledFeeCents;
  if (eligible < 0 || input.requestedCents > eligible) {
    return { ok: false as const, error: "The withdrawal is larger than eligible earnings. Reserves, tax, and unsettled fees stay put." };
  }
  if (input.requestedCents > 0 && input.unrelatedDealCents > 0 && input.requestedCents > input.earningsCents) {
    return { ok: false as const, error: "An unrelated deal is not part of this withdrawal." };
  }
  return { ok: true as const, payCents: input.requestedCents, eligibleCents: eligible, excludedUnrelatedCents: input.unrelatedDealCents };
}

export function remainingObligation(input: { fundedCents: number; settledFundedCents: number }) {
  if (!Number.isInteger(input.fundedCents) || !Number.isInteger(input.settledFundedCents)) {
    return { ok: false as const, error: "The remaining obligation is not a minor amount." };
  }
  const remaining = input.fundedCents - input.settledFundedCents;
  if (remaining < 0) return { ok: false as const, error: "Settled funds are larger than the collection." };
  return { ok: true as const, remainingCents: remaining };
}

export function reconcileProviderEvidence(input: {
  outage: boolean;
  reference: string;
  retrieved: { id: string; amountCents: number; currency: string; account: string } | null;
  expected: { amountCents: number; currency: string; account: string };
}) {
  if (input.outage || !input.retrieved) {
    return { ok: false as const, state: "unknown" as const, error: "The provider could not be read. Reconciliation stays unknown." };
  }
  if (input.retrieved.id !== input.reference.trim()) {
    return { ok: false as const, state: "mismatch" as const, error: "The retrieved object is not this reference. Nothing was marked settled." };
  }
  const currencyMatches = input.retrieved.currency.trim().toUpperCase() === input.expected.currency.trim().toUpperCase();
  if (
    input.retrieved.amountCents !== input.expected.amountCents ||
    !currencyMatches ||
    input.retrieved.account !== input.expected.account
  ) {
    return { ok: false as const, state: "mismatch" as const, error: "The provider object does not match this deal. A finance exception stays open." };
  }
  return { ok: true as const, state: "matched" as const };
}

export type StripeOperationName =
  | "subscription_checkout"
  | "subscription_portal"
  | "connect_onboarding"
  | "manual_payout_schedule"
  | "allocated_collection"
  | "allocated_balance"
  | "allocated_release"
  | "connect_payout"
  | "refund"
  | "transfer_reversal"
  | "treasury_financial_account"
  | "treasury_outbound_payment"
  | "treasury_outbound_transfer";

export type StripeRequestDescriptor = {
  method: "GET" | "POST";
  path: string;
  apiVersion: string;
  preview: boolean;
  stripeAccount: string;
  idempotencyKey: string;
  body: Record<string, string>;
};

const COLLABORATION_PREVIEW = new Set<StripeOperationName>([
  "allocated_collection",
  "allocated_balance",
  "allocated_release",
  "treasury_financial_account",
  "treasury_outbound_payment",
  "treasury_outbound_transfer",
]);

export function describeStripeOperation(input: {
  operation: StripeOperationName;
  environment: "sandbox" | "live";
  currency: string;
  idempotencyKey: string;
  stripeAccount?: string;
  evidence: CapabilityEvidence | null;
  amountCents?: number;
  paymentIntentId?: string;
  chargeId?: string;
  transferId?: string;
  destinationAccountId?: string;
  customerId?: string;
  priceId?: string;
  payoutId?: string;
  applicationFeeCents?: number;
}): { ok: true; request: StripeRequestDescriptor } | { ok: false; blocker: string } {
  const currency = input.currency.trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) return { ok: false, blocker: "The currency is missing. Nothing was sent." };
  if (!input.idempotencyKey.trim() && input.operation !== "allocated_balance" && input.operation !== "subscription_portal") {
    return { ok: false, blocker: "The idempotency key is missing. Nothing was sent." };
  }
  const stripeAccount = (input.stripeAccount ?? "").trim();
  if (stripeAccount && !ACCOUNT_ID.test(stripeAccount)) {
    return { ok: false, blocker: "The Stripe account id is not an acct id. Nothing was sent." };
  }
  if (COLLABORATION_PREVIEW.has(input.operation)) {
    const needed = input.operation.startsWith("treasury") ? "treasury" : "allocated_funds";
    if (!input.evidence || input.evidence.capability !== needed || input.evidence.environment !== input.environment) {
      return {
        ok: false,
        blocker: "New collaboration funding is disabled until Stripe allocated funds or Treasury access is proven. Nothing was charged.",
      };
    }
  }
  const stable = {
    method: "POST" as const,
    apiVersion: STRIPE_STABLE_API_VERSION,
    preview: false,
    stripeAccount,
    idempotencyKey: input.idempotencyKey.trim(),
  };
  if (input.operation === "subscription_checkout") {
    if (!input.priceId || !input.customerId) return { ok: false, blocker: "Subscription checkout needs a price and a customer. Nothing was opened." };
    return {
      ok: true,
      request: {
        ...stable,
        path: "/v1/checkout/sessions",
        body: { mode: "subscription", "line_items[0][price]": input.priceId, "line_items[0][quantity]": "1", customer: input.customerId },
      },
    };
  }
  if (input.operation === "subscription_portal") {
    if (!input.customerId) return { ok: false, blocker: "The billing portal needs the subscription customer. Nothing was opened." };
    return {
      ok: true,
      request: { ...stable, path: "/v1/billing_portal/sessions", body: { customer: input.customerId } },
    };
  }
  if (input.operation === "connect_onboarding") {
    if (!stripeAccount) return { ok: false, blocker: "Onboarding needs the connected account id. A return URL is not readiness." };
    return {
      ok: true,
      request: { ...stable, stripeAccount: "", path: "/v1/account_links", body: { account: stripeAccount, type: "account_onboarding" } },
    };
  }
  if (input.operation === "manual_payout_schedule") {
    return {
      ok: true,
      request: {
        ...stable,
        path: "/v1/balance_settings",
        body: { "payments[payouts][schedule][interval]": "manual" },
      },
    };
  }
  if (input.operation === "allocated_collection") {
    if (!Number.isInteger(input.amountCents) || Number(input.amountCents) <= 0) {
      return { ok: false, blocker: "Collection needs a positive amount. Nothing was charged." };
    }
    return {
      ok: true,
      request: {
        method: "POST",
        path: "/v1/payment_intents",
        apiVersion: input.evidence!.apiVersion,
        preview: true,
        stripeAccount,
        idempotencyKey: input.idempotencyKey.trim(),
        body: {
          amount: String(input.amountCents),
          currency,
          "allocated_funds[enabled]": "true",
        },
      },
    };
  }
  if (input.operation === "allocated_balance") {
    if (!input.paymentIntentId) return { ok: false, blocker: "Allocation lookup needs the PaymentIntent id." };
    return {
      ok: true,
      request: {
        method: "GET",
        path: `/v1/payment_intents/${input.paymentIntentId}?expand[]=latest_charge.allocated_funds.balance`,
        apiVersion: input.evidence!.apiVersion,
        preview: true,
        stripeAccount,
        idempotencyKey: "",
        body: {},
      },
    };
  }
  if (input.operation === "allocated_release") {
    if (!input.destinationAccountId || !ACCOUNT_ID.test(input.destinationAccountId)) {
      return { ok: false, blocker: "The release destination is not a connected account. Nothing was transferred." };
    }
    if (!input.chargeId || !Number.isInteger(input.amountCents)) {
      return { ok: false, blocker: "The release needs the source charge and the signed amounts. Nothing was transferred." };
    }
    const body: Record<string, string> = {
      amount: String(input.amountCents),
      currency,
      destination: input.destinationAccountId,
      source_transaction: input.chargeId,
    };
    if (Number.isInteger(input.applicationFeeCents) && Number(input.applicationFeeCents) >= 0) {
      body.application_fee_amount = String(input.applicationFeeCents);
    }
    return {
      ok: true,
      request: {
        method: "POST",
        path: "/v1/transfers",
        apiVersion: input.evidence!.apiVersion,
        preview: true,
        stripeAccount,
        idempotencyKey: input.idempotencyKey.trim(),
        body,
      },
    };
  }
  if (input.operation === "connect_payout") {
    if (!stripeAccount) return { ok: false, blocker: "A bank payout runs in the recipient or Operations account. Nothing was paid." };
    if (!Number.isInteger(input.amountCents) || Number(input.amountCents) <= 0) {
      return { ok: false, blocker: "The payout amount is missing. Nothing was paid." };
    }
    return {
      ok: true,
      request: { ...stable, path: "/v1/payouts", body: { amount: String(input.amountCents), currency } },
    };
  }
  if (input.operation === "refund") {
    if (!input.paymentIntentId && !input.chargeId) {
      return { ok: false, blocker: "A refund references the original PaymentIntent or charge. Nothing was refunded." };
    }
    const body: Record<string, string> = {};
    if (input.paymentIntentId) body.payment_intent = input.paymentIntentId;
    if (input.chargeId) body.charge = input.chargeId;
    if (Number.isInteger(input.amountCents)) body.amount = String(input.amountCents);
    return { ok: true, request: { ...stable, path: "/v1/refunds", body } };
  }
  if (input.operation === "transfer_reversal") {
    if (!input.transferId) return { ok: false, blocker: "A transfer reversal needs the transfer id. It is not a customer refund." };
    return { ok: true, request: { ...stable, path: `/v1/transfers/${input.transferId}/reversals`, body: {} } };
  }
  if (input.operation === "treasury_financial_account") {
    return {
      ok: true,
      request: {
        method: "POST",
        path: "/v2/money_management/financial_accounts",
        apiVersion: input.evidence!.apiVersion,
        preview: true,
        stripeAccount,
        idempotencyKey: input.idempotencyKey.trim(),
        body: {},
      },
    };
  }
  if (input.operation === "treasury_outbound_payment" || input.operation === "treasury_outbound_transfer") {
    const path =
      input.operation === "treasury_outbound_payment"
        ? "/v2/money_management/outbound_payments"
        : "/v2/money_management/outbound_transfers";
    return {
      ok: true,
      request: {
        method: "POST",
        path,
        apiVersion: input.evidence!.apiVersion,
        preview: true,
        stripeAccount,
        idempotencyKey: input.idempotencyKey.trim(),
        body: { currency },
      },
    };
  }
  return { ok: false, blocker: "That operation is not on the Stripe route. Nothing was sent." };
}

export function previewUsesStableClient(request: StripeRequestDescriptor) {
  return request.preview && request.apiVersion === STRIPE_STABLE_API_VERSION;
}
