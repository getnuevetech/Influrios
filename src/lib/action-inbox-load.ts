/**
 * Loads inbox tasks from the records the signed-in account can already read.
 * A failed read is reported. It is not an empty task list.
 */
import { listAccountNotices } from "@/lib/account-notices";
import { isBusinessRole } from "@/lib/account-audience";
import type { AccountSession } from "@/lib/accounts";
import { inboxSourcesFromRecords, projectInboxTasks, type InboxTask } from "@/lib/action-inbox";
import { newIncidentReference } from "@/lib/business-status";
import { getWorkspace, leadIsOpen } from "@/lib/business";
import { contractNeedsSignature } from "@/lib/creator-home";
import { listContractsForUser } from "@/lib/contract-document";
import { prisma } from "@/lib/db";
import { listFundingsForBusiness, listFundingsForCreator } from "@/lib/marketplace-ledger";
import { applicationIsInvitation } from "@/lib/marketplace-listings";
import { invitationWaitingForInvitee } from "@/lib/invitation-turn";
import { paymentStages } from "@/lib/payment-stages";

export type InboxNotice = {
  id: string;
  title: string;
  detail: string;
  href: string;
  read: boolean;
};

export type InboxLoad = {
  tasksFailed: boolean;
  noticesFailed: boolean;
  incident: string;
  tasks: InboxTask[];
  notices: InboxNotice[];
};

type Deal = Awaited<ReturnType<typeof listFundingsForBusiness>>[number];

function payoutReturned(deal: Deal) {
  const stages = paymentStages({
    fundingStatus: deal.status,
    milestoneStatuses: deal.milestones.map((row) => row.status),
    entryKinds: deal.entries.map((entry) => entry.kind),
  });
  return stages.some((stage) => stage.id === "bank" && stage.status === "Returned");
}

function fundingAttention(deal: Deal) {
  const stages = paymentStages({
    fundingStatus: deal.status,
    milestoneStatuses: deal.milestones.map((row) => row.status),
    entryKinds: deal.entries.map((entry) => entry.kind),
  });
  const funding = stages.find((stage) => stage.id === "funding");
  return {
    needsFunding: funding?.status === "Not started" && deal.status !== "awaiting_provider",
    blocked: deal.status === "awaiting_provider",
  };
}

export async function loadActionInbox(account: AccountSession): Promise<InboxLoad> {
  let noticesFailed = false;
  let incident = "";
  let notices: InboxNotice[] = [];
  try {
    const rows = await listAccountNotices(account.id);
    notices = rows.map((row) => ({
      id: row.id,
      title: row.title,
      detail: row.detail,
      href: row.href.startsWith("/") ? row.href : "/collaboration/inbox",
      read: Boolean(row.readAt),
    }));
  } catch (error) {
    noticesFailed = true;
    incident = newIncidentReference();
    console.error("action inbox notices", incident, error);
  }

  try {
    const business = isBusinessRole(account.role);
    const contracts = await listContractsForUser(account.id, account.email);
    const signatureTasks = contracts
      .filter((contract) => contractNeedsSignature(contract, account.id, account.email))
      .map((contract) => ({
        id: contract.id,
        title: contract.title,
        href: `/collaboration/contracts/${contract.id}#sign`,
      }));
    if (business) {
      const workspace = await getWorkspace(account.id);
      const fundings =
        workspace.businessId && workspace.businessId !== "public"
          ? await listFundingsForBusiness(workspace.businessId)
          : [];
      const submissions = fundings.length
        ? await prisma.milestoneSubmission.findMany({
            where: { fundingId: { in: fundings.map((deal) => deal.id) } },
            select: { fundingId: true, milestoneId: true, version: true, status: true },
          })
        : [];
      const pendingResponses = workspace.inquiries.filter((inquiry) => leadIsOpen(inquiry.status)).length;
      const tasks = projectInboxTasks(
        inboxSourcesFromRecords({
          workspaceId: workspace.businessId || account.id,
          audience: "business",
          contracts: signatureTasks,
          invitations:
            pendingResponses > 0
              ? [
                  {
                    id: "business-responses",
                    title: `${pendingResponses} response${pendingResponses === 1 ? "" : "s"} to review`,
                    counterparty: "Influencer",
                    href: "/collaboration/business",
                  },
                ]
              : [],
          funding: fundings.map((deal) => {
            const attention = fundingAttention(deal);
            return {
              id: deal.id,
              title: deal.title,
              counterparty: deal.creatorSlug,
              href: `/payments?deal=${encodeURIComponent(deal.id)}`,
              ...attention,
            };
          }),
          submissions: submissions.map((row) => {
            const deal = fundings.find((item) => item.id === row.fundingId);
            return {
              ...row,
              title: deal?.title || "Submission",
              counterparty: deal?.creatorSlug || "Influencer",
            };
          }),
          payouts: fundings.map((deal) => ({
            id: deal.id,
            title: deal.title,
            counterparty: deal.creatorSlug,
            bankReturned: payoutReturned(deal),
          })),
          creatorDeliverables: [],
        }),
      );
      return { tasksFailed: false, noticesFailed, incident, tasks, notices };
    }

    const creator = await prisma.creator.findUnique({ where: { userId: account.id }, select: { slug: true } });
    const slug = creator?.slug ?? "";
    const fundings = slug ? await listFundingsForCreator(slug) : [];
    const { listTeamProposalsForCreator } = await import("@/lib/team-proposal");
    const [submissions, applications, teamProposals] = await Promise.all([
      fundings.length
        ? prisma.milestoneSubmission.findMany({
            where: { fundingId: { in: fundings.map((deal) => deal.id) } },
            select: { fundingId: true, milestoneId: true, version: true, status: true },
          })
        : Promise.resolve([]),
      slug
        ? prisma.marketplaceApplication.findMany({
            where: { toSlug: slug },
            select: {
              id: true,
              fromSlug: true,
              toSlug: true,
              status: true,
              turn: true,
              interestRecorded: true,
              openQuestion: true,
              responseDeadline: true,
              note: true,
              businessRequest: { select: { brand: true } },
            },
          })
        : Promise.resolve([]),
      slug ? listTeamProposalsForCreator(slug).catch(() => []) : Promise.resolve([]),
    ]);
    const covered = new Set(submissions.map((row) => row.milestoneId));
    const tasks = projectInboxTasks(
      inboxSourcesFromRecords({
        workspaceId: slug ? `creator:${slug}` : account.id,
        audience: "influencer",
        contracts: signatureTasks,
        invitations: applications
          .filter((row) => applicationIsInvitation(row) && invitationWaitingForInvitee(row))
          .map((row) => ({
            id: row.id,
            // Name the campaign (brief-based invitations have no request brand).
            title: row.note?.trim() || row.businessRequest?.brand || "Campaign invitation",
            counterparty: row.businessRequest?.brand || "Business",
            href: `/collaboration/applications/${row.id}`,
          }))
          // P1-AUD-04: pending team invitations are tasks too.
          .concat(
            teamProposals
              .filter(
                (proposal) =>
                  (proposal.status === "sent" || proposal.status === "partial") &&
                  proposal.members.some((member) => member.creatorSlug === slug && member.status === "invited"),
              )
              .map((proposal) => ({
                id: `team:${proposal.id}`,
                title: "Team invitation",
                counterparty: proposal.title,
                href: `/collaboration/team/${proposal.id}`,
              })),
          ),
        funding: fundings.map((deal) => {
          const attention = fundingAttention(deal);
          return {
            id: deal.id,
            title: deal.title,
            counterparty: deal.businessName,
            href: `/payments?deal=${encodeURIComponent(deal.id)}`,
            ...attention,
          };
        }),
        submissions: submissions.map((row) => {
          const deal = fundings.find((item) => item.id === row.fundingId);
          return {
            ...row,
            title: deal?.title || "Submission",
            counterparty: deal?.businessName || "Business",
          };
        }),
        payouts: fundings.map((deal) => ({
          id: deal.id,
          title: deal.title,
          counterparty: deal.businessName,
          bankReturned: payoutReturned(deal),
        })),
        creatorDeliverables: fundings.flatMap((deal) =>
          deal.milestones
            .filter((milestone) => !covered.has(milestone.id) && milestone.status === "pending")
            .map((milestone) => ({
              id: milestone.id,
              title: deal.title || milestone.title,
              counterparty: deal.businessName,
              href: `/collaboration/work/${deal.id}`,
              dueLabel: "No deadline",
            })),
        ),
      }),
    );
    return { tasksFailed: false, noticesFailed, incident, tasks, notices };
  } catch (error) {
    const reference = incident || newIncidentReference();
    console.error("action inbox", reference, error);
    return { tasksFailed: true, noticesFailed, incident: reference, tasks: [], notices };
  }
}
