/** Sidebar badges count the same actions as the dashboard, on the item that opens them. */

export const CREATOR_COLLABORATIONS = "/collaboration/hub?view=collaborations";
export const BUSINESS_COLLABORATIONS = "/collaboration/business";
export const CONTRACTS_HREF = "/collaboration/contracts";
export const PAYMENTS_HREF = "/payments";

export function sidebarBadgeCounts(input: {
  invitations: number;
  signatures: number;
  work: number;
  payments: number;
}) {
  const invitations = Math.max(0, input.invitations);
  const signatures = Math.max(0, input.signatures);
  const work = Math.max(0, input.work);
  const payments = Math.max(0, input.payments);
  return {
    collaborations: invitations + work,
    contracts: signatures,
    payments,
  };
}

export function sidebarBadgeFor(href: string, counts: { collaborations: number; contracts: number; payments: number }) {
  const path = href.split("?")[0] ?? href;
  if (href === CREATOR_COLLABORATIONS || href === BUSINESS_COLLABORATIONS || path === "/collaboration/hub") {
    return counts.collaborations;
  }
  if (href === CONTRACTS_HREF) return counts.contracts;
  if (href === PAYMENTS_HREF || path === "/creator/earnings") return counts.payments;
  return 0;
}

export function sidebarBadgeLabel(count: number) {
  if (count <= 0) return "";
  return count > 9 ? "9+" : String(count);
}
