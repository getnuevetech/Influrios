import { prisma } from "@/lib/db";
import {
  buildProviderStagingTrace,
  DEFAULT_DEFERRED_FUNDING,
  type DeferredFundingSwitches,
  type LaunchApprovals,
  type StagingTrace,
} from "@/lib/payment-engine";

const GATE_ID = "default";

export type LaunchGateRecord = LaunchApprovals &
  DeferredFundingSwitches & {
    providerTraceReady: boolean;
    payoutTrace: StagingTrace | null;
    refundTrace: StagingTrace | null;
    sandboxTestEmails: string[];
  };

/** Lower-case, de-duplicated, valid-looking emails from a comma, space or line separated list. */
export function parseTestEmails(raw: string | null | undefined): string[] {
  return [
    ...new Set(
      String(raw ?? "")
        .split(/[\s,;]+/)
        .map((value) => value.trim().toLowerCase())
        .filter((value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)),
    ),
  ].slice(0, 20);
}

/**
 * Before launch, a deal may be funded only when Stripe uses test keys (no real money), the deal
 * collects through Stripe, and every party is on the admin's test-account list.
 */
export function sandboxTestFundingAllowed(input: {
  stripeMode: string;
  collectionProviderCode: string | null | undefined;
  partyEmails: string[];
  testEmails: string[];
}) {
  if (input.stripeMode !== "sandbox") return false;
  if (!(input.collectionProviderCode ?? "").toLowerCase().startsWith("stripe")) return false;
  if (input.testEmails.length === 0 || input.partyEmails.length === 0) return false;
  const allowed = new Set(input.testEmails.map((email) => email.toLowerCase()));
  return input.partyEmails.every((email) => allowed.has(email.trim().toLowerCase()));
}

function readTrace(value: unknown): StagingTrace | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<StagingTrace>;
  if (row.reconciled !== true || !Array.isArray(row.steps)) return null;
  return row as StagingTrace;
}

export async function getLaunchGate(): Promise<LaunchGateRecord> {
  const row = await prisma.collaborationLaunchGate.upsert({
    where: { id: GATE_ID },
    update: {},
    create: { id: GATE_ID },
  });
  return {
    feeSchedulesApproved: row.feeSchedulesApproved,
    taxTreatmentApproved: row.taxTreatmentApproved,
    earningRefundPolicyApproved: row.earningRefundPolicyApproved,
    providerRouteApproved: row.providerRouteApproved,
    crossBorderFundingEnabled: row.crossBorderFundingEnabled,
    teamFundingEnabled: row.teamFundingEnabled,
    automaticMilestoneApprovalEnabled: row.automaticMilestoneApprovalEnabled,
    automaticProviderSwitchingEnabled: row.automaticProviderSwitchingEnabled,
    allInBudgetEntryEnabled: row.allInBudgetEntryEnabled,
    automaticReleaseApprovalEnabled: row.automaticReleaseApprovalEnabled,
    automaticProviderReleaseEnabled: row.automaticProviderReleaseEnabled,
    providerTraceReady: row.providerTraceReady,
    payoutTrace: readTrace(row.payoutTraceJson),
    refundTrace: readTrace(row.refundTraceJson),
    sandboxTestEmails: parseTestEmails(row.sandboxTestEmails),
  };
}

export async function saveSandboxTestEmails(input: { actor: string; reason: string; emails: string }) {
  const reason = input.reason.trim();
  if (reason.length < 8) throw new Error("Add a reason of at least 8 characters. Nothing was changed.");
  const before = await getLaunchGate();
  const emails = parseTestEmails(input.emails);
  await prisma.collaborationLaunchGate.update({ where: { id: GATE_ID }, data: { sandboxTestEmails: emails.join(",") } });
  await prisma.auditLog.create({
    data: {
      actor: input.actor.slice(0, 120),
      action: "launch_gate.sandbox_test_accounts",
      objectType: "CollaborationLaunchGate",
      objectId: GATE_ID,
      before: { sandboxTestEmails: before.sandboxTestEmails },
      after: { sandboxTestEmails: emails, reason },
    },
  });
  return emails;
}

export async function saveLaunchApprovals(input: {
  actor: string;
  reason: string;
  approvals: LaunchApprovals;
}) {
  const reason = input.reason.trim();
  if (reason.length < 8) throw new Error("Add a reason of at least 8 characters. Nothing was changed.");
  const before = await getLaunchGate();
  const row = await prisma.collaborationLaunchGate.update({
    where: { id: GATE_ID },
    data: input.approvals,
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor.slice(0, 120),
      action: "launch_gate.approvals",
      objectType: "CollaborationLaunchGate",
      objectId: GATE_ID,
      before: {
        feeSchedulesApproved: before.feeSchedulesApproved,
        taxTreatmentApproved: before.taxTreatmentApproved,
        earningRefundPolicyApproved: before.earningRefundPolicyApproved,
        providerRouteApproved: before.providerRouteApproved,
      },
      after: {
        ...input.approvals,
        reason,
      },
    },
  });
  return row;
}

export async function saveDeferredFundingSwitches(input: {
  actor: string;
  reason: string;
  switches: DeferredFundingSwitches;
}) {
  const reason = input.reason.trim();
  if (reason.length < 8) throw new Error("Add a reason of at least 8 characters. Nothing was changed.");
  const before = await getLaunchGate().catch(() => ({ ...DEFAULT_DEFERRED_FUNDING }));
  await getLaunchGate();
  await prisma.collaborationLaunchGate.update({
    where: { id: GATE_ID },
    data: input.switches,
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor.slice(0, 120),
      action: "launch_gate.deferred_funding",
      objectType: "CollaborationLaunchGate",
      objectId: GATE_ID,
      before: {
        crossBorderFundingEnabled: "crossBorderFundingEnabled" in before ? before.crossBorderFundingEnabled : false,
        teamFundingEnabled: "teamFundingEnabled" in before ? before.teamFundingEnabled : false,
        automaticMilestoneApprovalEnabled:
          "automaticMilestoneApprovalEnabled" in before ? before.automaticMilestoneApprovalEnabled : false,
        automaticProviderSwitchingEnabled:
          "automaticProviderSwitchingEnabled" in before ? before.automaticProviderSwitchingEnabled : false,
        allInBudgetEntryEnabled: "allInBudgetEntryEnabled" in before ? before.allInBudgetEntryEnabled : false,
        automaticReleaseApprovalEnabled:
          "automaticReleaseApprovalEnabled" in before ? before.automaticReleaseApprovalEnabled : false,
        automaticProviderReleaseEnabled:
          "automaticProviderReleaseEnabled" in before ? before.automaticProviderReleaseEnabled : false,
      },
      after: { ...input.switches, reason },
    },
  });
}

export async function saveReleaseAutomation(input: {
  actor: string;
  automaticReleaseApprovalEnabled: boolean;
  automaticProviderReleaseEnabled: boolean;
}) {
  const before = await getLaunchGate();
  await prisma.collaborationLaunchGate.update({
    where: { id: GATE_ID },
    data: {
      automaticReleaseApprovalEnabled: input.automaticReleaseApprovalEnabled,
      automaticProviderReleaseEnabled: input.automaticProviderReleaseEnabled,
    },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor.slice(0, 120),
      action: "launch_gate.release_automation",
      objectType: "CollaborationLaunchGate",
      objectId: GATE_ID,
      before: {
        automaticReleaseApprovalEnabled: before.automaticReleaseApprovalEnabled,
        automaticProviderReleaseEnabled: before.automaticProviderReleaseEnabled,
      },
      after: {
        automaticReleaseApprovalEnabled: input.automaticReleaseApprovalEnabled,
        automaticProviderReleaseEnabled: input.automaticProviderReleaseEnabled,
      },
    },
  });
}

export async function recordProviderStagingTraces(input: {
  actor: string;
  currency: string;
  businessPaysCents: number;
  influencerReceivesCents: number;
  platformFeesTotalCents: number;
  taxCents: number;
  collectionRef: string;
  holdingRef: string;
  releaseRef: string;
  payoutRef: string;
  refundRef: string;
}) {
  const shared = {
    currency: input.currency,
    businessPaysCents: input.businessPaysCents,
    influencerReceivesCents: input.influencerReceivesCents,
    platformFeesTotalCents: input.platformFeesTotalCents,
    taxCents: input.taxCents,
    collectionRef: input.collectionRef,
    holdingRef: input.holdingRef,
    releaseRef: input.releaseRef,
    payoutRef: input.payoutRef,
    holdingAvailable: true,
    beneficiaryConfirmed: true,
  };
  const payout = buildProviderStagingTrace({ ...shared, scenario: "payout" });
  if ("ok" in payout) throw new Error(payout.error);
  const refund = buildProviderStagingTrace({
    ...shared,
    scenario: "refund",
    refundRef: input.refundRef,
    refundConfirmed: true,
  });
  if ("ok" in refund) throw new Error(refund.error);
  await getLaunchGate();
  await prisma.collaborationLaunchGate.update({
    where: { id: GATE_ID },
    data: {
      providerTraceReady: true,
      payoutTraceJson: payout,
      refundTraceJson: refund,
    },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor.slice(0, 120),
      action: "launch_gate.trace",
      objectType: "CollaborationLaunchGate",
      objectId: GATE_ID,
      after: {
        currency: payout.currency,
        businessPaysCents: payout.businessPaysCents,
        influencerReceivesCents: payout.influencerReceivesCents,
        platformFeesTotalCents: payout.platformFeesTotalCents,
        taxCents: payout.taxCents,
      },
    },
  });
  return { payout, refund };
}
