import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getAccountSession } from "@/lib/accounts";
import {
  DEFAULT_GUEST_POLICY,
  decideGuestGate,
  type GateDecision,
} from "@/lib/account-policy";

const GUEST_HEADER = "x-influrios-guest";

export type GuestQuota = {
  decision: GateDecision;
  copy: string;
  count: number;
};

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

export async function consumeGuestQuota(kind: "profile" | "search"): Promise<GuestQuota> {
  const account = await getAccountSession().catch(() => null);
  if (account) return { decision: "allow", copy: "", count: 0 };

  try {
    const headerStore = await headers();
    const guestId = headerStore.get(GUEST_HEADER) || headerStore.get("cookie")?.match(/influrios_guest=([^;]+)/)?.[1];
    if (!guestId) return { decision: "allow", copy: "", count: 0 };

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
