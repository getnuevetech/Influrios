import { prisma } from "@/lib/db";
import { isBusinessRole, type AccountAudience } from "@/lib/account-audience";
import type { AccountSession } from "@/lib/accounts";
import { creatorMaySubmitWork } from "@/lib/milestone-delivery";

export type FundingAccessOk = {
  ok: true;
  funding: {
    id: string;
    workspaceId: string | null;
    creatorSlug: string;
    businessName: string;
    status: string;
  };
  audience: AccountAudience;
  /** Influencer slug of the signed-in creator. Empty for a business. */
  actorSlug: string | null;
};

export type FundingAccessDenied = { ok: false; error: string };

/**
 * Business may mutate fundings owned by their workspace.
 * Creators may act on fundings for their linked creator slug (submit / evidence / dispute).
 */
export async function assertFundingAccess(
  account: AccountSession,
  fundingId: string,
): Promise<FundingAccessOk | FundingAccessDenied> {
  const id = fundingId.trim();
  if (!id) return { ok: false, error: "Choose a funding." };

  const funding = await prisma.collaborationFunding.findUnique({
    where: { id },
    select: {
      id: true,
      workspaceId: true,
      creatorSlug: true,
      businessName: true,
      status: true,
      shareSnapshotJson: true,
    },
  });
  if (!funding) return { ok: false, error: "That funding was not found." };

  if (isBusinessRole(account.role)) {
    const workspace = await prisma.businessWorkspace.findUnique({
      where: { ownerUserId: account.id },
      select: { id: true },
    });
    if (!workspace?.id || funding.workspaceId !== workspace.id) {
      return { ok: false, error: "You do not have access to that funding." };
    }
    return { ok: true, funding, audience: "business", actorSlug: null };
  }

  const creator = await prisma.creator.findUnique({
    where: { userId: account.id },
    select: { slug: true },
  });
  if (
    !creator?.slug ||
    !creatorMaySubmitWork({
      actorSlug: creator.slug,
      creatorSlug: funding.creatorSlug,
      shareSnapshotJson: funding.shareSnapshotJson,
    })
  ) {
    return { ok: false, error: "You do not have access to that funding." };
  }
  return { ok: true, funding, audience: "creator", actorSlug: creator.slug };
}

/** Business-only mutations (approve, checkout, cancel, change order). */
export function requireBusinessFundingAccess(
  access: FundingAccessOk | FundingAccessDenied,
): FundingAccessOk | FundingAccessDenied {
  if (!access.ok) return access;
  if (access.audience !== "business") {
    return { ok: false, error: "Only the business on this funding can do that." };
  }
  return access;
}
