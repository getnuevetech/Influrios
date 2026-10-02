import { productSwitch } from "@/lib/product-switches";

/** Phase 9/10 JSON escrow and trust demo consoles. Default off. */
export async function legacyDemoPaymentsEnabled(): Promise<boolean> {
  return productSwitch("legacy_demo_payments");
}

export async function assertLegacyDemoPayments() {
  if (!(await legacyDemoPaymentsEnabled())) {
    throw new Error("The Phase 9/10 payment demos are turned off. Use the marketplace ledger.");
  }
}
