import { prisma } from "@/lib/db";
import { readShareSnapshot } from "@/lib/fx-share";
import { submitFundingMilestone } from "@/lib/marketplace-ledger";

const LINK = /^https:\/\/\S+$/i;

export function creatorSlugsOnFunding(input: { creatorSlug: string; shareSnapshotJson: unknown }) {
  const shares = readShareSnapshot(input.shareSnapshotJson);
  const slugs = new Set<string>();
  if (input.creatorSlug.trim()) slugs.add(input.creatorSlug.trim());
  for (const share of shares ?? []) slugs.add(share.label);
  return [...slugs];
}

export function creatorMaySubmitWork(input: { actorSlug: string; creatorSlug: string; shareSnapshotJson: unknown }) {
  return creatorSlugsOnFunding(input).includes(input.actorSlug.trim());
}

/** Work state shown on a milestone. Approved work is done even while the payout is still with the provider. */
export function milestoneWorkLabel(status: string) {
  if (status === "approved" || status === "released") return "Done";
  if (status === "submitted") return "In review";
  if (status === "pending") return "Open";
  return status.replaceAll("_", " ");
}

export function submissionIsComplete(input: { note: string; linkUrl: string }) {
  const note = input.note.trim();
  const linkUrl = input.linkUrl.trim();
  if (linkUrl && !LINK.test(linkUrl)) return { ok: false as const, error: "The work link must start with https://." };
  if (note.length < 8 && !linkUrl) {
    return { ok: false as const, error: "Add a note or an https link so the business can review this version." };
  }
  return { ok: true as const, note, linkUrl };
}

export async function submitMilestoneWork(input: {
  fundingId: string;
  milestoneId: string;
  creatorSlug: string;
  note: string;
  linkUrl: string;
}) {
  const content = submissionIsComplete(input);
  if (!content.ok) return content;
  const milestone = await prisma.fundingMilestone.findFirst({
    where: { id: input.milestoneId, fundingId: input.fundingId },
    include: { funding: { select: { creatorSlug: true, shareSnapshotJson: true, status: true } } },
  });
  if (!milestone) return { ok: false as const, error: "Milestone not found." };
  if (milestone.funding.status !== "held") {
    return { ok: false as const, error: "Work starts after the provider confirms the hold." };
  }
  if (!creatorMaySubmitWork({ actorSlug: input.creatorSlug, creatorSlug: milestone.funding.creatorSlug, shareSnapshotJson: milestone.funding.shareSnapshotJson })) {
    return { ok: false as const, error: "Only an influencer assigned to this milestone can submit work." };
  }
  if (milestone.status !== "pending") {
    return { ok: false as const, error: "This milestone is not waiting for a submission." };
  }
  const previous = await prisma.milestoneSubmission.count({
    where: { milestoneId: milestone.id, creatorSlug: input.creatorSlug },
  });
  const submission = await prisma.milestoneSubmission.create({
    data: {
      fundingId: milestone.fundingId,
      milestoneId: milestone.id,
      creatorSlug: input.creatorSlug,
      version: previous + 1,
      note: content.note,
      linkUrl: content.linkUrl,
      status: "submitted",
    },
  });
  const submitted = await submitFundingMilestone(milestone.fundingId, milestone.id);
  if (!submitted.ok) {
    await prisma.milestoneSubmission.delete({ where: { id: submission.id } }).catch(() => undefined);
    return submitted;
  }
  return { ok: true as const, id: submission.id, version: submission.version };
}

export async function markLatestSubmission(input: {
  milestoneId: string;
  status: "revision_requested" | "approved";
  reviewNote: string;
}) {
  const latest = await prisma.milestoneSubmission.findFirst({
    where: { milestoneId: input.milestoneId, status: "submitted" },
    orderBy: { version: "desc" },
  });
  if (!latest) return;
  await prisma.milestoneSubmission.update({
    where: { id: latest.id },
    data: { status: input.status, reviewNote: input.reviewNote.trim() },
  });
}

export function visibleSubmissions<T extends { creatorSlug: string }>(rows: T[], audience: "business" | "creator", actorSlug: string | null) {
  if (audience === "business") return rows;
  return rows.filter((row) => row.creatorSlug === actorSlug);
}
