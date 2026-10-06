import { prisma } from "@/lib/db";
import { explainMatchFromFactors, flattenSpecialtyCatalog, suggestSpecialties, type SpecialtySuggestion } from "@/lib/ai-suggest";
import { aiEndpointAllowed, routeAiFunction } from "@/lib/providers";
import { decryptSecret } from "@/lib/provider-secrets";
import { SPECIALTY_TAXONOMY } from "@/lib/seed-data";

function chatUrl(baseUrl: string): string | null {
  if (!aiEndpointAllowed(baseUrl)) return null;
  const url = new URL(baseUrl);
  if (url.hostname === "api.openai.com" && (url.pathname === "/" || url.pathname === "")) {
    url.pathname = "/v1/chat/completions";
  }
  if (url.hostname === "api.anthropic.com" && (url.pathname === "/" || url.pathname === "")) {
    url.pathname = "/v1/messages";
  }
  return url.toString();
}

function slugsFromBody(body: string, allowed: Set<string>): string[] {
  const match = body.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { slugs?: unknown };
    if (!Array.isArray(parsed.slugs)) return [];
    return parsed.slugs.filter((slug): slug is string => typeof slug === "string" && allowed.has(slug));
  } catch {
    return [];
  }
}

async function recordProviderFailure(functionKey: string, message: string) {
  try {
    await prisma.job.create({
      data: {
        kind: "ai_provider",
        status: "failed",
        lastError: message.slice(0, 500),
        attempts: 1,
        payload: { functionKey },
      },
    });
  } catch {
    /* the fallback suggestion still returns */
  }
}

type FailureRecorder = (functionKey: string, message: string) => Promise<void>;
let failureRecorder: FailureRecorder = recordProviderFailure;

export function setAiFailureRecorderForTests(next: FailureRecorder | null) {
  failureRecorder = next ?? recordProviderFailure;
}

type AiRouteOverride = { endpoint: string; secret: string; model?: string };

function jsonFromAssistant(raw: string): unknown {
  let text = raw;
  try {
    const parsed = JSON.parse(raw) as {
      choices?: { message?: { content?: unknown } }[];
      content?: { text?: unknown }[];
    };
    const openai = parsed.choices?.[0]?.message?.content;
    if (typeof openai === "string") text = openai;
    const anthropic = parsed.content?.[0]?.text;
    if (typeof anthropic === "string") text = anthropic;
  } catch {
    /* the body itself may be the JSON object */
  }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function postChat(input: {
  endpoint: string;
  secret: string;
  model: string;
  prompt: string;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const host = new URL(input.endpoint).hostname;
  const init: RequestInit =
    host === "api.anthropic.com"
      ? {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": input.secret,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: input.model || "claude-3-5-haiku-latest",
            max_tokens: 400,
            messages: [{ role: "user", content: input.prompt }],
          }),
        }
      : {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${input.secret}` },
          body: JSON.stringify({
            model: input.model || "gpt-4o-mini",
            messages: [{ role: "user", content: input.prompt }],
          }),
        };
  const response = await fetchImpl(input.endpoint, { ...init, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Provider returned ${response.status}`);
  return response.text();
}

async function resolveAiRoute(functionKey: string, override?: AiRouteOverride | null) {
  if (override) return override;
  if (override === null) return null;
  const route = await prisma.aiFunctionRoute
    .findUnique({ where: { functionKey }, include: { provider: true } })
    .catch(() => null);
  const decision = routeAiFunction({
    functionKey,
    providerCode: route?.provider?.code,
    providerEnabled: route?.provider?.enabled,
    hasSecret: Boolean(route?.provider?.secretCipher),
    routeEnabled: route?.enabled,
  });
  if (decision.mode === "fallback" || !route?.provider) return null;
  const endpoint = chatUrl(route.provider.baseUrl ?? "");
  const secret = route.provider.secretCipher ? decryptSecret(route.provider.secretCipher) : null;
  if (!endpoint || !secret) return null;
  const model =
    typeof route.provider.extraJson === "object" &&
    route.provider.extraJson &&
    "model" in route.provider.extraJson &&
    typeof (route.provider.extraJson as { model?: string }).model === "string"
      ? (route.provider.extraJson as { model: string }).model
      : "";
  return { endpoint, secret, model };
}

/**
 * Suggest specialties. A disabled, missing, or failing provider leaves the keyword list.
 * This does not write the profile.
 */
export async function classifyProfileTopics(text: string): Promise<{
  suggestions: SpecialtySuggestion[];
  source: "fallback" | "provider";
  providerError?: string;
}> {
  const catalog = flattenSpecialtyCatalog(SPECIALTY_TAXONOMY);
  const fallback = suggestSpecialties(text, catalog, 3);
  const route = await prisma.aiFunctionRoute
    .findUnique({
      where: { functionKey: "profile_topic_classification" },
      include: { provider: true },
    })
    .catch(() => null);
  const decision = routeAiFunction({
    functionKey: "profile_topic_classification",
    providerCode: route?.provider?.code,
    providerEnabled: route?.provider?.enabled,
    hasSecret: Boolean(route?.provider?.secretCipher),
    routeEnabled: route?.enabled,
  });
  if (decision.mode === "fallback" || !route?.provider) return { suggestions: fallback, source: "fallback" };
  const endpoint = chatUrl(route.provider.baseUrl ?? "");
  const secret = route.provider.secretCipher ? decryptSecret(route.provider.secretCipher) : null;
  if (!endpoint || !secret) return { suggestions: fallback, source: "fallback" };
  const allowed = new Set(catalog.map((item) => item.slug));
  const model =
    typeof route.provider.extraJson === "object" &&
    route.provider.extraJson &&
    "model" in route.provider.extraJson &&
    typeof (route.provider.extraJson as { model?: string }).model === "string"
      ? (route.provider.extraJson as { model: string }).model
      : "";
  const prompt = `Suggest up to 3 specialty slugs from this list only: ${[...allowed].join(", ")}. Profile:\n${text.slice(0, 1200)}\nReply with JSON {"slugs":[]} only.`;
  const host = new URL(endpoint).hostname;
  const init: RequestInit =
    host === "api.anthropic.com"
      ? {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": secret,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: model || "claude-3-5-haiku-latest",
            max_tokens: 200,
            messages: [{ role: "user", content: prompt }],
          }),
        }
      : {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
          body: JSON.stringify({
            model: model || "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
          }),
        };
  try {
    const response = await fetch(endpoint, { ...init, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    const raw = await response.text();
    const slugs = slugsFromBody(raw, allowed);
    if (!slugs.length) return { suggestions: fallback, source: "fallback" };
    const suggestions = slugs.slice(0, 3).map((slug) => {
      const item = catalog.find((row) => row.slug === slug);
      return { slug, name: item?.name ?? slug, reason: "The assigned provider suggested this specialty. Confirm it before it is saved." };
    });
    return { suggestions, source: "provider" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider call failed";
    await recordProviderFailure("profile_topic_classification", message);
    return { suggestions: fallback, source: "fallback", providerError: message };
  }
}

/** Deterministic explanation. The collaboration page keeps its stored factor list. */
export function suggestMatchExplanation(factors: { label: string; value: number }[]) {
  return explainMatchFromFactors(factors);
}

export function rankCreatorsByBrief(brief: string, creators: { slug: string; specialties: string[] }[]) {
  const words = brief
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
  return creators
    .map((creator) => {
      const hay = creator.specialties.join(" ").toLowerCase();
      const score = words.reduce((total, word) => total + (hay.includes(word) ? 1 : 0), 0);
      return { slug: creator.slug, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .map((row) => row.slug);
}

export function emptyProfileDraft() {
  return { title: "", bio: "", specialties: [] as string[] };
}

async function providerJson(functionKey: string, prompt: string, options?: { fetchImpl?: typeof fetch; route?: AiRouteOverride | null }) {
  const route = await resolveAiRoute(functionKey, options?.route);
  if (!route) return { ok: false as const, unassigned: options?.route !== undefined ? options.route === null : true };
  try {
    const raw = await postChat({ ...route, model: route.model ?? "", prompt, fetchImpl: options?.fetchImpl });
    const json = jsonFromAssistant(raw);
    if (!json || typeof json !== "object") throw new Error("Provider response was not the expected JSON.");
    return { ok: true as const, json };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider call failed";
    await failureRecorder(functionKey, message);
    return { ok: false as const, unassigned: false, message };
  }
}

export async function explainCollaborationMatch(
  factors: { label: string; value: number }[],
  options?: { fetchImpl?: typeof fetch; route?: AiRouteOverride | null },
): Promise<{ explanation: string; source: "rules" | "provider" }> {
  const rules = explainMatchFromFactors(factors);
  const called = await providerJson(
    "collaboration_match_explanation",
    `Explain this collaboration match. Reply with JSON {"explanation":""} only. Factors: ${JSON.stringify(factors).slice(0, 1500)}`,
    options,
  );
  if (!called.ok) return { explanation: rules, source: "rules" };
  const explanation = (called.json as { explanation?: unknown }).explanation;
  if (typeof explanation !== "string" || !explanation.trim()) {
    await failureRecorder("collaboration_match_explanation", "Provider JSON did not include an explanation.");
    return { explanation: rules, source: "rules" };
  }
  return { explanation: explanation.trim(), source: "provider" };
}

export async function matchCreatorsForBrief(
  input: { brief: string; creators: { slug: string; specialties: string[] }[] },
  options?: { fetchImpl?: typeof fetch; route?: AiRouteOverride | null },
): Promise<{ slugs: string[]; source: "rules" | "provider" }> {
  const rules = rankCreatorsByBrief(input.brief, input.creators);
  const allowed = new Set(input.creators.map((creator) => creator.slug));
  const called = await providerJson(
    "business_creator_match",
    `Rank creator slugs for this brief. Use only these slugs: ${[...allowed].join(", ")}. Reply with JSON {"slugs":[]} only. Brief:\n${input.brief.slice(0, 1500)}`,
    options,
  );
  if (!called.ok) return { slugs: rules, source: "rules" };
  const slugs = (called.json as { slugs?: unknown }).slugs;
  if (!Array.isArray(slugs)) {
    await failureRecorder("business_creator_match", "Provider JSON did not include slugs.");
    return { slugs: rules, source: "rules" };
  }
  const picked = slugs.filter((slug): slug is string => typeof slug === "string" && allowed.has(slug));
  if (!picked.length) {
    await failureRecorder("business_creator_match", "Provider JSON did not include a known creator slug.");
    return { slugs: rules, source: "rules" };
  }
  return { slugs: picked, source: "provider" };
}

export async function extractProfileDraft(
  text: string,
  options?: { fetchImpl?: typeof fetch; route?: AiRouteOverride | null },
): Promise<{ title: string; bio: string; specialties: string[]; source: "rules" | "provider" }> {
  const rules = emptyProfileDraft();
  const called = await providerJson(
    "profile_draft_extraction",
    `Extract a profile draft. Reply with JSON {"title":"","bio":"","specialties":[]} only. Source:\n${text.slice(0, 1500)}`,
    options,
  );
  if (!called.ok) return { ...rules, source: "rules" };
  const record = called.json as { title?: unknown; bio?: unknown; specialties?: unknown };
  if (typeof record.title !== "string" || typeof record.bio !== "string" || !Array.isArray(record.specialties)) {
    await failureRecorder("profile_draft_extraction", "Provider JSON did not match the profile draft schema.");
    return { ...rules, source: "rules" };
  }
  const specialties = record.specialties.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return { title: record.title.trim(), bio: record.bio.trim(), specialties, source: "provider" };
}
