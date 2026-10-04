import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getAccountSession } from "@/lib/accounts";
import {
  DEFAULT_GUEST_POLICY,
  decideGuestGate,
  type GateDecision,
} from "@/lib/account-policy";
import { getCollabControlPlane, type GuestCollabThresholds } from "@/lib/collab-control-plane";

const GUEST_HEADER = "x-influrios-guest";

export type GuestQuotaKind = "profile" | "search" | "propose" | "apply";

export type GuestQuota = {
  decision: GateDecision;
  copy: string;
  count: number;
};

const COLLAB_SOFT_COPY =
  "You are exploring collaborations as a guest. Create a free account to keep proposing or applying.";
const COLLAB_HARD_COPY =
  "Create a free account to continue proposing or applying for collaborations. We will bring you back here.";

export function guestCollabLimitsFromPlane(thresholds: GuestCollabThresholds): {
  propose: { soft: number; hard: number };
  apply: { soft: number; hard: number };
} {
  return {
    propose: { soft: thresholds.proposeSoft, hard: thresholds.proposeHard },
    apply: { soft: thresholds.applySoft, hard: thresholds.applyHard },
  };
}

/** Pure helper for tests — same soft/hard rules as profile/search guest gates. */
export function decideGuestCollabGate(
  count: number,
  limits: { soft: number; hard: number },
  authenticated: boolean,
): GateDecision {
  return decideGuestGate(count, limits, authenticated);
}

async function policy() {
  try {
    const row = await prisma.guestUsagePolicy.findUnique({ where: { id: "default" } });
    if (row) return row;
    return prisma.guestUsagePolicy.create({
      data: { id: "default", ...DEFAULT_GUEST_POLICY },
    });
  } catch {
    return { id: "default", ...DEFAULT_GUEST_POLICY, updatedAt: new Date() };
  }
}

export async function consumeGuestQuota(kind: GuestQuotaKind): Promise<GuestQuota> {
  const account = await getAccountSession().catch(() => null);
  if (account) return { decision: "allow", copy: "", count: 0 };

  try {
    const headerStore = await headers();
    const guestId =
      headerStore.get(GUEST_HEADER) || headerStore.get("cookie")?.match(/influrios_guest=([^;]+)/)?.[1];
    if (!guestId) return { decision: "allow", copy: "", count: 0 };

    if (kind === "propose" || kind === "apply") {
      const plane = await getCollabControlPlane();
      const limits = guestCollabLimitsFromPlane(plane.guestCollab);
      const row = await prisma.guestUsage.upsert({
        where: { id: guestId },
        create: {
          id: guestId,
          collabProposes: kind === "propose" ? 1 : 0,
          collabApplies: kind === "apply" ? 1 : 0,
        },
        update:
          kind === "propose"
            ? { collabProposes: { increment: 1 } }
            : { collabApplies: { increment: 1 } },
      });
      const count = kind === "propose" ? row.collabProposes : row.collabApplies;
      const decision = decideGuestCollabGate(
        count,
        kind === "propose" ? limits.propose : limits.apply,
        false,
      );
      return {
        decision,
        copy: decision === "hard" ? COLLAB_HARD_COPY : decision === "soft" ? COLLAB_SOFT_COPY : "",
        count,
      };
    }

    const limits = await policy();
    const row = await prisma.guestUsage.upsert({
      where: { id: guestId },
      create: {
        id: guestId,
        profileViews: kind === "profile" ? 1 : 0,
        searches: kind === "search" ? 1 : 0,
      },
      update: kind === "profile" ? { profileViews: { increment: 1 } } : { searches: { increment: 1 } },
    });
    const count = kind === "profile" ? row.profileViews : row.searches;
    const decision = decideGuestGate(
      count,
      kind === "profile"
        ? { soft: limits.profileViewSoft, hard: limits.profileViewHard }
        : { soft: limits.searchSoft, hard: limits.searchHard },
      false,
    );
    return {
      decision,
      copy: decision === "hard" ? limits.hardCopy : limits.softCopy,
      count,
    };
  } catch (error) {
    console.error("guest gate skipped", error);
    return { decision: "allow", copy: "", count: 0 };
  }
}
