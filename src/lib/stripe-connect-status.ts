/**
 * Stripe Connect as the KYC and payout rail.
 * Stripe's hosted onboarding verifies the influencer's identity and bank. The app never decides that on
 * its own: it reads the connected account and mirrors what Stripe reports.
 */
import { prisma } from "@/lib/db";

export type ConnectStatus = "VERIFIED" | "PENDING" | "REJECTED" | "UNVERIFIED";

export type ConnectReading = {
  status: ConnectStatus;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  currentlyDue: string[];
  disabledReason: string;
};

/** Map a Stripe account object to the payout status the app shows. */
export function connectStatusFromAccount(account: Record<string, unknown>): ConnectReading {
  const requirements = (account.requirements ?? {}) as { currently_due?: unknown; past_due?: unknown; disabled_reason?: unknown };
  const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
  const currentlyDue = [...new Set([...list(requirements.currently_due), ...list(requirements.past_due)])];
  const disabledReason = typeof requirements.disabled_reason === "string" ? requirements.disabled_reason : "";
  const payoutsEnabled = account.payouts_enabled === true;
  const detailsSubmitted = account.details_submitted === true;
  let status: ConnectStatus;
  if (disabledReason.startsWith("rejected")) status = "REJECTED";
  else if (payoutsEnabled && currentlyDue.length === 0) status = "VERIFIED";
  else if (detailsSubmitted) status = "PENDING";
  else status = "UNVERIFIED";
  return { status, payoutsEnabled, detailsSubmitted, currentlyDue, disabledReason };
}

/** Plain-language list of what Stripe still needs, for the influencer and admin. */
export function requirementLabels(currentlyDue: string[]) {
  const label = (field: string) => {
    if (field.includes("external_account")) return "Bank account for payouts";
    if (field.includes("verification.document")) return "Photo ID";
    if (field.includes("ssn_last_4") || field.includes("id_number")) return "Social Security number";
    if (field.includes("dob")) return "Date of birth";
    if (field.includes("address")) return "Home address";
    if (field.includes("phone")) return "Phone number";
    if (field.includes("tos_acceptance")) return "Accept Stripe's terms";
    if (field.includes("first_name") || field.includes("last_name")) return "Legal name";
    if (field.includes("email")) return "Email";
    return "Additional details";
  };
  return [...new Set(currentlyDue.map(label))];
}

/**
 * Read the influencer's Stripe account and store the result. When Stripe has verified them and their
 * country uses gateway KYC, KYC is recorded as complete once; it is never asked for again.
 */
export async function refreshCreatorConnectStatus(creatorId: string) {
  const profile = await prisma.influencerPayoutProfile.findUnique({
    where: { creatorId },
    select: { stripeConnectAccountId: true, primaryStatus: true },
  });
  const accountId = profile?.stripeConnectAccountId?.trim() ?? "";
  if (!/^acct_[A-Za-z0-9]+$/.test(accountId)) return { ok: false as const, error: "No Stripe payout account yet." };
  const { stripeCredentials, stripeGet } = await import("@/lib/stripe-admin");
  const creds = await stripeCredentials().catch(() => null);
  if (!creds?.ok) return { ok: false as const, error: "Stripe is not connected." };
  const read = await stripeGet(`/v1/accounts/${accountId}`, creds.secret);
  if (!read.ok) return { ok: false as const, error: read.error };
  const reading = connectStatusFromAccount(read.payload);
  if (profile?.primaryStatus !== reading.status) {
    const { setInfluencerPayoutMethodStatus } = await import("@/lib/payout-readiness");
    await setInfluencerPayoutMethodStatus({ creatorId, which: "primary", status: reading.status });
  }
  if (reading.status === "VERIFIED") await recordStripeKyc(creatorId, accountId);
  return { ok: true as const, ...reading };
}

/** KYC by gateway, completed by Stripe Connect onboarding. Written once; a later Stripe change never undoes it. */
async function recordStripeKyc(creatorId: string, accountId: string) {
  const creator = await prisma.creator.findUnique({ where: { id: creatorId }, select: { slug: true, locationCountry: true } });
  if (!creator) return;
  const { countryCodeFromLocation } = await import("@/lib/contract-wizard");
  const countryCode = countryCodeFromLocation(creator.locationCountry) ?? "";
  const corridor = countryCode
    ? await prisma.countryActivationCorridor.findUnique({ where: { countryCode }, select: { kycModel: true } }).catch(() => null)
    : null;
  if (corridor?.kycModel !== "gateway") return;
  const existing = await prisma.creatorKycSubmission.findUnique({ where: { creatorSlug: creator.slug } });
  if (existing?.status === "verified") return;
  await prisma.creatorKycSubmission.upsert({
    where: { creatorSlug: creator.slug },
    update: { creatorId, countryCode, kycModel: "gateway", gatewaySessionId: accountId, status: "pending_gateway" },
    create: {
      creatorSlug: creator.slug,
      creatorId,
      countryCode,
      kycModel: "gateway",
      gatewaySessionId: accountId,
      status: "pending_gateway",
      detailsJson: { source: "stripe_connect" },
    },
  });
  const { completeGatewayKyc } = await import("@/lib/kyc-document");
  await completeGatewayKyc({ creatorSlug: creator.slug, decision: "verified" });
}

/** Background refresh for accounts that are not verified yet. */
export async function refreshPendingConnectAccounts(limit = 25) {
  const rows = await prisma.influencerPayoutProfile.findMany({
    where: { stripeConnectAccountId: { startsWith: "acct_" }, primaryStatus: { not: "VERIFIED" } },
    select: { creatorId: true },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
  let verified = 0;
  for (const row of rows) {
    const result = await refreshCreatorConnectStatus(row.creatorId).catch(() => null);
    if (result?.ok && result.status === "VERIFIED") verified += 1;
  }
  return { checked: rows.length, verified };
}
