/**
 * W5 / INFLR.me Spec §20 — observable short-link resolver metrics (ops, not creator analytics).
 * Every resolve records an outcome + latency so admin can see miss/suspend/error rates.
 */

import { prisma } from "@/lib/db";
import { parseShortPath } from "@/lib/short-link-phase4";
import type { Prisma } from "@prisma/client";

export const SHORT_LINK_RESOLVER_METRIC_EVENT = "short_link_resolver_outcome";

export const RESOLVER_OUTCOMES = [
  "redirect",
  "root",
  "not_found",
  "reserved",
  "unknown_host",
  "suspended",
  "destination_blocked",
  "unavailable",
  "error",
] as const;

export type ResolverOutcome = (typeof RESOLVER_OUTCOMES)[number];

export type ResolveHitForMetrics = {
  kind: "redirect" | "page";
  status: number;
  title?: string;
  eventType?: string;
  shortLinkId?: string;
};

/** Map a resolve hit to a stable ops outcome label. */
export function classifyResolverOutcome(hit: ResolveHitForMetrics): ResolverOutcome {
  if (hit.kind === "redirect") return "redirect";
  const title = (hit.title || "").toLowerCase();
  if (hit.status === 200 && title.includes("short link")) return "root";
  if (hit.status === 403 || title.includes("unavailable") || title.includes("suspended")) return "suspended";
  if (title.includes("reserved")) return "reserved";
  if (title.includes("unknown short domain") || title.includes("unknown")) return "unknown_host";
  if (title.includes("destination blocked") || title.includes("allow list")) return "destination_blocked";
  if (hit.status === 503 || title.includes("could not be resolved")) return "unavailable";
  if (hit.status >= 500) return "error";
  if (hit.status === 404) return "not_found";
  return "not_found";
}

export function resolverMetricMeta(input: {
  outcome: ResolverOutcome;
  status: number;
  latencyMs: number;
  pathKind: string;
  shortLinkId?: string | null;
  eventType?: string | null;
}): Record<string, unknown> {
  return {
    outcome: input.outcome,
    status: input.status,
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
    pathKind: String(input.pathKind || "unknown").slice(0, 40),
    shortLinkId: input.shortLinkId ? String(input.shortLinkId).slice(0, 40) : null,
    resolveEventType: input.eventType ? String(input.eventType).slice(0, 40) : null,
  };
}

export function pathKindFromPath(path: string): string {
  const parsed = parseShortPath(path);
  return parsed.kind === "unknown" ? "other" : parsed.kind;
}

export async function recordResolverMetric(input: {
  hit: ResolveHitForMetrics;
  latencyMs: number;
  path: string;
}): Promise<ResolverOutcome> {
  const outcome = classifyResolverOutcome(input.hit);
  const meta = resolverMetricMeta({
    outcome,
    status: input.hit.status,
    latencyMs: input.latencyMs,
    pathKind: pathKindFromPath(input.path),
    shortLinkId: input.hit.kind === "redirect" ? input.hit.shortLinkId : null,
    eventType: input.hit.kind === "redirect" ? input.hit.eventType : null,
  });
  try {
    await prisma.analyticsEvent.create({
      data: {
        eventType: SHORT_LINK_RESOLVER_METRIC_EVENT,
        metaJson: meta as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("resolver metric failed", error);
  }
  return outcome;
}

export type ResolverMetricsRollup = {
  windowHours: number;
  total: number;
  byOutcome: Record<ResolverOutcome, number>;
  redirects: number;
  failures: number;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
};

function metaRecord(meta: unknown): Record<string, unknown> {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) return meta as Record<string, unknown>;
  return {};
}

export function summarizeResolverMetrics(
  rows: Array<{ metaJson: unknown }>,
  windowHours: number,
): ResolverMetricsRollup {
  const byOutcome = Object.fromEntries(RESOLVER_OUTCOMES.map((o) => [o, 0])) as Record<
    ResolverOutcome,
    number
  >;
  const latencies: number[] = [];
  for (const row of rows) {
    const meta = metaRecord(row.metaJson);
    const outcome = String(meta.outcome || "");
    if ((RESOLVER_OUTCOMES as readonly string[]).includes(outcome)) {
      byOutcome[outcome as ResolverOutcome] += 1;
    }
    const latency = Number(meta.latencyMs);
    if (Number.isFinite(latency) && latency >= 0) latencies.push(latency);
  }
  latencies.sort((a, b) => a - b);
  const percentile = (p: number) => {
    if (!latencies.length) return null;
    const idx = Math.min(latencies.length - 1, Math.max(0, Math.ceil(latencies.length * p) - 1));
    return latencies[idx] ?? null;
  };
  const redirects = byOutcome.redirect;
  const failures =
    byOutcome.not_found +
    byOutcome.reserved +
    byOutcome.unknown_host +
    byOutcome.suspended +
    byOutcome.destination_blocked +
    byOutcome.unavailable +
    byOutcome.error;
  return {
    windowHours,
    total: rows.length,
    byOutcome,
    redirects,
    failures,
    p50LatencyMs: percentile(0.5),
    p95LatencyMs: percentile(0.95),
  };
}

export async function getResolverMetricsRollup(windowHours = 24): Promise<ResolverMetricsRollup> {
  const hours = Math.min(168, Math.max(1, Math.floor(windowHours)));
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const rows = await prisma.analyticsEvent.findMany({
    where: {
      eventType: SHORT_LINK_RESOLVER_METRIC_EVENT,
      createdAt: { gte: since },
    },
    select: { metaJson: true },
    take: 10_000,
    orderBy: { createdAt: "desc" },
  });
  return summarizeResolverMetrics(rows, hours);
}
