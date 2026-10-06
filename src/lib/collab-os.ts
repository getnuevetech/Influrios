import { productSwitch } from "@/lib/product-switches";

/**
 * L4 — Collaboration OS v1 surfaces (hubs, contract wizard, signed-in landing redirects).
 * Default **on**. When off, guests keep the public landing; hubs fall back to propose/records.
 */
export async function collabOsV1Enabled(): Promise<boolean> {
  return productSwitch("collab_os_v1");
}

export async function assertCollabOsV1() {
  if (!(await collabOsV1Enabled())) {
    throw new Error("Collaboration OS hubs are turned off. Use propose and records.");
  }
}
