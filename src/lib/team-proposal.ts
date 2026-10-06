import { prisma } from "@/lib/db";

export type MemberDecision = "invited" | "accepted" | "declined";

export function nextProposalStatus(
  members: { creatorSlug: string; status: string }[],
  slug: string,
  decision: "accepted" | "declined",
): "sent" | "accepted" | "declined" {
  const next = members.map((member) =>
    member.creatorSlug === slug ? { ...member, status: decision } : member,
  );
  if (next.some((member) => member.status === "declined")) return "declined";
  if (next.length >= 2 && next.every((member) => member.status === "accepted")) return "accepted";
  return "sent";
}

/** Funding opens only after every member accepted and every payout route is ready. */
export function teamFundingReady(input: {
  status: string;
  payoutReady: boolean[];
}): { ok: true } | { ok: false; error: string } {
  if (input.status !== "accepted") {
    return { ok: false, error: "Every creator must accept before funding." };
  }
  if (input.payoutReady.length < 2 || input.payoutReady.some((ready) => !ready)) {
    return { ok: false, error: "Every creator needs a ready payout route." };
  }
  return { ok: true };
}

export async function createTeamProposal(input: {
  workspaceId: string;
  title: string;
  creatorSlugs: string[];
}) {
  const slugs = [...new Set(input.creatorSlugs.map((slug) => slug.trim()).filter(Boolean))];
  if (slugs.length < 2) return { ok: false as const, error: "Select at least two creators." };
  const title = input.title.trim();
  const workspaceId = input.workspaceId.trim();
  if (!title || !workspaceId || workspaceId === "public") {
    return { ok: false as const, error: "Sign in with a business workspace and add a title." };
  }
  const row = await prisma.teamProposal.create({
    data: {
      workspaceId,
      title: title.slice(0, 160),
      status: "sent",
      members: { create: slugs.map((creatorSlug) => ({ creatorSlug, status: "invited" })) },
    },
    include: { members: true },
  });
  return { ok: true as const, id: row.id };
}

export async function respondToTeamProposal(input: {
  proposalId: string;
  creatorSlug: string;
  decision: "accepted" | "declined";
}) {
  const row = await prisma.teamProposal.findUnique({
    where: { id: input.proposalId },
    include: { members: true },
  });
  if (!row) return { ok: false as const, error: "Proposal not found." };
  if (row.status === "accepted" || row.status === "declined") {
    return { ok: false as const, error: "This proposal is already closed." };
  }
  const member = row.members.find((item) => item.creatorSlug === input.creatorSlug);
  if (!member) return { ok: false as const, error: "You are not on this proposal." };
  const status = nextProposalStatus(row.members, input.creatorSlug, input.decision);
  await prisma.$transaction([
    prisma.teamProposalMember.update({
      where: { id: member.id },
      data: { status: input.decision },
    }),
    prisma.teamProposal.update({
      where: { id: row.id },
      data: { status },
    }),
  ]);
  return { ok: true as const, status };
}

export async function listTeamProposalsForWorkspace(workspaceId: string) {
  return prisma.teamProposal.findMany({
    where: { workspaceId },
    include: { members: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function listTeamProposalsForCreator(creatorSlug: string) {
  return prisma.teamProposal.findMany({
    where: { members: { some: { creatorSlug } } },
    include: { members: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}
