/**
 * W3.10 — Content rights vs payment (Product Addendum §13).
 * Milestone acceptance and IP/usage rights are separate. Default: rights activate
 * when the corresponding payment is released, unless parties expressly agree otherwise.
 */

export const RIGHTS_ACTIVATE_ON = ["release", "acceptance", "custom"] as const;
export type RightsActivateOn = (typeof RIGHTS_ACTIVATE_ON)[number];

export const RIGHTS_STATUSES = ["pending", "active", "waived_early"] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

export const RIGHTS_STATUS_LABELS: Record<RightsStatus, string> = {
  pending: "Rights pending",
  active: "Usage rights active",
  waived_early: "Rights active (agreed early)",
};

export function asRightsActivateOn(value: string | null | undefined): RightsActivateOn {
  const raw = String(value ?? "").trim().toLowerCase();
  if ((RIGHTS_ACTIVATE_ON as readonly string[]).includes(raw)) return raw as RightsActivateOn;
  return "release";
}

export function asRightsStatus(value: string | null | undefined): RightsStatus {
  const raw = String(value ?? "").trim().toLowerCase();
  if ((RIGHTS_STATUSES as readonly string[]).includes(raw)) return raw as RightsStatus;
  return "pending";
}

/** Pure transition: after milestone acceptance, rights stay pending unless activate-on = acceptance. */
export function rightsAfterAcceptance(input: {
  activateOn: string;
  currentStatus?: string | null;
}): { status: RightsStatus; activatedAt: Date | null } {
  const activateOn = asRightsActivateOn(input.activateOn);
  const current = asRightsStatus(input.currentStatus);
  if (current === "active" || current === "waived_early") {
    return { status: current, activatedAt: null };
  }
  if (activateOn === "acceptance") {
    return { status: "waived_early", activatedAt: new Date(0) }; // caller stamps real time
  }
  return { status: "pending", activatedAt: null };
}

/** Pure transition: after payment release, default path activates usage rights. */
export function rightsAfterPaymentRelease(input: {
  activateOn: string;
  currentStatus?: string | null;
}): { status: RightsStatus; shouldActivate: boolean } {
  const activateOn = asRightsActivateOn(input.activateOn);
  const current = asRightsStatus(input.currentStatus);
  if (current === "active" || current === "waived_early") {
    return { status: current, shouldActivate: false };
  }
  if (activateOn === "release" || activateOn === "custom") {
    // custom still defaults to release unless already activated by agreement elsewhere
    return { status: "active", shouldActivate: true };
  }
  // acceptance-mode already activated (or should have) at approve time
  return { status: current, shouldActivate: false };
}

/** UI/helper: rights are independent of milestone workflow status. */
export function rightsIndependentOfAcceptance(input: {
  milestoneStatus: string;
  rightsStatus: string;
}): boolean {
  const ms = input.milestoneStatus.toLowerCase();
  const rights = asRightsStatus(input.rightsStatus);
  if (ms === "approved" && rights === "pending") return true;
  if (ms === "released" && (rights === "active" || rights === "waived_early")) return true;
  if (ms === "pending" || ms === "submitted") return rights === "pending";
  return true;
}
