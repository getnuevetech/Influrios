/**
 * L3 — Agency workspace access when agency_seats is on.
 * Plan entitlement remains the gate when seats are off.
 */
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { businessEntitlementsForPlan } from "@/lib/entitlements-db";
import { resolveAgencySeatForEmail, type AgencySeatRole, asAgencySeatRole } from "@/lib/agency-seats";
import { productSwitch } from "@/lib/product-switches";

export type AgencyAccess =
  | {
      ok: true;
      mode: "plan";
      workspace: Awaited<ReturnType<typeof getWorkspace>>;
      seat: null;
      role: null;
      account: Awaited<ReturnType<typeof getAccountSession>>;
    }
  | {
      ok: true;
      mode: "seat";
      workspace: Awaited<ReturnType<typeof getWorkspace>>;
      seat: NonNullable<Awaited<ReturnType<typeof resolveAgencySeatForEmail>>>;
      role: AgencySeatRole;
      account: NonNullable<Awaited<ReturnType<typeof getAccountSession>>>;
    }
  | { ok: false; error: string; seatsEnabled: boolean };

export async function resolveAgencyAccess(): Promise<AgencyAccess> {
  const [seatsEnabled, account] = await Promise.all([
    productSwitch("agency_seats"),
    getAccountSession(),
  ]);
  const workspace = await getWorkspace(account?.id);

  if (seatsEnabled) {
    if (!account) {
      return { ok: false, error: "Sign in with your agency seat email to continue.", seatsEnabled: true };
    }
    const seat = await resolveAgencySeatForEmail(account.email);
    if (!seat) {
      return {
        ok: false,
        error: "Your account is not an active accepted agency seat.",
        seatsEnabled: true,
      };
    }
    return {
      ok: true,
      mode: "seat",
      workspace,
      seat,
      role: asAgencySeatRole(seat.role),
      account,
    };
  }

  const entitlements = await businessEntitlementsForPlan(workspace.plan);
  if (!entitlements.agencyWorkspace) {
    return { ok: false, error: "agency_plan_required", seatsEnabled: false };
  }
  return { ok: true, mode: "plan", workspace, seat: null, role: null, account };
}

export function seatCanMutate(role: AgencySeatRole | null) {
  return role === "owner" || role === "manager" || role === "member";
}
