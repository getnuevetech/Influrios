/**
 * Independent status axes for one collaboration record.
 * Funding, delivery, and bank payout are never inferred from each other.
 * Paid is only a confirmed bank payout. Unknown evidence stays unavailable.
 */

export type RecordStatusAxes = {
  invitation: "Pending" | "Interested" | "Declined" | "Expired" | "Accepted" | "Unavailable";
  agreement: "Draft" | "Awaiting signatures" | "Signed" | "Unavailable";
  funding: "Not started" | "Processing" | "Confirmed" | "Failed" | "Refunded" | "Unavailable";
  delivery: "Not started" | "In review" | "Approved" | "Unavailable";
  payout: "Not initiated" | "Processing" | "Paid" | "Failed" | "Returned" | "Unavailable";
  verification: "Unverified" | "Pending" | "Verified" | "Rejected" | "Expired" | "Unavailable";
};

function token(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function invitationAxis(value: string | null | undefined): RecordStatusAxes["invitation"] {
  const status = token(value);
  if (!status) return "Unavailable";
  if (status === "accepted" || status === "collaboration_drafted") return "Accepted";
  if (status === "interested") return "Interested";
  if (status === "viewed" || status === "pending") return "Pending";
  if (status === "declined") return "Declined";
  if (status === "expired") return "Expired";
  return "Unavailable";
}

function agreementAxis(value: string | null | undefined): RecordStatusAxes["agreement"] {
  const status = token(value);
  if (!status) return "Unavailable";
  if (status === "signed") return "Signed";
  if (status === "sent" || status === "awaiting" || status === "awaiting_signatures") return "Awaiting signatures";
  if (status === "draft") return "Draft";
  return "Unavailable";
}

function fundingAxis(value: string | null | undefined): RecordStatusAxes["funding"] {
  const status = token(value);
  if (!status) return "Not started";
  if (status === "held" || status === "completed") return "Confirmed";
  if (status === "processing" || status === "pending" || status === "checkout") return "Processing";
  if (status === "failed") return "Failed";
  if (status === "refunded") return "Refunded";
  return "Unavailable";
}

function deliveryAxis(value: string | null | undefined): RecordStatusAxes["delivery"] {
  const status = token(value);
  if (!status) return "Unavailable";
  if (status === "submitted") return "In review";
  if (
    status === "approved" ||
    status === "released" ||
    status === "release_scheduled" ||
    status === "release_requested" ||
    status === "payout_failed" ||
    status === "returned"
  ) {
    return "Approved";
  }
  if (status === "pending") return "Not started";
  return "Unavailable";
}

function payoutAxis(input: {
  payoutState?: string | null;
  milestoneStatus?: string | null;
}): RecordStatusAxes["payout"] {
  const payout = token(input.payoutState);
  const milestone = token(input.milestoneStatus);
  if (!payout && !milestone) return "Unavailable";
  if (payout === "returned" || milestone === "returned") return "Returned";
  if (payout === "failed" || milestone === "payout_failed") return "Failed";
  if (payout === "paid" || milestone === "released") return "Paid";
  if (
    payout === "pending" ||
    payout === "in_transit" ||
    payout === "queued" ||
    milestone === "approved" ||
    milestone === "release_scheduled" ||
    milestone === "release_requested"
  ) {
    return "Processing";
  }
  if (payout === "unknown" || milestone === "unknown") return "Unavailable";
  if (!payout && milestone === "pending") return "Not initiated";
  if (!payout && milestone === "submitted") return "Not initiated";
  return "Unavailable";
}

function verificationAxis(value: string | null | undefined): RecordStatusAxes["verification"] {
  const status = token(value);
  if (!status) return "Unavailable";
  if (status === "verified") return "Verified";
  if (status === "pending") return "Pending";
  if (status === "rejected") return "Rejected";
  if (status === "expired") return "Expired";
  if (status === "unverified") return "Unverified";
  return "Unavailable";
}

export function recordStatusAxes(input: {
  invitation?: string | null;
  agreement?: string | null;
  fundingStatus?: string | null;
  deliveryStatus?: string | null;
  payoutState?: string | null;
  milestoneStatus?: string | null;
  verification?: string | null;
}): RecordStatusAxes {
  return {
    invitation: invitationAxis(input.invitation),
    agreement: agreementAxis(input.agreement),
    funding: fundingAxis(input.fundingStatus),
    delivery: deliveryAxis(input.deliveryStatus),
    payout: payoutAxis({ payoutState: input.payoutState, milestoneStatus: input.milestoneStatus }),
    verification: verificationAxis(input.verification),
  };
}
