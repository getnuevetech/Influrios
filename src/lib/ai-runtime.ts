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
