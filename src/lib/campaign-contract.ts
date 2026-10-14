import type { CampaignBrief } from "@/lib/business";

/** Parse a campaign budget string into a dollar amount for the contract wizard. */
export function budgetToGrossDollars(budget: string, currency?: string | null): string {
  const raw = budget.trim();
  if (!raw) return "";
  const amount = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return "";
  const code = (currency || "").trim().toUpperCase();
  // Wizard gross field is USD-denominated today — still pass the numeric budget when currency is USD or blank.
  if (code && code !== "USD") return String(amount);
  return String(amount);
}

/** Scope text for the contract wizard from campaign intent fields. */
export function campaignScopeFromBrief(brief: Pick<CampaignBrief, "goal" | "summary" | "collabType" | "timeframe" | "platform">) {
  return [brief.goal, brief.summary, brief.collabType, brief.timeframe, brief.platform]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
}

/** Commercial line for the contract wizard from campaign intent. */
export function campaignCommercialFromBrief(brief: Pick<CampaignBrief, "collabType" | "goal" | "specialty">) {
  return [brief.collabType, brief.goal, brief.specialty].map((part) => part.trim()).filter(Boolean).join(" · ");
}

/**
 * Builder for /collaboration/contract with campaign intent already applied.
 * Prefer this over bare ?creator= so the wizard does not re-ask title/budget/scope.
 */
export function contractHrefFromCampaign(input: {
  creatorSlug: string;
  brief?: CampaignBrief | null;
  collaborationId?: string | null;
  teamId?: string | null;
}) {
  const params = new URLSearchParams();
  const creator = input.creatorSlug.trim();
  if (creator) params.set("creator", creator);
  if (input.collaborationId?.trim()) params.set("collaboration", input.collaborationId.trim());
  if (input.teamId?.trim()) params.set("team", input.teamId.trim());
  const brief = input.brief;
  if (brief) {
    params.set("brief", brief.id);
    if (brief.title.trim()) params.set("title", brief.title.trim());
    const scope = campaignScopeFromBrief(brief);
    if (scope) params.set("scope", scope);
    const commercial = campaignCommercialFromBrief(brief);
    if (commercial) params.set("commercial", commercial);
    const gross = budgetToGrossDollars(brief.budget, brief.budgetCurrency);
    if (gross) params.set("gross", gross);
  }
  const qs = params.toString();
  return qs ? `/collaboration/contract?${qs}` : "/collaboration/contract";
}

/** Campaign intents that are closed (accepted / contracted) cannot be edited. */
export function campaignEditLocked(brief: Pick<CampaignBrief, "status">) {
  return brief.status === "closed";
}
