import { milestoneDeliveryLabel, milestonePayoutLabel } from "@/lib/milestone-delivery";

export type PaymentStageStatus = "Confirmed" | "Complete" | "Processing" | "Not started" | "In review" | "Paid" | "Returned";

export type PaymentStage = {
  id: "funding" | "delivery" | "transfer" | "bank";
  label: string;
  status: PaymentStageStatus;
  detail: string;
};

/**
 * Delivery approval, the transfer into the influencer account, and the bank payout
 * stay separate. Paid is only the confirmed bank payout.
 */
export function paymentStages(input: {
  fundingStatus: string;
  milestoneStatuses: string[];
  entryKinds: string[];
}): PaymentStage[] {
  const deliveryLabels = input.milestoneStatuses.map((status) => milestoneDeliveryLabel(status));
  const payoutLabels = input.milestoneStatuses.map((status) => milestonePayoutLabel(status));
  const deliveryApproved = deliveryLabels.includes("Approved");
  const deliveryReview = !deliveryApproved && deliveryLabels.includes("In review");
  const bankPaid = payoutLabels.includes("Paid") && !payoutLabels.some((label) => label === "Returned" || label === "Payout failed");
  const bankReturned = payoutLabels.includes("Returned") || payoutLabels.includes("Payout failed");
  const releaseEntry = input.entryKinds.includes("release");
  const payoutStarted =
    releaseEntry || input.milestoneStatuses.some((status) => status === "release_scheduled" || status === "release_requested");
  const bankProcessing = !bankPaid && !bankReturned && payoutStarted;
  const fundingConfirmed = input.fundingStatus === "held" || input.fundingStatus === "completed";
  const transferConfirmed = releaseEntry || bankPaid;
  const transferProcessing = !transferConfirmed && (deliveryApproved || bankProcessing);

  return [
    {
      id: "funding",
      label: "Funding received",
      status: fundingConfirmed ? "Confirmed" : "Not started",
      detail: "Provider collection",
    },
    {
      id: "delivery",
      label: "Milestone approved",
      status: deliveryApproved ? "Complete" : deliveryReview ? "In review" : "Not started",
      detail: "Work approval is not a payout",
    },
    {
      id: "transfer",
      label: "Transfer to influencer account",
      status: transferConfirmed ? "Confirmed" : transferProcessing ? "Processing" : "Not started",
      detail: "Provider account transfer",
    },
    {
      id: "bank",
      label: "Bank payout",
      status: bankPaid ? "Paid" : bankReturned ? "Returned" : bankProcessing || (releaseEntry && !bankPaid) ? "Processing" : "Not started",
      detail: bankReturned ? "A return is not a refund. Update the bank details before the next attempt." : "Provider to the influencer's bank",
    },
  ];
}

export function bankPayoutConfirmed(stages: readonly PaymentStage[]) {
  return stages.some((stage) => stage.id === "bank" && stage.status === "Paid");
}

export function paymentStageNote(stages: readonly PaymentStage[]) {
  const delivery = stages.find((stage) => stage.id === "delivery");
  const bank = stages.find((stage) => stage.id === "bank");
  if (bank?.status === "Returned") return "Payout returned. Update the bank details. This does not refund the business.";
  if (bank?.status === "Processing") return "No action needed. We will update this record when the provider confirms the payout.";
  if (delivery?.status === "Complete" && bank?.status !== "Paid") {
    return "Work approved. The bank payout has not been confirmed yet.";
  }
  return null;
}
