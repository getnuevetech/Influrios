import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { brandedFallbackHtml } from "./short-link";

describe("branded short-link failure page (W5)", () => {
  it("includes Influrios CTA and optional outcome marker", () => {
    const html = brandedFallbackHtml("Link not found", "That Influrios short link does not exist.", {
      canonicalOrigin: "https://influrios.com",
      outcome: "not_found",
      ctaLabel: "Open Influrios",
    });
    assert.match(html, /Open Influrios/);
    assert.match(html, /href="https:\/\/influrios\.com"/);
    assert.match(html, /data-resolve-outcome="not_found"/);
    assert.match(html, /That Influrios short link does not exist/);
    assert.match(html, /Influencer profiles and collaborations live on Influrios/);
    assert.equal(html.includes("Sofia Carter"), false);
    assert.equal(html.includes("Georgia"), false);
  });
});
