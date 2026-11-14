import { prisma } from "@/lib/db";
import { applyMarketplaceEvent } from "@/lib/marketplace-ledger";
import { readSignedDealMoney } from "@/lib/payment-engine";
import { collectionInstructionAmount } from "@/lib/provider-outbox";
import {
  openStripeFundingCheckout,
  expireStripeCheckoutSession,
  readStripeCheckoutSession,
  stripeCredentials,
  stripeCredentialError,
  type StripeCheckoutPayment,
} from "@/lib/stripe-admin";

export const MANUAL_DEPOSIT_KEY = "marketplace.manual_deposit";

export const DEPOSIT_METHODS = ["card", "ach_online", "ach_wire", "check"] as const;
export type DepositMethod = (typeof DEPOSIT_METHODS)[number];

export const DEPOSIT_METHOD_LABELS: Record<DepositMethod, string> = {
  card: "Credit or debit card",
  ach_online: "Online ACH",
  ach_wire: "ACH wire, bank to bank",
  check: "Check",
};

export type ManualDepositInstructions = {
  bankName: string;
  accountName: string;
  routingNumber: string;
  accountNumber: string;
  checkPayableTo: string;
  checkMailingAddress: string;
};

export function parseDepositMethod(value: string): DepositMethod | null {
  const method = value.trim().toLowerCase();
  return DEPOSIT_METHODS.includes(method as DepositMethod) ? (method as DepositMethod) : null;
}

export function depositMethodKind(method: DepositMethod): "gateway" | "manual" {
  return method === "card" || method === "ach_online" ? "gateway" : "manual";
}

export function readManualDepositInstructions(value: unknown): ManualDepositInstructions {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const text = (key: keyof ManualDepositInstructions) =>
    typeof row[key] === "string" ? row[key].trim().slice(0, 160) : "";
  return {
    bankName: text("bankName"),
    accountName: text("accountName"),
    routingNumber: text("routingNumber"),
    accountNumber: text("accountNumber"),
    checkPayableTo: text("checkPayableTo"),
    checkMailingAddress: text("checkMailingAddress"),
  };
}

export function manualMethodReady(
  method: "ach_wire" | "check",
  instructions: ManualDepositInstructions,
): { ok: true } | { ok: false; error: string } {
  if (method === "ach_wire") {
    if (!instructions.bankName || !instructions.accountName || !instructions.routingNumber || !instructions.accountNumber) {
      return { ok: false, error: "Finance has not saved the ACH wire bank details. Nothing was recorded." };
    }
    return { ok: true };
  }
  if (!instructions.checkPayableTo || !instructions.checkMailingAddress) {
    return { ok: false, error: "Finance has not saved the check payee and mailing address. Nothing was recorded." };
  }
  return { ok: true };
}

/** Recording a manual deposit does not fund the agreement. */
export function manualDepositFundsAgreement(status: string) {
  return status === "confirmed";
}

export async function getManualDepositInstructions() {
  const row = await prisma.platformSetting.findUnique({ where: { key: MANUAL_DEPOSIT_KEY } }).catch(() => null);
  return readManualDepositInstructions(row?.value);
}

export async function saveManualDepositInstructions(input: ManualDepositInstructions) {
  const value = readManualDepositInstructions(input);
  await prisma.platformSetting.upsert({
    where: { key: MANUAL_DEPOSIT_KEY },
    create: { key: MANUAL_DEPOSIT_KEY, value },
    update: { value },
  });
  return value;
}

function payerEmail(value: string | undefined) {
  const email = value?.trim().slice(0, 160) ?? "";
  return email.includes("@") ? email : "";
}

export async function startFundingDeposit(input: {
  fundingId: string;
  method: DepositMethod;
  email?: string;
  note?: string;
  origin: string;
}): Promise<
  | { ok: true; kind: "gateway"; url: string; depositId: string }
  | { ok: true; kind: "manual"; depositId: string; instructions: ManualDepositInstructions }
  | { ok: false; error: string }
> {
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: input.fundingId.trim() },
    select: { id: true, status: true, grossCents: true, currency: true, title: true, feeSnapshotJson: true },
  });
  if (!funding || funding.status !== "awaiting_provider") {
    return { ok: false, error: "This funding is not waiting for a deposit. Nothing was charged." };
  }
  const { paymentChargeBlock, paymentChargeKeyForDeposit } = await import("@/lib/payment-charge-switches");
  const chargeKey = paymentChargeKeyForDeposit(input.method);
  if (chargeKey) {
    const charge = await paymentChargeBlock(chargeKey);
    if (!charge.ok) return charge;
  }
  const plan = (funding.feeSnapshotJson as { financialPlan?: unknown } | null)?.financialPlan;
  const signed = readSignedDealMoney(plan);
  const planned = collectionInstructionAmount({
    fundingGrossCents: funding.grossCents,
    signedBusinessPaysCents: signed?.businessPaysCents ?? null,
  });
  if (!planned.ok) return { ok: false, error: `${planned.error} Nothing was charged.` };
  const note = input.note?.trim().slice(0, 500) ?? "";
  if (input.method === "ach_wire" || input.method === "check") {
    const instructions = await getManualDepositInstructions();
    const ready = manualMethodReady(input.method, instructions);
    if (!ready.ok) return ready;
    const existing = await prisma.fundingDeposit.findFirst({
      where: { fundingId: funding.id, method: input.method, status: "manual_pending" },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return {
        ok: true,
        kind: "manual",
        depositId: existing.id,
        instructions: readManualDepositInstructions(existing.instructionsJson),
      };
    }
    const created = await prisma.fundingDeposit.create({
      data: {
        fundingId: funding.id,
        method: input.method,
        status: "manual_pending",
        amountCents: planned.amountCents,
        currency: funding.currency,
        payerNote: note,
        instructionsJson: instructions,
      },
    });
    await prisma.auditLog
      .create({
        data: {
          actor: "business",
          action: "funding.deposit.recorded",
          objectType: "FundingDeposit",
          objectId: created.id,
          after: { fundingId: funding.id, method: input.method, amountCents: planned.amountCents, status: "manual_pending" },
        },
      })
      .catch(() => undefined);
    return { ok: true, kind: "manual", depositId: created.id, instructions };
  }
  if (input.method === "ach_online" && funding.currency.trim().toUpperCase() !== "USD") {
    return { ok: false, error: "Online ACH collects USD. Nothing was charged." };
  }
  const openDeposit = await prisma.fundingDeposit.findFirst({
    where: { fundingId: funding.id, method: input.method, status: "gateway_opened" },
    orderBy: { createdAt: "desc" },
  });
  if (openDeposit?.reference) {
    const creds = await stripeCredentials();
    if (!creds.ok) return { ok: false, error: stripeCredentialError(creds.reason, "charged") };
    const session = await readStripeCheckoutSession(creds.secret, openDeposit.reference);
    if (
      session &&
      gatewaySessionConfirmsDeposit({
        session,
        depositId: openDeposit.id,
        fundingId: funding.id,
        amountCents: planned.amountCents,
        currency: funding.currency,
      })
    ) {
      const confirmed = await confirmGatewayDeposit({
        depositId: openDeposit.id,
        fundingId: funding.id,
        checkoutSessionId: session.id,
        paymentStatus: session.paymentStatus,
        amountCents: session.amountTotal,
        currency: session.currency,
      });
      if (!confirmed.ok) return confirmed;
      return { ok: false, error: "This deposit is already paid. Nothing was charged." };
    }
    if (
      session?.url &&
      session.paymentStatus === "unpaid" &&
      session.amountTotal === planned.amountCents &&
      session.currency === funding.currency.trim().toUpperCase()
    ) {
      return { ok: true, kind: "gateway", url: session.url, depositId: openDeposit.id };
    }
    await prisma.fundingDeposit.update({ where: { id: openDeposit.id }, data: { status: "failed" } }).catch(() => undefined);
  }
  const { collaborationCollectionGate } = await import("@/lib/payment-account-routing");
  const collection = collaborationCollectionGate({ allocatedFunds: false, treasury: false });
  if (!collection.ok) return collection;
  const creds = await stripeCredentials();
  if (!creds.ok) return { ok: false, error: stripeCredentialError(creds.reason, "charged") };
  const deposit = await prisma.fundingDeposit.create({
    data: {
      fundingId: funding.id,
      method: input.method,
      status: "gateway_opened",
      amountCents: planned.amountCents,
      currency: funding.currency,
      payerNote: note,
    },
  });
  const origin = input.origin.replace(/\/$/, "");
  const opened = await openStripeFundingCheckout({
    secret: creds.secret,
    mode: creds.mode,
    amountCents: planned.amountCents,
    currency: funding.currency,
    name: funding.title || "Collaboration deposit",
    successUrl: `${origin}/payments/checkout/${funding.id}?returned=1`,
    cancelUrl: `${origin}/payments/checkout/${funding.id}?cancelled=1`,
    customerEmail: payerEmail(input.email) || undefined,
    paymentMethod: input.method === "card" ? "card" : "us_bank_account",
    metadata: {
      purpose: "funding_deposit",
      depositId: deposit.id,
      fundingId: funding.id,
    },
  });
  if (!opened.ok) {
    await prisma.fundingDeposit.update({ where: { id: deposit.id }, data: { status: "failed" } }).catch(() => undefined);
    return opened;
  }
  await prisma.fundingDeposit.update({ where: { id: deposit.id }, data: { reference: opened.id } });
  return { ok: true, kind: "gateway", url: opened.url, depositId: deposit.id };
}

async function markDepositConfirmed(depositId: string, actor: string, reference: string) {
  await prisma.fundingDeposit.update({
    where: { id: depositId },
    data: {
      status: "confirmed",
      confirmedBy: actor.slice(0, 160),
      confirmedAt: new Date(),
      ...(reference ? { reference } : {}),
    },
  });
}

/** Finance confirmation posts the hold. The contract document status stays signed. */
export async function confirmManualDeposit(input: { depositId: string; actor: string }) {
  const deposit = await prisma.fundingDeposit.findUnique({ where: { id: input.depositId.trim() } });
  if (!deposit) return { ok: false as const, error: "That deposit was not found. Nothing was changed." };
  if (deposit.method !== "ach_wire" && deposit.method !== "check") {
    return { ok: false as const, error: "Card and online ACH wait for the payment provider. Nothing was changed." };
  }
  if (deposit.status === "confirmed") return { ok: true as const, fundingId: deposit.fundingId };
  if (deposit.status !== "manual_pending") {
    return { ok: false as const, error: "This deposit is not waiting for finance. Nothing was changed." };
  }
  const held = await applyMarketplaceEvent({
    provider: "finance",
    eventId: `manual-deposit:${deposit.id}`,
    eventType: "funding.held",
    fundingId: deposit.fundingId,
    amountCents: deposit.amountCents,
    currency: deposit.currency,
  });
  if (!held.applied) {
    return {
      ok: false as const,
      error:
        held.result === "duplicate"
          ? "That confirmation was already recorded."
          : "This deposit was not confirmed. The funding status was not changed.",
    };
  }
  await markDepositConfirmed(deposit.id, input.actor, deposit.reference);
  await prisma.auditLog
    .create({
      data: {
        actor: input.actor.slice(0, 160),
        action: "funding.deposit.confirmed",
        objectType: "FundingDeposit",
        objectId: deposit.id,
        after: {
          fundingId: deposit.fundingId,
          method: deposit.method,
          amountCents: deposit.amountCents,
          routeEvidence: "manual_finance_confirmation",
          allocatedFunds: false,
        },
      },
    })
    .catch(() => undefined);
  return { ok: true as const, fundingId: deposit.fundingId };
}

/** A paid Stripe session for this deposit is the confirmation. The return URL is not. */
export function gatewaySessionConfirmsDeposit(input: {
  session: StripeCheckoutPayment | null;
  depositId: string;
  fundingId: string;
  amountCents: number;
  currency?: string;
}) {
  const session = input.session;
  if (!session || session.paymentStatus !== "paid") return false;
  if (session.amountTotal != null && session.amountTotal !== input.amountCents) return false;
  if (input.currency && session.currency && session.currency !== input.currency.trim().toUpperCase()) return false;
  const depositId = session.metadata.depositId?.trim() ?? "";
  const fundingId = session.metadata.fundingId?.trim() ?? "";
  if (depositId && depositId !== input.depositId) return false;
  if (fundingId && fundingId !== input.fundingId) return false;
  return true;
}

/** Delayed ACH stays open until Stripe reports success or failure. A missing currency does not confirm. */
export function fundingDepositEventDecision(input: {
  eventType: string;
  paymentStatus: string | null | undefined;
  amountTotal: number | null;
  currency: string | null | undefined;
  sessionId: string;
  depositReference: string;
  depositAmountCents: number;
  depositCurrency: string;
}): "confirm" | "fail" | "wait" | "mismatch" {
  const currency = input.currency?.trim().toUpperCase() ?? "";
  const expectedCurrency = input.depositCurrency.trim().toUpperCase();
  if (
    !input.sessionId ||
    input.sessionId !== input.depositReference ||
    input.amountTotal == null ||
    input.amountTotal !== input.depositAmountCents ||
    !/^[A-Z]{3}$/.test(currency) ||
    currency !== expectedCurrency
  ) {
    return "mismatch";
  }
  if (input.eventType === "checkout.session.async_payment_failed") return "fail";
  if (input.paymentStatus === "paid") return "confirm";
  if (input.eventType === "checkout.session.completed" && input.paymentStatus === "unpaid") return "wait";
  return "wait";
}

/**
 * Before funding, a cancellation expires the checkout only after the charge result is known.
 * A confirmed or unknown charge stays open.
 */
export function prefundingCancellationDecision(input: {
  fundingStatus: string;
  deposits: { id: string; status: string; method: string; charge: "paid" | "unpaid" | "unknown" | null }[];
}): { ok: true; expireIds: string[] } | { ok: false; error: string } {
  if (input.fundingStatus !== "awaiting_provider") {
    return { ok: false, error: "This funding is no longer waiting for a charge. Nothing was cancelled." };
  }
  const expireIds: string[] = [];
  for (const deposit of input.deposits) {
    if (deposit.status === "confirmed" || deposit.charge === "paid") {
      return { ok: false, error: "A charge is already confirmed. Wait for the funding hold. Nothing was cancelled." };
    }
    if (deposit.status === "failed" || deposit.status === "expired") continue;
    const gateway = deposit.method === "card" || deposit.method === "ach_online";
    if (deposit.status === "gateway_opened" && gateway) {
      if (deposit.charge !== "unpaid") {
        return { ok: false, error: "A checkout result is still unknown. Nothing was cancelled." };
      }
      expireIds.push(deposit.id);
      continue;
    }
    if (deposit.status === "manual_pending" || deposit.status === "gateway_opened") expireIds.push(deposit.id);
  }
  return { ok: true, expireIds };
}

/** Cancels an unfunded prefund after the open charge result is known. */
export async function cancelUnfundedPrefund(input: { fundingId: string; actor: string }) {
  const { paymentChargeBlock } = await import("@/lib/payment-charge-switches");
  const charge = await paymentChargeBlock("prefund_cancel");
  if (!charge.ok) return charge;
  const fundingId = input.fundingId.trim();
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: fundingId },
    include: { deposits: true },
  });
  if (!funding) return { ok: false as const, error: "Prefund not found." };
  const creds = await stripeCredentials().catch(() => null);
  const charges = new Map<string, "paid" | "unpaid" | "unknown">();
  for (const deposit of funding.deposits) {
    if (deposit.status !== "gateway_opened") continue;
    if (deposit.method !== "card" && deposit.method !== "ach_online") continue;
    if (!creds?.ok) {
      charges.set(deposit.id, "unknown");
      continue;
    }
    const session = await readStripeCheckoutSession(creds.secret, deposit.reference);
    if (!session) charges.set(deposit.id, "unknown");
    else if (session.paymentStatus === "paid") charges.set(deposit.id, "paid");
    else if (session.paymentStatus === "unpaid") charges.set(deposit.id, "unpaid");
    else charges.set(deposit.id, "unknown");
  }
  const decision = prefundingCancellationDecision({
    fundingStatus: funding.status,
    deposits: funding.deposits.map((deposit) => ({
      id: deposit.id,
      status: deposit.status,
      method: deposit.method,
      charge: charges.get(deposit.id) ?? null,
    })),
  });
  if (!decision.ok) return decision;
  if (creds?.ok) {
    for (const deposit of funding.deposits) {
      if (!decision.expireIds.includes(deposit.id)) continue;
      if (deposit.method !== "card" && deposit.method !== "ach_online") continue;
      if (!deposit.reference) continue;
      const expired = await expireStripeCheckoutSession(creds.secret, deposit.reference);
      if (!expired) return { ok: false as const, error: "The checkout could not be expired. Nothing was cancelled." };
    }
  }
  const updated = await prisma.collaborationFunding.updateMany({
    where: { id: funding.id, status: "awaiting_provider" },
    data: { status: "cancelled" },
  });
  if (updated.count !== 1) {
    return { ok: false as const, error: "This funding is no longer waiting for a charge. Nothing was cancelled." };
  }
  if (decision.expireIds.length > 0) {
    await prisma.fundingDeposit.updateMany({
      where: { id: { in: decision.expireIds }, fundingId: funding.id, status: { in: ["gateway_opened", "manual_pending"] } },
      data: { status: "expired" },
    });
  }
  await prisma.auditLog
    .create({
      data: {
        actor: input.actor,
        action: "funding_prefund_cancelled",
        objectType: "CollaborationFunding",
        objectId: funding.id,
        after: { expireIds: decision.expireIds },
      },
    })
    .catch(() => undefined);
  return { ok: true as const };
}

/**
 * Asks Stripe about an open card or online ACH checkout and posts the hold when Stripe says paid.
 * An unpaid or missing session leaves the agreement awaiting the provider.
 */
export async function syncOpenGatewayDeposits(fundingId: string) {
  const id = fundingId.trim();
  if (!id) return false;
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!funding || funding.status !== "awaiting_provider") return false;
  const creds = await stripeCredentials().catch(() => null);
  if (!creds?.ok) return false;
  const open = await prisma.fundingDeposit.findMany({
    where: { fundingId: id, status: "gateway_opened", method: { in: ["card", "ach_online"] } },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  for (const deposit of open) {
    const session = await readStripeCheckoutSession(creds.secret, deposit.reference);
    if (
      !gatewaySessionConfirmsDeposit({
        session,
        depositId: deposit.id,
        fundingId: id,
        amountCents: deposit.amountCents,
      }) ||
      !session
    ) {
      continue;
    }
    const confirmed = await confirmGatewayDeposit({
      depositId: deposit.id,
      fundingId: id,
      checkoutSessionId: session.id,
      paymentStatus: session.paymentStatus,
    });
    if (confirmed.ok) return true;
  }
  return false;
}

/** Stripe checkout completion posts the hold. A return to the site does not. */
export async function confirmGatewayDeposit(input: {
  depositId: string;
  fundingId: string;
  checkoutSessionId: string;
  paymentStatus: string | null | undefined;
  amountCents?: number | null;
  currency?: string | null;
}) {
  if (input.paymentStatus !== "paid") {
    return { ok: false as const, error: "Stripe has not confirmed this payment. Nothing was changed." };
  }
  const deposit = await prisma.fundingDeposit.findUnique({ where: { id: input.depositId.trim() } });
  if (!deposit || deposit.fundingId !== input.fundingId.trim()) {
    return { ok: false as const, error: "That deposit was not found. Nothing was changed." };
  }
  if (deposit.reference && deposit.reference !== input.checkoutSessionId.trim()) {
    return { ok: false as const, error: "This checkout does not match the open deposit. Nothing was changed." };
  }
  if (input.amountCents != null && input.amountCents !== deposit.amountCents) {
    return { ok: false as const, error: "The paid amount does not match this deposit. Nothing was changed." };
  }
  if (input.currency != null && input.currency.trim().toUpperCase() !== deposit.currency.trim().toUpperCase()) {
    return { ok: false as const, error: "The paid currency does not match this deposit. Nothing was changed." };
  }
  if (deposit.method !== "card" && deposit.method !== "ach_online") {
    return { ok: false as const, error: "This deposit is not a gateway checkout. Nothing was changed." };
  }
  if (deposit.status === "confirmed") return { ok: true as const };
  if (deposit.status !== "gateway_opened") {
    return { ok: false as const, error: "This checkout is not open. Nothing was changed." };
  }
  const held = await applyMarketplaceEvent({
    provider: "stripe",
    eventId: input.checkoutSessionId.trim(),
    eventType: "funding.held",
    fundingId: deposit.fundingId,
    amountCents: deposit.amountCents,
    currency: deposit.currency,
  });
  if (!held.applied && held.result !== "duplicate") {
    return { ok: false as const, error: "Stripe confirmed the checkout, and the funding status was not changed." };
  }
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: deposit.fundingId },
    select: { status: true },
  });
  if (funding?.status === "awaiting_provider") {
    return { ok: false as const, error: "The deposit is still unconfirmed. Nothing was changed." };
  }
  await markDepositConfirmed(deposit.id, "stripe", input.checkoutSessionId.trim());
  return { ok: true as const };
}

/** A delayed ACH failure closes the checkout. It does not hold the agreement. */
export async function failGatewayDeposit(input: { depositId: string; fundingId: string; checkoutSessionId: string }) {
  const deposit = await prisma.fundingDeposit.findUnique({ where: { id: input.depositId.trim() } });
  if (!deposit || deposit.fundingId !== input.fundingId.trim()) {
    return { ok: false as const, error: "That deposit was not found. Nothing was changed." };
  }
  if (deposit.reference && deposit.reference !== input.checkoutSessionId.trim()) {
    return { ok: false as const, error: "This checkout does not match the open deposit. Nothing was changed." };
  }
  if (deposit.status === "failed") return { ok: true as const };
  if (deposit.status !== "gateway_opened") {
    return { ok: false as const, error: "This checkout is not open. Nothing was changed." };
  }
  await prisma.fundingDeposit.update({ where: { id: deposit.id }, data: { status: "failed" } });
  return { ok: true as const };
}
