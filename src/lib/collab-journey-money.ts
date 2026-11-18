/**
 * One collaboration money check: agreement, checkout, milestones, and payout
 * must reconcile to the same recorded cents. Display uses 2-decimal labels.
 */
import { formatContractMoney } from "@/lib/money";

export type CollabMoneySnapshot = {
  currency: string;
  agreementGrossCents: number;
  agreementBusinessFeeCents: number;
  agreementInfluencerNetCents: number;
  checkoutBusinessPaysCents: number;
  milestoneGrossCents: number[];
  milestoneFeeCents: number[];
  milestoneNetCents: number[];
};

export type CollabMoneyCheck = {
  id: string;
  ok: boolean;
  detail: string;
};

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

/** Totals must match across agreement, checkout, and milestone schedule. */
export function proveCollabMoneyReconciliation(input: CollabMoneySnapshot): CollabMoneyCheck[] {
  const currency = input.currency;
  const milestoneGross = sum(input.milestoneGrossCents);
  const milestoneFee = sum(input.milestoneFeeCents);
  const milestoneNet = sum(input.milestoneNetCents);
  const expectedBusinessPays = input.agreementGrossCents + input.agreementBusinessFeeCents;
  const influencerFee = input.agreementGrossCents - input.agreementInfluencerNetCents;
  return [
    {
      id: "M1",
      ok: input.checkoutBusinessPaysCents === expectedBusinessPays,
      detail: `Checkout ${formatContractMoney(input.checkoutBusinessPaysCents, currency)} vs agreement ${formatContractMoney(expectedBusinessPays, currency)}`,
    },
    {
      id: "M2",
      ok: milestoneGross === input.agreementGrossCents,
      detail: `Milestone gross sum ${formatContractMoney(milestoneGross, currency)} vs agreement ${formatContractMoney(input.agreementGrossCents, currency)}`,
    },
    {
      id: "M3",
      ok: milestoneFee === input.agreementBusinessFeeCents,
      detail: `Milestone fee sum ${formatContractMoney(milestoneFee, currency)} vs agreement ${formatContractMoney(input.agreementBusinessFeeCents, currency)}`,
    },
    {
      id: "M4",
      ok: milestoneNet === input.agreementInfluencerNetCents,
      detail: `Milestone net sum ${formatContractMoney(milestoneNet, currency)} vs agreement ${formatContractMoney(input.agreementInfluencerNetCents, currency)}`,
    },
    {
      id: "M5",
      ok: influencerFee >= 0 && input.agreementInfluencerNetCents + influencerFee === input.agreementGrossCents,
      detail: `Gross ${formatContractMoney(input.agreementGrossCents, currency)} = net ${formatContractMoney(input.agreementInfluencerNetCents, currency)} + influencer fee ${formatContractMoney(influencerFee, currency)}`,
    },
    {
      id: "M6",
      ok: currency !== "USD" || formatContractMoney(20_790, currency) === "$207.90",
      detail: `Contract money keeps cents (${formatContractMoney(20_790, currency)})`,
    },
  ];
}

/** ABC Holdings × Ag Olomola reference amounts from the staging audit screenshots. */
export const STAGING_COLLAB_MONEY_EXAMPLE: CollabMoneySnapshot = {
  currency: "USD",
  agreementGrossCents: 420_000,
  agreementBusinessFeeCents: 63_000,
  agreementInfluencerNetCents: 357_000,
  checkoutBusinessPaysCents: 483_000,
  milestoneGrossCents: [420_000],
  milestoneFeeCents: [63_000],
  milestoneNetCents: [357_000],
};
