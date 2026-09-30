import { prisma } from "@/lib/db";
import { resolveFee } from "@/lib/collaboration-fees";
import {
  advanceMilestone,
  autoApproveDeadline,
  canRequestPrefund,
  marketplaceDisposition,
  reconcileLedger,
  ledgerMovements,
  shouldAutoApprove,
  splitGross,
  type LedgerMovement,
} from "@/lib/ledger";
import { closeDisputesForRefund, milestoneHasOpenDispute } from "@/lib/milestone-disputes";

const PROVIDER_CODE = "primary";

class LedgerReject extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerReject";
  }
}

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && String(error.code) === "P2002";
}

export async function ensureMarketplaceDefaults() {
  await prisma.marketplaceSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", reviewWindowHours: 72 },
  });
  const jurisdictions = [
    { code: "US", label: "United States", protectedPaymentsEnabled: true, escrowTermAllowed: false },
    { code: "GB", label: "United Kingdom", protectedPaymentsEnabled: true, escrowTermAllowed: false },
    { code: "NG", label: "Nigeria", protectedPaymentsEnabled: false, escrowTermAllowed: false },
  ];
  for (const row of jurisdictions) {
    await prisma.collaborationJurisdiction.upsert({
      where: { code: row.code },
      update: {},
      create: row,
    });
  }
  await prisma.integrationProvider.upsert({
    where: { kind_code: { kind: "marketplace", code: PROVIDER_CODE } },
    update: {},
    create: { kind: "marketplace", code: PROVIDER_CODE, name: "Marketplace provider", enabled: false },
  });
  const settings = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } });
  if (settings?.templatesSeeded) return;
  await prisma.$transaction(async (tx) => {
    const current = await tx.marketplaceSettings.findUnique({ where: { id: "default" } });
    if (current?.templatesSeeded) return;
    const count = await tx.milestoneTemplate.count();
    if (count === 0) {
      await tx.milestoneTemplate.createMany({
        data: [
          { title: "Kickoff", shareBps: 3400, sortOrder: 1, active: true },
          { title: "Draft delivery", shareBps: 3300, sortOrder: 2, active: true },
          { title: "Published work", shareBps: 3300, sortOrder: 3, active: true },
        ],
      });
    }
    await tx.marketplaceSettings.update({ where: { id: "default" }, data: { templatesSeeded: true } });
  });
}

export async function marketplaceConfig() {
  await ensureMarketplaceDefaults();
  const [settings, jurisdictions, templates, provider] = await Promise.all([
    prisma.marketplaceSettings.findUnique({ where: { id: "default" } }),
    prisma.collaborationJurisdiction.findMany({ orderBy: { code: "asc" } }),
    prisma.milestoneTemplate.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.integrationProvider.findUnique({ where: { kind_code: { kind: "marketplace", code: PROVIDER_CODE } } }),
  ]);
  return {
    reviewWindowHours: settings?.reviewWindowHours ?? 72,
    cancelUnconfirmed: settings?.cancelUnconfirmed ?? true,
    jurisdictions,
    templates,
    provider: {
      id: provider?.id ?? "",
      code: provider?.code ?? PROVIDER_CODE,
      name: provider?.name ?? "Marketplace provider",
      enabled: provider?.enabled ?? false,
      webhook: provider?.webhookCipher ? ("saved" as const) : ("missing" as const),
      ready: Boolean(provider?.enabled && provider.webhookCipher),
    },
  };
}

export async function saveMarketplaceSettings(input: { reviewWindowHours: number; cancelUnconfirmed?: boolean }) {
  await ensureMarketplaceDefaults();
  const hours = Math.round(input.reviewWindowHours);
  if (!Number.isFinite(hours) || hours < 1 || hours > 24 * 30) {
    throw new Error("Review window must be between 1 and 720 hours.");
  }
  return prisma.marketplaceSettings.update({
    where: { id: "default" },
    data: {
      reviewWindowHours: hours,
      ...(input.cancelUnconfirmed == null ? {} : { cancelUnconfirmed: input.cancelUnconfirmed }),
    },
  });
}

export async function saveJurisdiction(input: {
  code: string;
  label: string;
  protectedPaymentsEnabled: boolean;
  escrowTermAllowed: boolean;
}) {
  await ensureMarketplaceDefaults();
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error("Use a two-letter jurisdiction code.");
  const label = input.label.trim().slice(0, 80);
  if (!label) throw new Error("A jurisdiction label is required.");
  return prisma.collaborationJurisdiction.upsert({
    where: { code },
    update: {
      label,
      protectedPaymentsEnabled: input.protectedPaymentsEnabled,
      escrowTermAllowed: input.escrowTermAllowed && input.protectedPaymentsEnabled,
    },
    create: {
      code,
      label,
      protectedPaymentsEnabled: input.protectedPaymentsEnabled,
      escrowTermAllowed: input.escrowTermAllowed && input.protectedPaymentsEnabled,
    },
  });
}

export async function saveMilestoneTemplates(rows: { id?: string; title: string; sharePercent: number; active: boolean }[]) {
  await ensureMarketplaceDefaults();
  const cleaned = rows
    .map((row, index) => ({
      id: row.id,
      title: row.title.trim().slice(0, 120),
      shareBps: Math.round(row.sharePercent) * 100,
      active: row.active,
      sortOrder: index + 1,
    }))
    .filter((row) => row.title);
  const activeShare = cleaned.filter((row) => row.active).reduce((sum, row) => sum + row.shareBps, 0);
  if (activeShare !== 10_000) throw new Error("Active milestone shares must add up to 100%.");
  if (cleaned.some((row) => row.shareBps <= 0 || row.shareBps > 10_000)) {
    throw new Error("Each milestone share must be between 1% and 100%.");
  }
  await prisma.$transaction(async (tx) => {
    const keep = new Set<string>();
    for (const row of cleaned) {
      if (row.id) {
        await tx.milestoneTemplate.update({
          where: { id: row.id },
          data: { title: row.title, shareBps: row.shareBps, active: row.active, sortOrder: row.sortOrder },
        });
        keep.add(row.id);
      } else {
        const created = await tx.milestoneTemplate.create({
          data: { title: row.title, shareBps: row.shareBps, active: row.active, sortOrder: row.sortOrder },
        });
        keep.add(created.id);
      }
    }
    await tx.milestoneTemplate.deleteMany({ where: { id: { notIn: [...keep] } } });
  });
}

export async function saveMarketplaceProvider(input: {
  name: string;
  enabled: boolean;
  webhook: string;
  clearWebhook?: boolean;
}) {
  await ensureMarketplaceDefaults();
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("A provider name is required.");
  const existing = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: "marketplace", code: PROVIDER_CODE } },
  });
  let webhookCipher = existing?.webhookCipher ?? null;
  if (input.clearWebhook) webhookCipher = null;
  if (input.webhook.trim()) {
    const { encryptSecret } = await import("@/lib/provider-secrets");
    webhookCipher = encryptSecret(input.webhook.trim());
  }
  return prisma.integrationProvider.update({
    where: { kind_code: { kind: "marketplace", code: PROVIDER_CODE } },
    data: { name, enabled: input.enabled, webhookCipher },
  });
}

export async function requestPrefund(input: {
  jurisdictionCode: string;
  businessName: string;
  creatorSlug: string;
  title: string;
  grossCents: number;
  serviceLevel?: string;
}) {
  await ensureMarketplaceDefaults();
  const code = input.jurisdictionCode.trim().toUpperCase();
  const [jurisdiction, provider, settings, templates] = await Promise.all([
    prisma.collaborationJurisdiction.findUnique({ where: { code } }),
    prisma.integrationProvider.findUnique({ where: { kind_code: { kind: "marketplace", code: PROVIDER_CODE } } }),
    prisma.marketplaceSettings.findUnique({ where: { id: "default" } }),
    prisma.milestoneTemplate.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const gate = canRequestPrefund({
    jurisdictionEnabled: Boolean(jurisdiction?.protectedPaymentsEnabled),
    providerReady: Boolean(provider?.enabled && provider.webhookCipher),
  });
  if (!gate.ok) return gate;
  if (!Number.isInteger(input.grossCents) || input.grossCents <= 0) {
    return { ok: false as const, error: "Enter a gross amount greater than zero." };
  }
  const amounts = splitGross(
    input.grossCents,
    templates.map((row) => row.shareBps),
  );
  if (!amounts) return { ok: false as const, error: "Milestone templates must add up to 100%." };
  const serviceLevel = (input.serviceLevel || "contracted").slice(0, 40);
  const quote = await resolveFee({
    jurisdiction: code,
    serviceLevel,
    grossValueCents: input.grossCents,
  }).catch(() => null);
  const feeCents = quote?.feeCents ?? 0;
  const windowHours = settings?.reviewWindowHours ?? 72;
  const funding = await prisma.collaborationFunding.create({
    data: {
      jurisdictionCode: code,
      businessName: input.businessName.trim().slice(0, 120),
      creatorSlug: input.creatorSlug.trim().slice(0, 80),
      title: input.title.trim().slice(0, 160),
      grossCents: input.grossCents,
      feeCents,
      serviceLevel,
      feeSnapshotJson: {
        ruleId: quote?.rule?.id ?? null,
        ruleName: quote?.rule?.name ?? null,
        ruleVersion: quote?.rule?.version ?? null,
        percentBps: quote?.rule?.percentBps ?? null,
        fixedCents: quote?.rule?.fixedCents ?? null,
        feeCents,
        explanation: quote?.explanation ?? "Fee rules were unavailable.",
        capturedAt: new Date().toISOString(),
      },
      status: "awaiting_provider",
      providerCode: provider!.code,
      milestones: {
        create: templates.map((template, index) => ({
          title: template.title,
          amountCents: amounts[index],
          sortOrder: template.sortOrder,
          status: "pending",
          reviewWindowHours: windowHours,
        })),
      },
    },
  });
  await prisma.auditLog.create({
    data: {
      actor: "marketplace",
      action: "prefund_requested",
      objectType: "CollaborationFunding",
      objectId: funding.id,
      after: { status: funding.status, grossCents: funding.grossCents, feeCents },
    },
  }).catch(() => undefined);
  return { ok: true as const, id: funding.id, status: funding.status as "awaiting_provider" };
}

async function sweepAutoApprovals() {
  const due = await prisma.fundingMilestone.findMany({
    where: { status: "submitted", autoApproveAt: { lte: new Date() } },
  });
  for (const milestone of due) {
    if (!shouldAutoApprove(milestone.status, milestone.autoApproveAt, new Date())) continue;
    const next = advanceMilestone("submitted", "auto_approve");
    if (!next.ok) continue;
    await prisma.fundingMilestone.updateMany({
      where: { id: milestone.id, status: "submitted" },
      data: { status: next.status, approvedAt: new Date() },
    });
  }
}

export async function listFundings() {
  await sweepAutoApprovals();
  const rows = await prisma.collaborationFunding.findMany({
    orderBy: { createdAt: "desc" },
    include: { milestones: { orderBy: { sortOrder: "asc" } }, entries: { orderBy: { createdAt: "asc" } }, disputes: { where: { status: { in: ["open", "under_review", "refund_requested"] } }, select: { id: true, milestoneId: true, status: true } } },
    take: 50,
  });
  return rows.map(presentFunding);
}

export async function listFundingsForCreator(creatorSlug: string) {
  await sweepAutoApprovals();
  const rows = await prisma.collaborationFunding.findMany({
    where: { creatorSlug },
    orderBy: { createdAt: "desc" },
    include: { milestones: { orderBy: { sortOrder: "asc" } }, entries: true, disputes: { where: { status: { in: ["open", "under_review", "refund_requested"] } }, select: { id: true, milestoneId: true, status: true } } },
    take: 20,
  });
  return rows.map(presentFunding);
}

function presentFunding(row: {
  id: string;
  jurisdictionCode: string;
  businessName: string;
  creatorSlug: string;
  title: string;
  currency: string;
  grossCents: number;
  feeCents: number;
  status: string;
  providerCode: string;
  milestones: {
    id: string;
    title: string;
    amountCents: number;
    status: string;
    sortOrder: number;
    autoApproveAt: Date | null;
  }[];
  entries: { kind: string; amountCents: number }[];
  disputes?: { id: string; milestoneId: string | null; status: string }[];
}) {
  const movements: LedgerMovement[] = ledgerMovements(row.entries);
  return { ...row, ledger: reconcileLedger(movements, row.grossCents) };
}

export async function submitFundingMilestone(fundingId: string, milestoneId: string) {
  const milestone = await prisma.fundingMilestone.findFirst({
    where: { id: milestoneId, fundingId },
    include: { funding: true },
  });
  if (!milestone) return { ok: false as const, error: "Milestone not found." };
  if (milestone.funding.status !== "held") {
    return { ok: false as const, error: "Submit work after the provider confirms the prefund." };
  }
  const next = advanceMilestone(milestone.status as "pending", "submit");
  if (!next.ok) return next;
  const submittedAt = new Date();
  await prisma.fundingMilestone.update({
    where: { id: milestone.id },
    data: {
      status: next.status,
      submittedAt,
      autoApproveAt: autoApproveDeadline(submittedAt, milestone.reviewWindowHours),
    },
  });
  return { ok: true as const };
}

export async function approveFundingMilestone(fundingId: string, milestoneId: string) {
  const milestone = await prisma.fundingMilestone.findFirst({ where: { id: milestoneId, fundingId } });
  if (!milestone) return { ok: false as const, error: "Milestone not found." };
  const next = advanceMilestone(milestone.status as "submitted", "approve");
  if (!next.ok) return next;
  await prisma.fundingMilestone.update({
    where: { id: milestone.id },
    data: { status: next.status, approvedAt: new Date() },
  });
  return { ok: true as const };
}

export async function applyMarketplaceEvent(input: {
  provider: string;
  eventId: string;
  eventType: string;
  fundingId: string;
  amountCents: number;
  milestoneId?: string | null;
}) {
  const eventId = input.eventId.trim();
  if (!eventId) return { applied: false, result: "rejected" as const };
  const providerKey = `marketplace:${input.provider}`;
  const existing = await prisma.processedWebhook.findUnique({
    where: { provider_eventId: { provider: providerKey, eventId } },
  });
  if (existing) return { applied: false, result: "duplicate" as const };
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: input.fundingId },
    include: { milestones: true, entries: true },
  });
  if (!funding) return { applied: false, result: "missing" as const };
  const prior = reconcileLedger(ledgerMovements(funding.entries), funding.grossCents);
  const milestone = input.milestoneId
    ? funding.milestones.find((row) => row.id === input.milestoneId) ?? null
    : null;
  const disputeOpen = milestone
    ? await milestoneHasOpenDispute(funding.id, milestone.id)
    : false;
  const expectedCents =
    input.eventType === "funding.held" || input.eventType === "funding.failed"
      ? funding.grossCents
      : (milestone?.amountCents ?? -1);
  const disposition = marketplaceDisposition({
    eventType: input.eventType,
    fundingStatus: funding.status,
    amountCents: input.amountCents,
    expectedCents,
    heldCents: prior.heldCents,
    milestoneStatus: milestone?.status,
    disputeOpen,
  });
  if (disposition === "reject") return { applied: false, result: "rejected" as const };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.processedWebhook.create({
        data: {
          provider: providerKey,
          eventId,
          eventType: input.eventType,
          result: disposition,
        },
      });
      if (disposition !== "apply") return;
      if (input.eventType === "funding.held") {
        const updated = await tx.collaborationFunding.updateMany({
          where: { id: funding.id, status: "awaiting_provider" },
          data: { status: "held" },
        });
        if (updated.count !== 1) throw new LedgerReject("Prefund is not awaiting the provider.");
        await tx.ledgerEntry.create({
          data: {
            fundingId: funding.id,
            kind: "hold",
            amountCents: funding.grossCents,
            provider: providerKey,
            eventId,
          },
        });
        if (funding.feeCents > 0) {
          await tx.ledgerEntry.create({
            data: {
              fundingId: funding.id,
              kind: "fee",
              amountCents: funding.feeCents,
              provider: providerKey,
              eventId,
            },
          });
        }
        return;
      }
      if (input.eventType === "funding.failed") {
        await tx.collaborationFunding.updateMany({
          where: { id: funding.id, status: "awaiting_provider" },
          data: { status: "cancelled" },
        });
        return;
      }
      if (input.eventType === "payout.released" && milestone) {
        const blocking = await tx.milestoneDispute.findFirst({
          where: {
            fundingId: funding.id,
            status: { in: ["open", "under_review", "refund_requested"] },
            OR: [{ milestoneId: milestone.id }, { milestoneId: null }],
          },
        });
        if (blocking) throw new LedgerReject("This milestone is in dispute.");
        const fresh = await tx.ledgerEntry.findMany({ where: { fundingId: funding.id } });
        const held = reconcileLedger(ledgerMovements(fresh), funding.grossCents);
        if (held.heldCents < milestone.amountCents) throw new LedgerReject("The provider is not holding enough.");
        const released = await tx.fundingMilestone.updateMany({
          where: { id: milestone.id, status: "approved" },
          data: { status: "released" },
        });
        if (released.count !== 1) throw new LedgerReject("Milestone is not approved.");
        await tx.ledgerEntry.create({
          data: {
            fundingId: funding.id,
            milestoneId: milestone.id,
            kind: "release",
            amountCents: milestone.amountCents,
            provider: providerKey,
            eventId,
          },
        });
        const open = await tx.fundingMilestone.count({
          where: { fundingId: funding.id, status: { not: "released" } },
        });
        if (open === 0) {
          await tx.collaborationFunding.update({ where: { id: funding.id }, data: { status: "completed" } });
        }
        return;
      }
      if (input.eventType === "payout.refunded") {
        const fresh = await tx.ledgerEntry.findMany({ where: { fundingId: funding.id } });
        const held = reconcileLedger(ledgerMovements(fresh), funding.grossCents);
        if (input.amountCents > held.heldCents) throw new LedgerReject("Refund is larger than the held amount.");
        await tx.ledgerEntry.create({
          data: {
            fundingId: funding.id,
            milestoneId: milestone?.id,
            kind: "refund",
            amountCents: input.amountCents,
            provider: providerKey,
            eventId,
          },
        });
        if (held.heldCents - input.amountCents === 0) {
          await tx.collaborationFunding.updateMany({
            where: { id: funding.id, status: "held" },
            data: { status: "refunded" },
          });
        }
        if (milestone && input.amountCents >= milestone.amountCents) {
          await tx.fundingMilestone.updateMany({
            where: { id: milestone.id, status: { notIn: ["released"] } },
            data: { status: "refunded" },
          });
        }
      }
    });
  } catch (error) {
    if (isUnique(error)) return { applied: false, result: "duplicate" as const };
    if (error instanceof LedgerReject) return { applied: false, result: "rejected" as const };
    throw error;
  }
  if (input.eventType === "payout.refunded" && disposition === "apply") {
    await closeDisputesForRefund({
      fundingId: funding.id,
      milestoneId: milestone?.id,
      refundedCents: input.amountCents,
    }).catch(() => undefined);
  }
  if (disposition === "apply") {
    await prisma.auditLog.create({
      data: {
        actor: providerKey,
        action: input.eventType,
        objectType: "CollaborationFunding",
        objectId: funding.id,
        after: { eventId, amountCents: input.amountCents },
      },
    }).catch(() => undefined);
  }
  return { applied: disposition === "apply", result: disposition };
}

export async function marketplaceWebhookSecret() {
  await ensureMarketplaceDefaults();
  const provider = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: "marketplace", code: PROVIDER_CODE } },
  });
  if (!provider?.enabled || !provider.webhookCipher) return null;
  const { decryptSecret } = await import("@/lib/provider-secrets");
  const secret = decryptSecret(provider.webhookCipher);
  if (!secret) return null;
  return { code: provider.code, secret };
}
