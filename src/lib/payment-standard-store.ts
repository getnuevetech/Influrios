/**
 * Durable payment-standard records. These rows do not mark provider cash as moved.
 */
import { prisma } from "@/lib/db";
import { planCoupledSettlement, stripeUsRoleMapping } from "@/lib/payment-standard-v4";

export async function nextRouteVersion(countryCode: string, environment: string) {
  const latest = await prisma.paymentRouteVersion.findFirst({
    where: { countryCode, environment },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

export async function saveRouteDraft(input: {
  countryCode: string;
  environment: "sandbox" | "live";
  currency: string;
  providerCode: string;
  allocatedFundsApproved: boolean;
  newCollectionsEnabled: boolean;
  releasesEnabled: boolean;
  evidence: string;
}) {
  const countryCode = input.countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) return { ok: false as const, error: "Enter a two-letter country code." };
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false as const, error: "Enter a three-letter currency." };
  if (input.newCollectionsEnabled && !input.allocatedFundsApproved) {
    return { ok: false as const, error: "Provider approval required. New funding stays off." };
  }
  const version = await nextRouteVersion(countryCode, input.environment);
  const mapping = stripeUsRoleMapping({
    environment: input.environment,
    allocatedFundsApproved: input.allocatedFundsApproved,
  });
  const row = await prisma.paymentRouteVersion.create({
    data: {
      countryCode,
      version,
      currency,
      environment: input.environment,
      providerCode: input.providerCode.trim() || "stripe",
      status: "draft",
      newCollectionsEnabled: input.newCollectionsEnabled && input.allocatedFundsApproved,
      releasesEnabled: input.releasesEnabled,
      roleMappingJson: mapping,
      capabilitiesJson: {
        methods: ["card"],
        ach: false,
        refunds: true,
        reversals: true,
        bankPayoutControl: false,
      },
      approvalEvidence: input.evidence.trim(),
      allocatedFundsApproved: input.allocatedFundsApproved,
    },
  });
  return { ok: true as const, id: row.id, version: row.version };
}

export async function saveTaxPolicyDraft(input: {
  name: string;
  liableEntity: string;
  treatment: string;
  customerRole: string;
  jurisdiction: string;
  classification: string;
  filingOwner: string;
  inclusive: boolean;
  rateBps: number | null;
  notes: string;
}) {
  const allowed = ["taxable", "exempt", "non_taxable", "no_collection_obligation", "unresolved"];
  if (!allowed.includes(input.treatment)) return { ok: false as const, error: "Choose an explicit tax treatment." };
  if (input.treatment === "taxable") {
    if (!input.jurisdiction.trim()) return { ok: false as const, error: "A taxable policy needs a jurisdiction." };
    if (input.rateBps == null || !Number.isInteger(input.rateBps) || input.rateBps < 0) {
      return { ok: false as const, error: "A taxable policy needs a jurisdiction rate in basis points, not a flat amount." };
    }
  }
  const name = input.name.trim();
  if (name.length < 3) return { ok: false as const, error: "Name the tax policy." };
  const latest = await prisma.taxPolicyVersion.findFirst({ where: { name }, orderBy: { version: "desc" } });
  const row = await prisma.taxPolicyVersion.create({
    data: {
      name,
      version: (latest?.version ?? 0) + 1,
      liableEntity: input.liableEntity.trim() || "Unresolved",
      treatment: input.treatment,
      customerRole: input.customerRole,
      jurisdiction: input.jurisdiction.trim(),
      classification: input.classification.trim(),
      filingOwner: input.filingOwner.trim(),
      inclusive: input.inclusive,
      rateBps: input.treatment === "taxable" ? input.rateBps : null,
      notes: input.notes.trim(),
      status: "draft",
    },
  });
  return { ok: true as const, id: row.id, version: row.version };
}

export async function recordMilestoneSettlement(input: {
  fundingId: string;
  milestoneId: string;
  agreementVersion: number;
  currency: string;
  grossCents: number;
  businessFeeCents: number;
  influencerFeeCents: number;
}) {
  const plan = planCoupledSettlement({
    grossCents: input.grossCents,
    businessFeeCents: input.businessFeeCents,
    influencerFeeCents: input.influencerFeeCents,
    alreadySettled: false,
    transferConfirmed: false,
    existingTransferRef: "",
    payoutState: "queued",
  });
  if (!plan.ok) return plan;
  const idempotencyKey = `${input.milestoneId}:${input.agreementVersion}:release`;
  const existing = await prisma.milestoneSettlementV4.findUnique({ where: { idempotencyKey } });
  if (existing) return { ok: true as const, id: existing.id, reused: true };
  const row = await prisma.milestoneSettlementV4.create({
    data: {
      fundingId: input.fundingId,
      milestoneId: input.milestoneId,
      agreementVersion: input.agreementVersion,
      currency: input.currency,
      grossCents: input.grossCents,
      businessFeeCents: input.businessFeeCents,
      influencerFeeCents: input.influencerFeeCents,
      influencerNetCents: plan.influencerNetCents,
      operationsFeeCents: plan.operationsFeeCents,
      idempotencyKey,
      status: "planned",
      payoutState: "queued",
      legs: {
        create: [
          { leg: "influencer_net", amountCents: plan.influencerNetCents, status: "planned" },
          { leg: "operations_fees", amountCents: plan.operationsFeeCents, status: "planned" },
        ],
      },
    },
  });
  return { ok: true as const, id: row.id, reused: false };
}
