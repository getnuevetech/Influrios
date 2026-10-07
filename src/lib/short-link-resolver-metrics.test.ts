import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SHORT_LINK_RESOLVER_METRIC_EVENT,
  classifyResolverOutcome,
  pathKindFromPath,
  resolverMetricMeta,
  summarizeResolverMetrics,
} from "./short-link-resolver-metrics";

describe("short-link resolver metrics (W5 / §20)", () => {
  it("classifies redirect and page outcomes", () => {
    assert.equal(
      classifyResolverOutcome({ kind: "redirect", status: 302, eventType: "resolve" }),
      "redirect",
    );
    assert.equal(
      classifyResolverOutcome({
        kind: "page",
        status: 200,
        title: "Influrios short links",
      }),
      "root",
    );
    assert.equal(
      classifyResolverOutcome({ kind: "page", status: 404, title: "Link not found" }),
      "not_found",
    );
    assert.equal(
      classifyResolverOutcome({ kind: "page", status: 403, title: "Link unavailable" }),
      "suspended",
    );
    assert.equal(
      classifyResolverOutcome({ kind: "page", status: 404, title: "Reserved" }),
      "reserved",
    );
    assert.equal(
      classifyResolverOutcome({ kind: "page", status: 404, title: "Unknown short domain" }),
      "unknown_host",
    );
    assert.equal(
      classifyResolverOutcome({ kind: "page", status: 404, title: "Destination blocked" }),
      "destination_blocked",
    );
    assert.equal(
      classifyResolverOutcome({
        kind: "page",
        status: 503,
        title: "Influrios",
      }),
      "unavailable",
    );
  });

  it("labels path kinds and shapes metric meta", () => {
    assert.equal(pathKindFromPath("/"), "root");
    assert.equal(pathKindFromPath("/q/abc123"), "qr");
    assert.equal(pathKindFromPath("/n/abc123"), "nfc");
    assert.equal(pathKindFromPath("/c/spring-launch"), "campaign");
    assert.equal(pathKindFromPath("/sofia-martinez"), "slug");
    assert.equal(pathKindFromPath("/weird/path"), "other");
    const meta = resolverMetricMeta({
      outcome: "redirect",
      status: 302,
      latencyMs: 12.4,
      pathKind: "slug",
      shortLinkId: "lnk_1",
      eventType: "resolve",
    });
    assert.equal(meta.latencyMs, 12);
    assert.equal(meta.outcome, "redirect");
    assert.equal(SHORT_LINK_RESOLVER_METRIC_EVENT, "short_link_resolver_outcome");
  });

  it("rolls up outcomes and latency percentiles", () => {
    const rollup = summarizeResolverMetrics(
      [
        { metaJson: { outcome: "redirect", latencyMs: 10 } },
        { metaJson: { outcome: "redirect", latencyMs: 20 } },
        { metaJson: { outcome: "not_found", latencyMs: 30 } },
        { metaJson: { outcome: "suspended", latencyMs: 40 } },
        { metaJson: { outcome: "error", latencyMs: 100 } },
      ],
      24,
    );
    assert.equal(rollup.total, 5);
    assert.equal(rollup.redirects, 2);
    assert.equal(rollup.failures, 3);
    assert.equal(rollup.byOutcome.redirect, 2);
    assert.equal(rollup.byOutcome.not_found, 1);
    assert.equal(rollup.p50LatencyMs, 30);
    assert.equal(rollup.p95LatencyMs, 100);
  });
});
