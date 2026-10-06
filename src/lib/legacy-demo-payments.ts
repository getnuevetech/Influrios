/** Phase 9/10 JSON escrow and trust consoles are removed. The marketplace ledger is the only money path. */
export async function legacyDemoPaymentsEnabled(): Promise<boolean> {
  return false;
}

export async function assertLegacyDemoPayments() {
  if (!(await legacyDemoPaymentsEnabled())) {
    throw new Error("The Phase 9/10 payment demos are turned off. Use the marketplace ledger.");
  }
}

/** Admin nav entries that only exist for the Phase 9 JSON console. Trust stays for ledger disputes. */
export function isLegacyDemoPaymentsAdminHref(href: string): boolean {
  return href === "/admin/payments";
}
