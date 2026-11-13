"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import {
  addRosterMember,
  agencyWorkspaceIdForOwner,
  createAgencyCampaign,
  createAgencyClient,
  createJointPortfolio,
  linkAgencyCampaignCollaboration,
  parsePortfolioMetricLines,
  setCampaignStatus,
  setPortfolioPublished,
  type AgencyCampaign,
} from "@/lib/agency";
import {
  agencyActionAllowed,
  clientBelongsToWorkspace,
  inviteRoleAllowed,
  postedContextMatches,
  readAgencyActionContext,
  type AgencyPermission,
} from "@/lib/agency-context";
import { inviteAgencySeat, resolveAgencySeatForWorkspace, revokeAgencySeatInvite } from "@/lib/agency-seats";
import { prisma } from "@/lib/db";
import { productSwitch } from "@/lib/product-switches";

function agencyReturn(workspaceId: string, clientId: string, extra?: Record<string, string>) {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspace", workspaceId);
  if (clientId) params.set("client", clientId);
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/agency?${query}` : "/agency";
}

async function requireAgencyAction(formData: FormData, action: AgencyPermission) {
  const account = await getAccountSession();
  if (!account?.emailVerifiedAt) {
    redirect("/agency?error=" + encodeURIComponent("Sign in with a verified email to continue."));
  }
  const sealed = readAgencyActionContext(String(formData.get("context") ?? ""), account.id);
  if (!sealed) {
    redirect("/agency?error=" + encodeURIComponent("This form is no longer valid. Reopen the workspace and try again."));
  }
  const posted = {
    workspaceId: String(formData.get("workspaceId") ?? "").trim(),
    clientId: String(formData.get("clientId") ?? "").trim(),
  };
  if (!postedContextMatches(sealed, posted)) {
    redirect(
      agencyReturn(sealed.workspaceId, sealed.clientId, {
        error: "This form stays on the workspace and client it was opened for.",
      }),
    );
  }
  const seatsOn = await productSwitch("agency_seats");
  let role: string | null = null;
  if (seatsOn) {
    const seat = await resolveAgencySeatForWorkspace({
      userId: account.id,
      email: account.email,
      workspaceId: sealed.workspaceId,
    });
    if (!seat) {
      redirect(
        "/agency?error=" + encodeURIComponent("This membership cannot act on that workspace."),
      );
    }
    role = seat.role === "owner" || seat.role === "manager" || seat.role === "member" ? seat.role : null;
  } else if (sealed.workspaceId === agencyWorkspaceIdForOwner(account.id)) {
    role = "owner";
  }
  if (!agencyActionAllowed(role, action)) {
    redirect(
      agencyReturn(sealed.workspaceId, sealed.clientId, {
        error: "Your role on this workspace cannot do that.",
      }),
    );
  }
  if (sealed.clientId) {
    const client = await prisma.agencyClient.findUnique({ where: { id: sealed.clientId } });
    if (!clientBelongsToWorkspace(client, sealed.workspaceId)) {
      redirect(
        agencyReturn(sealed.workspaceId, "", {
          error: "That client is not in this workspace.",
        }),
      );
    }
  }
  return { account, workspaceId: sealed.workspaceId, clientId: sealed.clientId, role };
}

export async function actionAddClient(formData: FormData) {
  const ctx = await requireAgencyAction(formData, "act_for_client");
  try {
    const client = await createAgencyClient({
      workspaceId: ctx.workspaceId,
      name: String(formData.get("name") ?? ""),
    });
    revalidatePath("/agency");
    redirect(agencyReturn(ctx.workspaceId, client.id, { view: "clients", clientSaved: "1" }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "client_failed";
    redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { error: msg }));
  }
}

export async function actionAddRoster(formData: FormData) {
  const ctx = await requireAgencyAction(formData, "manage_roster");
  const creatorSlug = String(formData.get("creatorSlug") ?? "");
  try {
    await addRosterMember({
      workspaceId: ctx.workspaceId,
      creatorSlug,
      role: (String(formData.get("role") ?? "talent") as "talent" | "lead" | "specialist") || "talent",
      retainerLabel: String(formData.get("retainerLabel") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "add_failed";
    redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { error: msg }));
  }
  revalidatePath("/agency");
  revalidatePath("/admin/agency");
  redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { view: "roster", roster: creatorSlug }));
}

export async function actionCreateCampaign(formData: FormData) {
  const ctx = await requireAgencyAction(formData, "manage_campaign");
  if (!ctx.clientId) {
    redirect(agencyReturn(ctx.workspaceId, "", { error: "Choose a client for this campaign." }));
  }
  const creatorSlugs = String(formData.get("creatorSlugs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    await createAgencyCampaign({
      workspaceId: ctx.workspaceId,
      clientId: ctx.clientId,
      clientName: "",
      title: String(formData.get("title") ?? ""),
      specialty: String(formData.get("specialty") ?? ""),
      budgetLabel: String(formData.get("budgetLabel") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      creatorSlugs,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "campaign_failed";
    redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { error: msg }));
  }
  revalidatePath("/agency");
  revalidatePath("/admin/agency");
  redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { view: "campaigns", campaign: "1" }));
}

export async function actionLinkCampaignAgreement(formData: FormData) {
  const ctx = await requireAgencyAction(formData, "manage_campaign");
  try {
    await linkAgencyCampaignCollaboration({
      workspaceId: ctx.workspaceId,
      campaignId: String(formData.get("id") ?? ""),
      creatorSlug: String(formData.get("creatorSlug") ?? ""),
      collaborationId: String(formData.get("collaborationId") ?? ""),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "link_failed";
    redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { error: msg }));
  }
  revalidatePath("/agency");
  redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { view: "campaigns", linked: "1" }));
}

export async function actionSetCampaignStatus(formData: FormData) {
  const ctx = await requireAgencyAction(formData, "set_campaign_status");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as AgencyCampaign["status"];
  try {
    await setCampaignStatus(id, status, ctx.workspaceId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "status_failed";
    redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { error: msg }));
  }
  revalidatePath("/agency");
  revalidatePath("/admin/agency");
  redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { view: "campaigns", status: id }));
}

export async function actionCreatePortfolio(formData: FormData) {
  const ctx = await requireAgencyAction(formData, "manage_portfolio");
  const metrics = parsePortfolioMetricLines(String(formData.get("metrics") ?? ""));
  try {
    await createJointPortfolio({
      workspaceId: ctx.workspaceId,
      title: String(formData.get("title") ?? ""),
      tagline: String(formData.get("tagline") ?? ""),
      leftSlug: String(formData.get("leftSlug") ?? ""),
      rightSlug: String(formData.get("rightSlug") ?? ""),
      specialty: String(formData.get("specialty") ?? ""),
      outcome: String(formData.get("outcome") ?? ""),
      metrics,
      campaignId: String(formData.get("campaignId") ?? "") || undefined,
      published: formData.get("published") === "on",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "portfolio_failed";
    redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { error: msg }));
  }
  revalidatePath("/agency");
  revalidatePath("/collaboration");
  revalidatePath("/admin/agency");
  redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { portfolio: "1" }));
}

export async function actionTogglePortfolio(formData: FormData) {
  const ctx = await requireAgencyAction(formData, "manage_portfolio");
  const id = String(formData.get("id") ?? "");
  const published = formData.get("published") === "1";
  try {
    await setPortfolioPublished(id, published, ctx.workspaceId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "toggle_failed";
    redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { error: msg }));
  }
  revalidatePath("/agency");
  revalidatePath("/collaboration");
  revalidatePath("/admin/agency");
  redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { toggled: id }));
}

export async function actionInviteAgencySeat(formData: FormData) {
  const ctx = await requireAgencyAction(formData, "manage_team");
  const requestedRole = String(formData.get("role") ?? "");
  if (!inviteRoleAllowed(ctx.role, requestedRole)) {
    redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { view: "team", error: "Your role cannot invite that seat." }));
  }
  try {
    await inviteAgencySeat({
      email: String(formData.get("email") ?? ""),
      role: requestedRole,
      workspaceId: ctx.workspaceId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "seat_failed";
    redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { view: "team", error: msg }));
  }
  revalidatePath("/agency");
  revalidatePath("/admin/agency");
  redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { view: "team", seat: "invited" }));
}

export async function actionRevokeAgencySeat(formData: FormData) {
  const ctx = await requireAgencyAction(formData, "manage_team");
  try {
    await revokeAgencySeatInvite(String(formData.get("email") ?? ""), ctx.workspaceId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "seat_failed";
    redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { view: "team", error: msg }));
  }
  revalidatePath("/agency");
  revalidatePath("/admin/agency");
  redirect(agencyReturn(ctx.workspaceId, ctx.clientId, { view: "team", seat: "revoked" }));
}
