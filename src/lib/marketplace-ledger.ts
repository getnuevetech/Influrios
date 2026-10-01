import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { resolveFee } from "@/lib/collaboration-fees";
import {
  advanceMilestone,
  autoApproveDeadline,
  releasableCents,
  canRequestChangeOrder,
  canRequestPrefund,
  disputeLoadAllowsPrefund,
  grossWithinCap,
  sharesFromAmounts,
  summarizeLedgerReport,
  marketplaceDisposition,
  reconcileLedger,
  summarizeLedger,
  ledgerMovements,
  requestRevision,
  shouldAutoApprove,
  splitGross,
  type LedgerMovement,
} from "@/lib/ledger";
import { resolveDealAttribution } from "@/lib/deal-attribution";
import { planSchedule, recurrenceIsDue } from "@/lib/schedule";
import { convertFee, readFxSnapshot, readShareSnapshot, shareLines } from "@/lib/fx-share";
import { activeShareSnapshot, ensureSettlementDefaults } from "@/lib/settlement";
import { quoteWiseUserRate } from "@/lib/wise-quote";
import { closeDisputesForRefund, milestoneHasOpenDispute } from "@/lib/milestone-disputes";

const PROVIDER_CODE = "primary";

let grossCapForTests: number | null = null;
let changeOrdersForTests: boolean | null = null;

/** Tests pin the USD cap without writing the shared settings row. */
export function setGrossCapForTests(cents: number | null) {
  grossCapForTests = cents;
}

/** Tests pin the change-order switch without writing the shared settings row. */
export function setChangeOrdersForTests(enabled: boolean | null) {
  changeOrdersForTests = enabled;
}

function activeGrossCap(stored: number | null | undefined) {
  return grossCapForTests ?? stored ?? 0;
}

class LedgerReject extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerReject";
  }
}

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && String(error.code) === "P2002";
}

function fxRecord(fx: {
  usdCents: number;
  minorPerUsd: number;
  currency: string;
  source: "admin" | "identity" | "wise";
  convertedMinor: number;
  rate?: number | null;
  quoteId?: string | null;
  quotedAt?: string | null;
  rateType?: string | null;
}) {
  return {
    usdCents: fx.usdCents,
    minorPerUsd: fx.minorPerUsd,
    currency: fx.currency,
    source: fx.source,
    convertedMinor: fx.convertedMinor,
    ...(fx.rate != null ? { rate: fx.rate } : {}),
    ...(fx.quoteId ? { quoteId: fx.quoteId } : {}),
    ...(fx.quotedAt ? { quotedAt: fx.quotedAt } : {}),
    ...(fx.rateType ? { rateType: fx.rateType } : {}),
  };
}

export async function ensureMarketplaceDefaults() {
  await prisma.marketplaceSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", reviewWindowHours: 72 },
  });
  const jurisdictions = [
    { code: "US", label: "United States", protectedPaymentsEnabled: true, escrowTermAllowed: false, currency: "USD", minorDigits: 2, providerCode: "primary" },
    { code: "GB", label: "United Kingdom", protectedPaymentsEnabled: true, escrowTermAllowed: false, currency: "GBP", minorDigits: 2, providerCode: "primary" },
    { code: "NG", label: "Nigeria", protectedPaymentsEnabled: false, escrowTermAllowed: false, currency: "NGN", minorDigits: 2, providerCode: "primary" },
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
  const [settings, jurisdictions, templates, providers] = await Promise.all([
    prisma.marketplaceSettings.findUnique({ where: { id: "default" } }),
    prisma.collaborationJurisdiction.findMany({ orderBy: { code: "asc" } }),
    prisma.milestoneTemplate.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.integrationProvider.findMany({ where: { kind: "marketplace" }, orderBy: { code: "asc" } }),
  ]);
  const provider = providers.find((row) => row.code === PROVIDER_CODE) ?? null;
  return {
    reviewWindowHours: settings?.reviewWindowHours ?? 72,
    maxRevisions: settings?.maxRevisions ?? 2,
    maxEvidence: settings?.maxEvidence ?? 5,
    maxGrossCents: settings?.maxGrossCents ?? 0,
    partialRefundsEnabled: settings?.partialRefundsEnabled ?? true,
    changeOrdersEnabled: settings?.changeOrdersEnabled ?? true,
    maxChangeOrders: settings?.maxChangeOrders ?? 2,
    riskControlsEnabled: settings?.riskControlsEnabled ?? true,
    maxOpenDisputes: settings?.maxOpenDisputes ?? 0,
    cancelUnconfirmed: settings?.cancelUnconfirmed ?? true,
    attributionWindowDays: settings?.attributionWindowDays ?? 90,
    repeatMinGrossCents: settings?.repeatMinGrossCents ?? 0,
    stagedFundingEnabled: settings?.stagedFundingEnabled ?? true,
    recurringFundingEnabled: settings?.recurringFundingEnabled ?? true,
    maxStages: settings?.maxStages ?? 4,
    recurringIntervalDays: settings?.recurringIntervalDays ?? 30,
    maxRecurrences: settings?.maxRecurrences ?? 6,
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
    providers: providers.map((row) => ({
      code: row.code,
      name: row.name,
      enabled: row.enabled,
      webhook: row.webhookCipher ? ("saved" as const) : ("missing" as const),
      ready: Boolean(row.enabled && row.webhookCipher),
    })),
  };
}

export async function saveMarketplaceSettings(input: {
  reviewWindowHours: number;
  maxRevisions?: number;
  maxEvidence?: number;
  maxGrossCents?: number;
  partialRefundsEnabled?: boolean;
  changeOrdersEnabled?: boolean;
  maxChangeOrders?: number;
  riskControlsEnabled?: boolean;
  maxOpenDisputes?: number;
  cancelUnconfirmed?: boolean;
}) {
  await ensureMarketplaceDefaults();
  const hours = Math.round(input.reviewWindowHours);
  if (!Number.isFinite(hours) || hours < 1 || hours > 24 * 30) {
    throw new Error("Review window must be between 1 and 720 hours.");
  }
  const maxRevisions = input.maxRevisions == null ? null : Math.round(input.maxRevisions);
  if (maxRevisions != null && (!Number.isInteger(maxRevisions) || maxRevisions < 0 || maxRevisions > 20)) {
    throw new Error("Revision limit must be from 0 to 20.");
  }
  const maxEvidence = input.maxEvidence == null ? null : Math.round(input.maxEvidence);
  if (maxEvidence != null && (!Number.isInteger(maxEvidence) || maxEvidence < 0 || maxEvidence > 20)) {
    throw new Error("Evidence limit must be from 0 to 20.");
  }
  const maxGrossCents = input.maxGrossCents == null ? null : Math.round(input.maxGrossCents);
  if (maxGrossCents != null && (!Number.isInteger(maxGrossCents) || maxGrossCents < 0 || maxGrossCents > 100_000_000)) {
    throw new Error("Gross cap must be from 0 to 1,000,000 USD.");
  }
  const maxChangeOrders = input.maxChangeOrders == null ? null : Math.round(input.maxChangeOrders);
  if (maxChangeOrders != null && (!Number.isInteger(maxChangeOrders) || maxChangeOrders < 0 || maxChangeOrders > 20)) {
    throw new Error("Change order limit must be from 0 to 20.");
  }
  const maxOpenDisputes = input.maxOpenDisputes == null ? null : Math.round(input.maxOpenDisputes);
  if (maxOpenDisputes != null && (!Number.isInteger(maxOpenDisputes) || maxOpenDisputes < 0 || maxOpenDisputes > 1000)) {
    throw new Error("Open-dispute limit must be from 0 to 1000.");
  }
  return prisma.marketplaceSettings.update({
    where: { id: "default" },
    data: {
      reviewWindowHours: hours,
      ...(maxRevisions == null ? {} : { maxRevisions }),
      ...(maxEvidence == null ? {} : { maxEvidence }),
      ...(maxGrossCents == null ? {} : { maxGrossCents }),
      ...(input.partialRefundsEnabled == null ? {} : { partialRefundsEnabled: input.partialRefundsEnabled }),
      ...(input.changeOrdersEnabled == null ? {} : { changeOrdersEnabled: input.changeOrdersEnabled }),
      ...(maxChangeOrders == null ? {} : { maxChangeOrders }),
      ...(input.riskControlsEnabled == null ? {} : { riskControlsEnabled: input.riskControlsEnabled }),
      ...(maxOpenDisputes == null ? {} : { maxOpenDisputes }),
      ...(input.cancelUnconfirmed == null ? {} : { cancelUnconfirmed: input.cancelUnconfirmed }),
    },
  });
}

export async function saveJurisdiction(input: {
  code: string;
  label: string;
  protectedPaymentsEnabled: boolean;
  escrowTermAllowed: boolean;
  currency: string;
  minorDigits: number;
  providerCode: string;
}) {
  await ensureMarketplaceDefaults();
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error("Use a two-letter jurisdiction code.");
  const label = input.label.trim().slice(0, 80);
  if (!label) throw new Error("A jurisdiction label is required.");
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Use a three-letter currency.");
  const minorDigits = Math.round(input.minorDigits);
  if (!Number.isInteger(minorDigits) || minorDigits < 0 || minorDigits > 4) {
    throw new Error("Minor digits must be from 0 to 4.");
  }
  const providerCode = input.providerCode.trim().toLowerCase();
  const assigned = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: "marketplace", code: providerCode } },
  });
  if (!assigned) throw new Error("Choose a marketplace provider.");
  return prisma.collaborationJurisdiction.upsert({
    where: { code },
    update: {
      label,
      protectedPaymentsEnabled: input.protectedPaymentsEnabled,
      escrowTermAllowed: input.escrowTermAllowed && input.protectedPaymentsEnabled,
      currency,
      minorDigits,
      providerCode,
    },
    create: {
      code,
      label,
      protectedPaymentsEnabled: input.protectedPaymentsEnabled,
      escrowTermAllowed: input.escrowTermAllowed && input.protectedPaymentsEnabled,
      currency,
      minorDigits,
      providerCode,
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
  code?: string;
  name: string;
  enabled: boolean;
  webhook: string;
  clearWebhook?: boolean;
}) {
  await ensureMarketplaceDefaults();
  const code = (input.code || PROVIDER_CODE).trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(code)) throw new Error("Use a short provider code.");
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("A provider name is required.");
  const existing = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: "marketplace", code } },
  });
  if (!existing) {
    let webhookCipher: string | null = null;
    if (input.webhook.trim()) {
      const { encryptSecret } = await import("@/lib/provider-secrets");
      webhookCipher = encryptSecret(input.webhook.trim());
    }
    return prisma.integrationProvider.create({
      data: { kind: "marketplace", code, name, enabled: input.enabled, webhookCipher },
    });
  }
  let webhookCipher = existing?.webhookCipher ?? null;
  if (input.clearWebhook) webhookCipher = null;
  if (input.webhook.trim()) {
    const { encryptSecret } = await import("@/lib/provider-secrets");
    webhookCipher = encryptSecret(input.webhook.trim());
  }
  return prisma.integrationProvider.update({
    where: { kind_code: { kind: "marketplace", code } },
    data: { name, enabled: input.enabled, webhookCipher },
  });
}

export async function saveFundingSchedule(input: {
  stagedFundingEnabled: boolean;
  recurringFundingEnabled: boolean;
  maxStages: number;
  recurringIntervalDays: number;
  maxRecurrences: number;
}) {
  await ensureMarketplaceDefaults();
  const maxStages = Math.round(input.maxStages);
  const intervalDays = Math.round(input.recurringIntervalDays);
  const maxRecurrences = Math.round(input.maxRecurrences);
  if (!Number.isFinite(maxStages) || maxStages < 2 || maxStages > 12) {
    throw new Error("Staged deals must allow between 2 and 12 stages.");
  }
  if (!Number.isFinite(intervalDays) || intervalDays < 1 || intervalDays > 365) {
    throw new Error("Recurring interval must be between 1 and 365 days.");
  }
  if (!Number.isFinite(maxRecurrences) || maxRecurrences < 2 || maxRecurrences > 24) {
    throw new Error("Recurring deals must allow between 2 and 24 occurrences.");
  }
  return prisma.marketplaceSettings.update({
    where: { id: "default" },
    data: {
      stagedFundingEnabled: input.stagedFundingEnabled,
      recurringFundingEnabled: input.recurringFundingEnabled,
      maxStages,
      recurringIntervalDays: intervalDays,
      maxRecurrences,
    },
  });
}

export async function requestPrefund(input: {
  jurisdictionCode: string;
  businessName: string;
  creatorSlug: string;
  title: string;
  grossCents: number;
  serviceLevel?: string;
  sourceId?: string | null;
  repeatOfId?: string | null;
  scheduleKind?: string;
  stageCount?: number;
  occurrenceCount?: number;
}) {
  await ensureMarketplaceDefaults();
  await ensureSettlementDefaults();
  const code = input.jurisdictionCode.trim().toUpperCase();
  const jurisdiction = await prisma.collaborationJurisdiction.findUnique({ where: { code } });
  const assignedCode = jurisdiction?.providerCode || PROVIDER_CODE;
  const currency = (jurisdiction?.currency || "USD").toUpperCase();
  const minorDigits = jurisdiction?.minorDigits ?? 2;
  const [provider, settings, templates, fxRate] = await Promise.all([
    prisma.integrationProvider.findUnique({ where: { kind_code: { kind: "marketplace", code: assignedCode } } }),
    prisma.marketplaceSettings.findUnique({ where: { id: "default" } }),
    prisma.milestoneTemplate.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    currency === "USD" ? Promise.resolve(null) : prisma.fxRate.findUnique({ where: { currency } }),
  ]);
  if (!Number.isInteger(input.grossCents) || input.grossCents <= 0) {
    return { ok: false as const, error: "Enter a gross amount greater than zero." };
  }
  const cap = grossWithinCap({ grossCents: input.grossCents, maxGrossCents: activeGrossCap(settings?.maxGrossCents) });
  if (!cap.ok) return cap;
  const businessNameForRisk = input.businessName.trim().slice(0, 120);
  const openDisputes = await prisma.milestoneDispute.count({
    where: {
      status: { in: ["open", "under_review", "refund_requested"] },
      funding: { businessName: businessNameForRisk },
    },
  });
  const risk = disputeLoadAllowsPrefund({
    enabled: settings?.riskControlsEnabled ?? true,
    openDisputes,
    maxOpenDisputes: settings?.maxOpenDisputes ?? 0,
  });
  if (!risk.ok) return risk;
  const gate = canRequestPrefund({
    jurisdictionEnabled: Boolean(jurisdiction?.protectedPaymentsEnabled),
    providerReady: Boolean(provider?.enabled && provider.webhookCipher),
  });
  if (!gate.ok) return gate;
  const attribution = await resolveDealAttribution({
    businessName: input.businessName,
    creatorSlug: input.creatorSlug,
    sourceId: input.sourceId,
    repeatOfId: input.repeatOfId,
  });
  if (!attribution.ok) return attribution;
  const schedule = planSchedule({
    kind: input.scheduleKind ?? "once",
    grossCents: input.grossCents,
    stageCount: input.stageCount,
    occurrenceCount: input.occurrenceCount,
    stagedEnabled: settings?.stagedFundingEnabled ?? true,
    recurringEnabled: settings?.recurringFundingEnabled ?? true,
    maxStages: settings?.maxStages ?? 4,
    maxRecurrences: settings?.maxRecurrences ?? 6,
    intervalDays: settings?.recurringIntervalDays ?? 30,
  });
  if (!schedule.ok) return schedule;
  const shares = templates.map((row) => row.shareBps);
  const serviceLevel = (input.serviceLevel || "contracted").slice(0, 40);
  const windowHours = settings?.reviewWindowHours ?? 72;
  const revisionLimit = settings?.maxRevisions ?? 2;
  const changeOrderLimit = settings?.maxChangeOrders ?? 2;
  const businessName = input.businessName.trim().slice(0, 120);
  const creatorSlug = input.creatorSlug.trim().slice(0, 80);
  const baseTitle = input.title.trim().slice(0, 140);
  if (currency !== "USD" && !fxRate?.active) {
    return { ok: false as const, error: `No Wise currency is saved for ${currency}. Nothing was funded.` };
  }
  const shareSnapshot = await activeShareSnapshot();
  const prepared: {
    gross: number;
    fx: Extract<Awaited<ReturnType<typeof quoteWiseUserRate>>, { ok: true }>;
    milestoneAmounts: number[];
    quote: Awaited<ReturnType<typeof resolveFee>> | null;
  }[] = [];
  for (let index = 0; index < schedule.parts.length; index += 1) {
    const usdCents = schedule.parts[index];
    const fx = await quoteWiseUserRate({ currency, usdCents, minorDigits });
    if (!fx.ok) return fx;
    const milestoneAmounts = splitGross(fx.convertedMinor, shares);
    if (!milestoneAmounts) return { ok: false as const, error: "Milestone templates must add up to 100%." };
    const quote = await resolveFee({
      jurisdiction: code,
      serviceLevel,
      grossValueCents: usdCents,
    }).catch(() => null);
    prepared.push({ gross: fx.convertedMinor, fx, milestoneAmounts, quote });
  }
  const scheduleId = schedule.kind === "once" ? null : randomUUID();
  const created = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];
    for (let index = 0; index < prepared.length; index += 1) {
      const part = prepared[index];
      const quote = part.quote;
      const feeCents = convertFee(quote?.feeCents ?? 0, part.fx);
      const suffix =
        schedule.kind === "staged"
          ? ` · stage ${index + 1} of ${schedule.trancheCount}`
          : schedule.kind === "recurring"
            ? ` · ${index + 1} of ${schedule.trancheCount}`
            : "";
      const row = await tx.collaborationFunding.create({
        data: {
          jurisdictionCode: code,
          businessName,
          creatorSlug,
          title: `${baseTitle.slice(0, 160 - suffix.length)}${suffix}`,
          currency: part.fx.currency,
          grossCents: part.gross,
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
          fxSnapshotJson: fxRecord(part.fx),
          shareSnapshotJson: shareSnapshot,
          status: "awaiting_provider",
          providerCode: provider!.code,
          attributionLabel: attribution.attributionLabel,
          repeatOfId: attribution.repeatOfId,
          changeOrderLimit,
          scheduleId,
          scheduleKind: schedule.kind,
          trancheIndex: index + 1,
          trancheCount: schedule.trancheCount,
          intervalDays: schedule.intervalDays,
          milestones: {
            create: templates.map((template, milestoneIndex) => ({
              title: template.title,
              amountCents: part.milestoneAmounts[milestoneIndex],
              sortOrder: template.sortOrder,
              status: "pending",
              reviewWindowHours: windowHours,
              revisionLimit,
            })),
          },
        },
      });
      ids.push(row.id);
    }
    return ids;
  });
  await prisma.auditLog.create({
    data: {
      actor: "marketplace",
      action: "prefund_requested",
      objectType: "CollaborationFunding",
      objectId: created[0],
      after: {
        status: "awaiting_provider",
        scheduleKind: schedule.kind,
        trancheCount: schedule.trancheCount,
        grossCents: input.grossCents,
        currency,
        attributionLabel: attribution.attributionLabel,
        repeatOfId: attribution.repeatOfId,
      },
    },
  }).catch(() => undefined);
  return { ok: true as const, id: created[0], status: "awaiting_provider" as const };
}

export async function sweepDueRecurrences(now = new Date()) {
  const confirmed = await prisma.collaborationFunding.findMany({
    where: { scheduleKind: "recurring", status: { in: ["held", "completed", "refunded"] } },
    include: { entries: { where: { kind: "hold" }, orderBy: { createdAt: "asc" }, take: 1 } },
  });
  const [templates, settings] = await Promise.all([
    prisma.milestoneTemplate.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.marketplaceSettings.findUnique({ where: { id: "default" } }),
  ]);
  const shares = templates.map((row) => row.shareBps);
  const windowHours = settings?.reviewWindowHours ?? 72;
  const revisionLimit = settings?.maxRevisions ?? 2;
  const changeOrderLimit = settings?.maxChangeOrders ?? 2;
  const shareSnapshot = await activeShareSnapshot();
  for (const row of confirmed) {
    if (!row.scheduleId || row.trancheIndex >= row.trancheCount) continue;
    const holdAt = row.entries[0]?.createdAt ?? null;
    if (!recurrenceIsDue({ holdAt, intervalDays: row.intervalDays, now })) continue;
    const nextIndex = row.trancheIndex + 1;
    const existing = await prisma.collaborationFunding.findFirst({
      where: { scheduleId: row.scheduleId, trancheIndex: nextIndex },
    });
    if (existing) continue;
    const snapshot = readFxSnapshot(row.fxSnapshotJson);
    const usdCents = snapshot?.usdCents ?? row.grossCents;
    const cap = grossWithinCap({ grossCents: usdCents, maxGrossCents: activeGrossCap(settings?.maxGrossCents) });
    if (!cap.ok) continue;
    const currency = (row.currency || "USD").toUpperCase();
    if (currency !== "USD") {
      const allowed = await prisma.fxRate.findUnique({ where: { currency } });
      if (!allowed?.active) continue;
    }
    const jurisdiction = await prisma.collaborationJurisdiction.findUnique({
      where: { code: row.jurisdictionCode },
    });
    const fx = await quoteWiseUserRate({
      currency,
      usdCents,
      minorDigits: jurisdiction?.minorDigits ?? 2,
    });
    if (!fx.ok) continue;
    const milestoneAmounts = splitGross(fx.convertedMinor, shares);
    if (!milestoneAmounts) continue;
    const quote = await resolveFee({
      jurisdiction: row.jurisdictionCode,
      serviceLevel: row.serviceLevel,
      grossValueCents: usdCents,
    }).catch(() => null);
    const feeCents = convertFee(quote?.feeCents ?? 0, fx);
    const suffix = ` · ${nextIndex} of ${row.trancheCount}`;
    const baseTitle = row.title.replace(/ · \d+ of \d+$/, "");
    try {
      await prisma.collaborationFunding.create({
        data: {
          jurisdictionCode: row.jurisdictionCode,
          businessName: row.businessName,
          creatorSlug: row.creatorSlug,
          title: `${baseTitle.slice(0, 160 - suffix.length)}${suffix}`,
          currency: fx.currency,
          grossCents: fx.convertedMinor,
          feeCents,
          serviceLevel: row.serviceLevel,
          feeSnapshotJson: {
            ruleId: quote?.rule?.id ?? null,
            ruleName: quote?.rule?.name ?? null,
            ruleVersion: quote?.rule?.version ?? null,
            percentBps: quote?.rule?.percentBps ?? null,
            fixedCents: quote?.rule?.fixedCents ?? null,
            feeCents,
            explanation: quote?.explanation ?? "Fee rules were unavailable.",
            capturedAt: now.toISOString(),
          },
          fxSnapshotJson: fxRecord(fx),
          shareSnapshotJson: shareSnapshot,
          status: "awaiting_provider",
          providerCode: row.providerCode,
          attributionLabel: row.attributionLabel,
          repeatOfId: row.repeatOfId,
          changeOrderLimit,
          scheduleId: row.scheduleId,
          scheduleKind: "recurring",
          trancheIndex: nextIndex,
          trancheCount: row.trancheCount,
          intervalDays: row.intervalDays,
          milestones: {
            create: templates.map((template, index) => ({
              title: template.title,
              amountCents: milestoneAmounts[index],
              sortOrder: template.sortOrder,
              status: "pending",
              reviewWindowHours: windowHours,
              revisionLimit,
            })),
          },
        },
      });
    } catch (error) {
      if (!isUnique(error)) throw error;
    }
  }
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

export async function requestChangeOrder(input: { fundingId: string; grossCents: number; note: string }) {
  const note = input.note.trim().slice(0, 500);
  if (note.length < 8) return { ok: false as const, error: "Describe what changed. Nothing was changed." };
  if (!Number.isInteger(input.grossCents) || input.grossCents <= 0) {
    return { ok: false as const, error: "Enter a gross amount greater than zero. Nothing was changed." };
  }
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: input.fundingId },
    include: {
      milestones: { orderBy: { sortOrder: "asc" } },
      entries: { where: { kind: "hold" }, take: 1 },
    },
  });
  if (!funding) return { ok: false as const, error: "Prefund not found." };
  const settings = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } });
  const enabled = changeOrdersForTests ?? settings?.changeOrdersEnabled ?? true;
  const gate = canRequestChangeOrder({
    enabled,
    fundingStatus: funding.status,
    changeOrderCount: funding.changeOrderCount,
    changeOrderLimit: funding.changeOrderLimit,
    hasHold: funding.entries.length > 0,
  });
  if (!gate.ok) return gate;
  const snapshot = readFxSnapshot(funding.fxSnapshotJson);
  const currentUsd = snapshot?.usdCents ?? (funding.currency === "USD" ? funding.grossCents : 0);
  if (currentUsd === input.grossCents) {
    return { ok: false as const, error: "Enter a different gross. Nothing was changed." };
  }
  const cap = grossWithinCap({ grossCents: input.grossCents, maxGrossCents: activeGrossCap(settings?.maxGrossCents) });
  if (!cap.ok) return { ok: false as const, error: "That gross is above the admin cap. Nothing was changed." };
  const currency = (funding.currency || "USD").toUpperCase();
  if (currency !== "USD") {
    const allowed = await prisma.fxRate.findUnique({ where: { currency } });
    if (!allowed?.active) {
      return { ok: false as const, error: `No Wise currency is saved for ${currency}. Nothing was changed.` };
    }
  }
  const jurisdiction = await prisma.collaborationJurisdiction.findUnique({ where: { code: funding.jurisdictionCode } });
  const fx = await quoteWiseUserRate({
    currency,
    usdCents: input.grossCents,
    minorDigits: jurisdiction?.minorDigits ?? 2,
  });
  if (!fx.ok) return { ok: false as const, error: fx.error.replaceAll("Nothing was funded.", "Nothing was changed.") };
  const pending = funding.milestones.every((milestone) => milestone.status === "pending" && milestone.refundedCents === 0);
  const shares = sharesFromAmounts(funding.milestones.map((milestone) => milestone.amountCents));
  const milestoneAmounts = pending && shares ? splitGross(fx.convertedMinor, shares) : null;
  if (!milestoneAmounts) return { ok: false as const, error: "This prefund cannot be changed. Nothing was changed." };
  const quote = await resolveFee({
    jurisdiction: funding.jurisdictionCode,
    serviceLevel: funding.serviceLevel,
    grossValueCents: input.grossCents,
  }).catch(() => null);
  const feeCents = convertFee(quote?.feeCents ?? 0, fx);
  const nextFee = {
    ruleId: quote?.rule?.id ?? null,
    ruleName: quote?.rule?.name ?? null,
    ruleVersion: quote?.rule?.version ?? null,
    percentBps: quote?.rule?.percentBps ?? null,
    fixedCents: quote?.rule?.fixedCents ?? null,
    feeCents,
    explanation: quote?.explanation ?? "Fee rules were unavailable.",
    capturedAt: new Date().toISOString(),
  };
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.collaborationFunding.updateMany({
        where: { id: funding.id, status: "awaiting_provider", changeOrderCount: funding.changeOrderCount },
        data: {
          grossCents: fx.convertedMinor,
          feeCents,
          feeSnapshotJson: nextFee,
          fxSnapshotJson: fxRecord(fx),
          changeOrderCount: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new Error("This prefund has used its change orders. Nothing was changed.");
      for (let index = 0; index < funding.milestones.length; index += 1) {
        await tx.fundingMilestone.update({
          where: { id: funding.milestones[index].id },
          data: { amountCents: milestoneAmounts[index] },
        });
      }
      await tx.fundingChangeOrder.create({
        data: {
          fundingId: funding.id,
          note,
          previousGrossCents: funding.grossCents,
          nextGrossCents: fx.convertedMinor,
          previousUsdCents: currentUsd,
          nextUsdCents: input.grossCents,
          previousFeeSnapshotJson: funding.feeSnapshotJson ?? {},
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Nothing was changed")) return { ok: false as const, error: message };
    throw error;
  }
  return { ok: true as const };
}

export async function ledgerMonthlyReport() {
  const entries = await prisma.ledgerEntry.findMany({
    select: { kind: true, amountCents: true, createdAt: true, funding: { select: { currency: true } } },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  return summarizeLedgerReport(
    entries.map((entry) => ({
      currency: entry.funding.currency,
      kind: entry.kind,
      amountCents: entry.amountCents,
      createdAt: entry.createdAt,
    })),
  );
}

export async function ledgerTotals() {
  const fundings = await prisma.collaborationFunding.findMany({
    select: {
      currency: true,
      grossCents: true,
      entries: { select: { kind: true, amountCents: true } },
    },
  });
  return summarizeLedger(fundings);
}

export async function listFundings() {
  await sweepAutoApprovals();
  await sweepDueRecurrences();
  const rows = await prisma.collaborationFunding.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      milestones: { orderBy: { sortOrder: "asc" } },
      entries: { orderBy: { createdAt: "asc" } },
      disputes: {
        where: { status: { in: ["open", "under_review", "refund_requested"] } },
        select: {
          id: true,
          milestoneId: true,
          status: true,
          evidenceLimit: true,
          notes: { orderBy: { createdAt: "asc" }, select: { id: true, author: true, body: true, url: true } },
        },
      },
      repeatOf: { select: { id: true, title: true } },
      changeOrders: {
        orderBy: { createdAt: "desc" },
        select: { id: true, note: true, previousUsdCents: true, nextUsdCents: true },
      },
    },
    take: 50,
  });
  return rows.map(presentFunding);
}

export async function listFundingsForCreator(creatorSlug: string) {
  await sweepAutoApprovals();
  await sweepDueRecurrences();
  const rows = await prisma.collaborationFunding.findMany({
    where: { creatorSlug },
    orderBy: { createdAt: "desc" },
    include: {
      milestones: { orderBy: { sortOrder: "asc" } },
      entries: true,
      disputes: {
        where: { status: { in: ["open", "under_review", "refund_requested"] } },
        select: {
          id: true,
          milestoneId: true,
          status: true,
          evidenceLimit: true,
          notes: { orderBy: { createdAt: "asc" }, select: { id: true, author: true, body: true, url: true } },
        },
      },
      repeatOf: { select: { id: true, title: true } },
      changeOrders: {
        orderBy: { createdAt: "desc" },
        select: { id: true, note: true, previousUsdCents: true, nextUsdCents: true },
      },
    },
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
  fxSnapshotJson: unknown;
  shareSnapshotJson: unknown;
  status: string;
  providerCode: string;
  milestones: {
    id: string;
    title: string;
    amountCents: number;
    refundedCents: number;
    status: string;
    sortOrder: number;
    autoApproveAt: Date | null;
    revisionLimit: number;
    revisionCount: number;
    revisionNote: string;
  }[];
  entries: { kind: string; amountCents: number }[];
  disputes?: {
    id: string;
    milestoneId: string | null;
    status: string;
    evidenceLimit: number;
    notes: { id: string; author: string; body: string; url: string }[];
  }[];
  attributionLabel: string;
  repeatOf: { id: string; title: string } | null;
  changeOrderLimit: number;
  changeOrderCount: number;
  changeOrders: { id: string; note: string; previousUsdCents: number; nextUsdCents: number }[];
  scheduleKind: string;
  trancheIndex: number;
  trancheCount: number;
  intervalDays: number;
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

export async function requestFundingRevision(fundingId: string, milestoneId: string, note: string) {
  const text = note.trim().slice(0, 500);
  if (text.length < 8) return { ok: false as const, error: "Say what should change." };
  const milestone = await prisma.fundingMilestone.findFirst({
    where: { id: milestoneId, fundingId },
    include: { funding: true },
  });
  if (!milestone) return { ok: false as const, error: "Milestone not found." };
  const disputeOpen = await milestoneHasOpenDispute(fundingId, milestoneId);
  const gate = requestRevision({
    fundingStatus: milestone.funding.status,
    milestoneStatus: milestone.status,
    revisionCount: milestone.revisionCount,
    revisionLimit: milestone.revisionLimit,
    disputeOpen,
  });
  if (!gate.ok) return gate;
  const updated = await prisma.fundingMilestone.updateMany({
    where: { id: milestone.id, status: "submitted", revisionCount: milestone.revisionCount },
    data: {
      status: "pending",
      revisionCount: gate.revisionCount,
      revisionNote: text,
      submittedAt: null,
      autoApproveAt: null,
    },
  });
  if (updated.count !== 1) return { ok: false as const, error: "That milestone cannot take this step." };
  await prisma.auditLog
    .create({
      data: {
        actor: "business",
        action: "milestone_revision_requested",
        objectType: "FundingMilestone",
        objectId: milestone.id,
        after: { fundingId, revisionCount: gate.revisionCount, revisionLimit: milestone.revisionLimit },
      },
    })
    .catch(() => undefined);
  return { ok: true as const, revisionCount: gate.revisionCount };
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
  const left = milestone ? releasableCents(milestone.amountCents, milestone.refundedCents) : 0;
  const refundRequest =
    milestone && input.eventType === "payout.refunded"
      ? await prisma.milestoneDispute.findFirst({
          where: { fundingId: funding.id, milestoneId: milestone.id, status: "refund_requested" },
          select: { requestedRefundCents: true },
        })
      : null;
  const expectedCents =
    input.eventType === "funding.held" || input.eventType === "funding.failed"
      ? funding.grossCents
      : input.eventType === "payout.released"
        ? left > 0
          ? left
          : -1
        : (milestone?.amountCents ?? -1);
  const disposition = marketplaceDisposition({
    eventType: input.eventType,
    fundingStatus: funding.status,
    amountCents: input.amountCents,
    expectedCents,
    heldCents: prior.heldCents,
    milestoneStatus: milestone?.status,
    disputeOpen,
    requestedRefundCents: refundRequest ? (refundRequest.requestedRefundCents ?? -1) : null,
    milestoneRemainingCents: milestone && input.eventType === "payout.refunded" ? left : null,
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
        if (left <= 0 || held.heldCents < left) throw new LedgerReject("The provider is not holding enough.");
        const released = await tx.fundingMilestone.updateMany({
          where: { id: milestone.id, status: "approved", refundedCents: milestone.refundedCents },
          data: { status: "released" },
        });
        if (released.count !== 1) throw new LedgerReject("Milestone is not approved.");
        await tx.ledgerEntry.create({
          data: {
            fundingId: funding.id,
            milestoneId: milestone.id,
            kind: "release",
            amountCents: left,
            provider: providerKey,
            eventId,
          },
        });
        const parties = readShareSnapshot(funding.shareSnapshotJson);
        const lines = parties ? shareLines(left, parties) : null;
        if (lines) {
          for (const line of lines) {
            await tx.ledgerEntry.create({
              data: {
                fundingId: funding.id,
                milestoneId: milestone.id,
                kind: "share",
                party: line.party,
                amountCents: line.amountCents,
                provider: providerKey,
                eventId,
              },
            });
          }
        }
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
        if (milestone) {
          const nextRefunded = milestone.refundedCents + input.amountCents;
          const settles = nextRefunded >= milestone.amountCents;
          const updated = await tx.fundingMilestone.updateMany({
            where: {
              id: milestone.id,
              refundedCents: milestone.refundedCents,
              status: { not: "released" },
            },
            data: settles
              ? { status: "refunded", refundedCents: milestone.amountCents }
              : { refundedCents: nextRefunded },
          });
          if (updated.count !== 1) throw new LedgerReject("That milestone cannot take this refund.");
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

export async function marketplaceWebhookSecret(code = PROVIDER_CODE) {
  await ensureMarketplaceDefaults();
  const provider = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: "marketplace", code } },
  });
  if (!provider) return { error: "missing" as const };
  if (!provider.enabled || !provider.webhookCipher) return { error: "not_ready" as const };
  const { decryptSecret } = await import("@/lib/provider-secrets");
  const secret = decryptSecret(provider.webhookCipher);
  if (!secret) return { error: "not_ready" as const };
  return { code: provider.code, secret };
}
