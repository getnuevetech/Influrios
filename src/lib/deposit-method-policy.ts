/**
 * Which payment methods a business sees for a collaboration deposit, by amount.
 *
 * Card suits smaller deals (2.9% + 30¢ on Stripe). ACH bank debit is the default for larger ones
 * (0.8%, capped at $5). Very large deals pay by wire or bank transfer to a Stripe-held account
 * number, so the money still lands in the Collaborations balance and milestones can be released.
 * Finance sets the two cut-offs; the page and the server both use them.
 */
import { prisma } from "@/lib/db";

export const DEPOSIT_BANDS_KEY = "marketplace.deposit_method_bands";

export type GatewayDepositMethod = "card" | "ach_online" | "bank_transfer";

export type DepositBands = {
  /** Card is offered up to and including this amount (minor units). */
  cardMaxCents: number;
  /** At or above this amount only wire / bank transfer is offered (minor units). */
  bankTransferMinCents: number;
};

export const DEFAULT_DEPOSIT_BANDS: DepositBands = { cardMaxCents: 500_000, bankTransferMinCents: 2_500_000 };

export function readDepositBands(value: unknown): DepositBands {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const cents = (key: keyof DepositBands) => {
    const n = Number(row[key]);
    return Number.isInteger(n) && n > 0 ? n : DEFAULT_DEPOSIT_BANDS[key];
  };
  const cardMaxCents = cents("cardMaxCents");
  const bankTransferMinCents = cents("bankTransferMinCents");
  if (bankTransferMinCents <= cardMaxCents) return { ...DEFAULT_DEPOSIT_BANDS };
  return { cardMaxCents, bankTransferMinCents };
}

export type DepositMethodChoice = { methods: GatewayDepositMethod[]; recommended: GatewayDepositMethod };

/**
 * Methods for this amount. Non-USD deposits are card only (ACH and US bank transfers collect USD).
 */
export function depositMethodsForAmount(amountCents: number, currency: string, bands: DepositBands): DepositMethodChoice {
  if (currency.trim().toUpperCase() !== "USD") return { methods: ["card"], recommended: "card" };
  if (amountCents >= bands.bankTransferMinCents) return { methods: ["bank_transfer"], recommended: "bank_transfer" };
  if (amountCents > bands.cardMaxCents) return { methods: ["ach_online"], recommended: "ach_online" };
  return { methods: ["card", "ach_online"], recommended: "card" };
}

export async function getDepositBands() {
  const row = await prisma.platformSetting.findUnique({ where: { key: DEPOSIT_BANDS_KEY } }).catch(() => null);
  return readDepositBands(row?.value);
}

export async function saveDepositBands(input: DepositBands) {
  const value = readDepositBands(input);
  if (value.cardMaxCents !== input.cardMaxCents || value.bankTransferMinCents !== input.bankTransferMinCents) {
    return { ok: false as const, error: "Enter whole amounts above zero, with the wire amount above the card limit. Nothing was saved." };
  }
  await prisma.platformSetting.upsert({
    where: { key: DEPOSIT_BANDS_KEY },
    create: { key: DEPOSIT_BANDS_KEY, value },
    update: { value },
  });
  return { ok: true as const, bands: value };
}
