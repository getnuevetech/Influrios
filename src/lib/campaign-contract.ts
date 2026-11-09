import type { CampaignBrief } from "@/lib/business";

/** Parse a campaign budget string into a dollar amount for the contract wizard. */
export function budgetToGrossDollars(budget: string, currency?: string | null): string {
  const raw = budget.trim();
  if (!raw) return "";
  const amount = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return "";
  void currency;
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
export type ContractRequestTerms = {
  title: string;
  scope: string;
  commercial: string;
  gross: string;
  currency: string;
};

/**
 * Copy the request into the contract. Known title, scope, value, and currency
 * stay filled. Fields the request does not have stay blank so they can be added.
 */
export function contractTermsFromRequest(input: {
  brief?: Pick<
    CampaignBrief,
    "title" | "goal" | "summary" | "collabType" | "timeframe" | "platform" | "specialty" | "budget" | "budgetCurrency"
  > | null;
  title?: string | null;
  summary?: string | null;
  deliverables?: string | null;
  offerText?: string | null;
  budget?: string | null;
  currency?: string | null;
}): ContractRequestTerms {
  const title = (input.brief?.title || input.title || "").trim();
  const scope = uniqueParts([
    input.brief ? campaignScopeFromBrief(input.brief) : "",
    input.deliverables,
    input.summary,
  ]);
  const commercial = uniqueParts([
    input.brief ? campaignCommercialFromBrief(input.brief) : "",
    input.offerText,
  ]);
  const currency = (input.brief?.budgetCurrency || input.currency || "").trim().toUpperCase();
  const code = /^[A-Z]{3}$/.test(currency) ? currency : "";
  const gross =
    budgetToGrossDollars(input.brief?.budget || input.budget || "", code) ||
    budgetToGrossDollars(input.offerText || "", code);
  return { title, scope, commercial, gross, currency: code };
}

/** Keep a longer request value when the form only has a shorter copy of it. */
export function preferContractField(submitted: string | null | undefined, fromRequest: string) {
  const typed = (submitted ?? "").trim();
  const known = fromRequest.trim();
  if (!typed) return known;
  if (!known) return typed;
  if (known.includes(typed) || typed.includes(known)) return typed.length >= known.length ? typed : known;
  return typed;
}

function uniqueParts(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const part of parts) {
    const value = (part ?? "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    kept.push(value);
  }
  return kept.join("\n");
}

/** Create-contract is available after the business shortlists an accepted influencer. */
export function contractOfferReady(input: {
  status: string;
  creatorSlug: string | null | undefined;
  shortlistedSlugs: string[];
}): boolean {
  const accepted = input.status === "ACCEPTED" || input.status === "COLLABORATION_DRAFTED";
  const slug = (input.creatorSlug ?? "").trim();
  return accepted && Boolean(slug) && input.shortlistedSlugs.includes(slug);
}

export function contractHrefFromCampaign(input: {
  creatorSlug: string;
  brief?: CampaignBrief | null;
  collaborationId?: string | null;
  teamId?: string | null;
  applicationId?: string | null;
  request?: { title?: string | null; budget?: string | null; currency?: string | null; summary?: string | null } | null;
}) {
  const params = new URLSearchParams();
  const creator = input.creatorSlug.trim();
  if (creator) params.set("creator", creator);
  if (input.collaborationId?.trim()) params.set("collaboration", input.collaborationId.trim());
  if (input.applicationId?.trim()) params.set("application", input.applicationId.trim());
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
    const currency = (brief.budgetCurrency || "").trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(currency)) params.set("currency", currency);
  } else if (input.request) {
    const title = (input.request.title ?? "").trim();
    if (title) params.set("title", title);
    const summary = (input.request.summary ?? "").trim();
    if (summary) params.set("scope", summary);
    const gross = budgetToGrossDollars(input.request.budget ?? "", input.request.currency);
    if (gross) params.set("gross", gross);
    const currency = (input.request.currency ?? "").trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(currency)) params.set("currency", currency);
  }
  const qs = params.toString();
  return qs ? `/collaboration/contract?${qs}` : "/collaboration/contract";
}

/** Campaign intents that are closed (accepted / contracted) cannot be edited. */
export function campaignEditLocked(brief: Pick<CampaignBrief, "status">) {
  return brief.status === "closed";
}
