/**
 * Agency workspace access.
 * Seat mode uses the workspace the member selected. It does not pick the newest accepted seat.
 */
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { businessEntitlementsForPlan } from "@/lib/entitlements-db";
import { listAgencyMemberships, type AgencySeatRole } from "@/lib/agency-seats";
import { agencyActionAllowed, agencySeatChoiceRole, type AgencyPermission } from "@/lib/agency-context";
import { productSwitch } from "@/lib/product-switches";

export type AgencySeatChoice = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  role: AgencySeatRole;
  email: string;
};

type Account = NonNullable<Awaited<ReturnType<typeof getAccountSession>>>;
type BusinessWorkspace = Awaited<ReturnType<typeof getWorkspace>>;

export type AgencyAccess =
  | {
      ok: true;
      mode: "plan";
      workspace: BusinessWorkspace;
      seat: null;
      seats: AgencySeatChoice[];
      role: "owner";
      account: Account | null;
      denial: null;
    }
  | {
      ok: true;
      mode: "seat";
      workspace: BusinessWorkspace;
      seat: AgencySeatChoice;
      seats: AgencySeatChoice[];
      role: AgencySeatRole;
      account: Account;
      denial: null;
    }
  | {
      ok: true;
      mode: "choose";
      workspace: BusinessWorkspace;
      seat: null;
      seats: AgencySeatChoice[];
      role: null;
      account: Account;
      denial: string | null;
    }
  | { ok: false; error: string; seatsEnabled: boolean };

function toChoice(
  seat: Awaited<ReturnType<typeof listAgencyMemberships>>[number],
): AgencySeatChoice | null {
  const role = agencySeatChoiceRole(seat.role);
  if (!role) return null;
  return {
    id: seat.id,
    workspaceId: seat.workspaceId,
    workspaceName: seat.workspace.name,
    role,
    email: seat.email,
  };
}

export async function resolveAgencyAccess(requestedWorkspaceId?: string | null): Promise<AgencyAccess> {
  const [seatsEnabled, account] = await Promise.all([
    productSwitch("agency_seats"),
    getAccountSession(),
  ]);
  const workspace = await getWorkspace(account?.id);

  if (seatsEnabled) {
    if (!account) {
      return { ok: false, error: "Sign in with your agency seat email to continue.", seatsEnabled: true };
    }
    const seats = (await listAgencyMemberships({ userId: account.id, email: account.email }))
      .map(toChoice)
      .filter((seat): seat is AgencySeatChoice => seat !== null);
    const requested = (requestedWorkspaceId ?? "").trim();
    if (requested) {
      const seat = seats.find((item) => item.workspaceId === requested) ?? null;
      if (!seat) {
        return {
          ok: true,
          mode: "choose",
          workspace,
          seat: null,
          seats,
          role: null,
          account,
          denial: "That workspace is not an active membership.",
        };
      }
      return { ok: true, mode: "seat", workspace, seat, seats, role: seat.role, account, denial: null };
    }
    if (seats.length === 1) {
      const seat = seats[0];
      return { ok: true, mode: "seat", workspace, seat, seats, role: seat.role, account, denial: null };
    }
    if (seats.length === 0) {
      return {
        ok: false,
        error: "Your account is not an active accepted agency seat.",
        seatsEnabled: true,
      };
    }
    return {
      ok: true,
      mode: "choose",
      workspace,
      seat: null,
      seats,
      role: null,
      account,
      denial: null,
    };
  }

  const entitlements = await businessEntitlementsForPlan(workspace.plan);
  if (!entitlements.agencyWorkspace) {
    return { ok: false, error: "agency_plan_required", seatsEnabled: false };
  }
  return { ok: true, mode: "plan", workspace, seat: null, seats: [], role: "owner", account, denial: null };
}

export function seatCanMutate(role: AgencySeatRole | null) {
  return agencyActionAllowed(role, "manage_roster");
}

export function agencySeatAllows(role: AgencySeatRole | null, action: AgencyPermission) {
  return agencyActionAllowed(role, action);
}
