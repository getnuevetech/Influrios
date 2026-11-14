/**
 * Recovery copy for a failed or returned bank payout.
 * Delivery, transfer, and bank payout stay separate. This does not move money.
 */

export type RecoveryStage = { id: "funding" | "delivery" | "transfer" | "bank"; status: string };

export type PaymentRecovery =
  | {
      kind: "unavailable";
      title: "Payment data unavailable";
      detail: "Could not load the current payment status. Please try again.";
    }
  | {
      kind: "influencer";
      title: "Payout needs attention";
      detail: "Your bank details need updating.";
      rows: { label: string; attention: boolean }[];
      note: string;
      cta: "Update payout details";
    }
  | {
      kind: "business";
      title: "Payout needs attention";
      detail: "Action is required from the influencer before payout can continue.";
      note: string;
      cta: "View payment history";
    };

export function paymentRecoveryView(input: {
  audience: "business" | "influencer";
  stages: readonly RecoveryStage[];
  unavailable?: boolean;
}): PaymentRecovery | null {
  if (input.unavailable) {
    return {
      kind: "unavailable",
      title: "Payment data unavailable",
      detail: "Could not load the current payment status. Please try again.",
    };
  }
  const bank = input.stages.find((stage) => stage.id === "bank");
  if (bank?.status !== "Returned") return null;
  const delivery = input.stages.find((stage) => stage.id === "delivery");
  const transfer = input.stages.find((stage) => stage.id === "transfer");
  if (input.audience === "business") {
    return {
      kind: "business",
      title: "Payout needs attention",
      detail: "Action is required from the influencer before payout can continue.",
      note: "Funding remains recorded. Do not fund this collaboration again.",
      cta: "View payment history",
    };
  }
  return {
    kind: "influencer",
    title: "Payout needs attention",
    detail: "Your bank details need updating.",
    rows: [
      { label: delivery?.status === "Complete" ? "Delivery approved" : "Delivery not approved", attention: false },
      { label: transfer?.status === "Confirmed" ? "Transfer confirmed" : "Transfer not confirmed", attention: false },
      { label: "Bank payout failed", attention: true },
    ],
    note: "Updating bank details does not create another payout. We will confirm the next step after verification.",
    cta: "Update payout details",
  };
}
