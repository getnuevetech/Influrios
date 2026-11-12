import { prisma } from "@/lib/db";

/** On/off for each payment and charge we send. Fee rules are a separate page. */
export const PAYMENT_CHARGE_SWITCHES = [
  {
    key: "card_collection",
    group: "Charges",
    label: "Card charge",
    defaultEnabled: true,
    stopped: "Nothing was charged.",
    description: "Opens a card checkout for a collaboration deposit.",
  },
  {
    key: "ach_collection",
    group: "Charges",
    label: "Online bank debit",
    defaultEnabled: true,
    stopped: "Nothing was charged.",
    description: "Opens an online ACH checkout for a USD collaboration deposit.",
  },
  {
    key: "wire_collection",
    group: "Charges",
    label: "Wire deposit",
    defaultEnabled: true,
    stopped: "Nothing was charged.",
    description: "Records a wire instruction. Finance still confirms the arrival before the hold.",
  },
  {
    key: "check_collection",
    group: "Charges",
    label: "Check deposit",
    defaultEnabled: true,
    stopped: "Nothing was charged.",
    description: "Records a check instruction. Finance still confirms the arrival before the hold.",
  },
  {
    key: "provider_collection",
    group: "Charges",
    label: "Provider checkout",
    defaultEnabled: true,
    stopped: "Nothing was charged.",
    description: "Sends a collection instruction through the stored collection provider.",
  },
  {
    key: "recurring_collection",
    group: "Charges",
    label: "Recurring tranche",
    defaultEnabled: true,
    stopped: "Nothing was charged.",
    description: "Opens the next tranche of a recurring collaboration. Tranches already open stay as they are.",
  },
  {
    key: "milestone_payout",
    group: "Payments",
    label: "Milestone payout",
    defaultEnabled: true,
    stopped: "Nothing was sent.",
    description: "Sends a milestone payout instruction to the provider.",
  },
  {
    key: "payout_retry",
    group: "Payments",
    label: "Payout retry",
    defaultEnabled: true,
    stopped: "Nothing was sent.",
    description: "Retries a failed payout or sends again after a returned payout.",
  },
  {
    key: "fee_settlement",
    group: "Payments",
    label: "Fee settlement",
    defaultEnabled: true,
    stopped: "Nothing was settled.",
    description: "Moves an eligible platform fee from holding to operating funds.",
  },
  {
    key: "change_order",
    group: "Payments",
    label: "Change order",
    defaultEnabled: true,
    stopped: "Nothing was changed.",
    description: "Changes the gross before the provider confirms the hold. Marketplace settings can also turn change orders off.",
  },
  {
    key: "cancellation_refund",
    group: "Refunds",
    label: "Cancellation refund",
    defaultEnabled: true,
    stopped: "Nothing was refunded.",
    description: "Sends the refund on an accepted cancellation settlement. A review proposal can still be stored.",
  },
  {
    key: "dispute_refund",
    group: "Refunds",
    label: "Dispute refund",
    defaultEnabled: true,
    stopped: "Nothing was refunded.",
    description: "Refunds a milestone after a dispute decision.",
  },
  {
    key: "partial_refund",
    group: "Refunds",
    label: "Partial refund",
    defaultEnabled: true,
    stopped: "Nothing was refunded.",
    description: "Refunds part of a milestone after a dispute. Marketplace settings can also turn partial refunds off.",
  },
  {
    key: "prefund_cancel",
    group: "Refunds",
    label: "Cancel an unpaid checkout",
    defaultEnabled: true,
    stopped: "Nothing was cancelled.",
    description: "Cancels a prefund before the hold. A paid or unknown charge still stays open.",
  },
] as const;

export type PaymentChargeKey = (typeof PAYMENT_CHARGE_SWITCHES)[number]["key"];

const testOverrides = new Map<string, boolean>();

export function setPaymentChargeSwitchForTests(key: PaymentChargeKey, enabled: boolean | null) {
  if (enabled == null) testOverrides.delete(key);
  else testOverrides.set(key, enabled);
}

export function paymentChargeSpec(key: PaymentChargeKey) {
  const spec = PAYMENT_CHARGE_SWITCHES.find((row) => row.key === key);
  if (!spec) throw new Error("Unknown payment switch.");
  return spec;
}

export function paymentChargeKeyForDeposit(method: string): PaymentChargeKey | null {
  if (method === "card") return "card_collection";
  if (method === "ach_online") return "ach_collection";
  if (method === "ach_wire") return "wire_collection";
  if (method === "check") return "check_collection";
  return null;
}

export function paymentChargeKeyForRelease(priorStatus: string | null | undefined): PaymentChargeKey {
  if (priorStatus === "failed" || priorStatus === "returned") return "payout_retry";
  return "milestone_payout";
}

export function paymentChargeRefusal(key: PaymentChargeKey) {
  return `${paymentChargeSpec(key).label} is turned off.`;
}

export async function paymentChargeEnabled(key: PaymentChargeKey) {
  if (testOverrides.has(key)) return testOverrides.get(key)!;
  const spec = paymentChargeSpec(key);
  const table = prisma.paymentChargeSwitch;
  if (!table) return spec.defaultEnabled;
  try {
    const row = await table.findUnique({ where: { key } });
    return row?.enabled ?? spec.defaultEnabled;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "P2021" || code === "P2022") return spec.defaultEnabled;
    throw error;
  }
}

export async function paymentChargeBlock(key: PaymentChargeKey) {
  if (await paymentChargeEnabled(key)) return { ok: true as const };
  const spec = paymentChargeSpec(key);
  return { ok: false as const, error: `${paymentChargeRefusal(key)} ${spec.stopped}` };
}

export async function listPaymentChargeSwitches() {
  return Promise.all(
    PAYMENT_CHARGE_SWITCHES.map(async (spec) => ({
      ...spec,
      enabled: await paymentChargeEnabled(spec.key),
    })),
  );
}

export async function savePaymentChargeSwitches(input: {
  actor: string;
  reason: string;
  enabled: Partial<Record<PaymentChargeKey, boolean>>;
}) {
  const reason = input.reason.trim().slice(0, 500);
  if (reason.length < 8) throw new Error("Enter a reason of at least 8 characters.");
  const before: Record<string, boolean> = {};
  const after: Record<string, boolean> = {};
  for (const spec of PAYMENT_CHARGE_SWITCHES) {
    before[spec.key] = await paymentChargeEnabled(spec.key);
    const enabled = input.enabled[spec.key] === true;
    after[spec.key] = enabled;
    await prisma.paymentChargeSwitch.upsert({
      where: { key: spec.key },
      update: { enabled },
      create: { key: spec.key, enabled },
    });
  }
  await prisma.auditLog
    .create({
      data: {
        actor: input.actor,
        action: "payment_charge_switches",
        objectType: "PaymentChargeSwitch",
        objectId: "board",
        before,
        after: { ...after, reason },
      },
    })
    .catch(() => undefined);
}
