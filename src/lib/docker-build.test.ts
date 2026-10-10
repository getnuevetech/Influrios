import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("production image build", () => {
  it("ships local font files so next build does not fetch Google Fonts", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    assert.equal(layout.includes('from "next/font/google"'), false);
    assert.match(layout, /from "next\/font\/local"/);
    const paths = [...layout.matchAll(/path: "\.\.\/fonts\/([^"]+\.woff2)"/g)].map((match) => match[1]);
    assert.deepEqual(paths, [
      "plus-jakarta-sans-latin-400-normal.woff2",
      "plus-jakarta-sans-latin-500-normal.woff2",
      "plus-jakarta-sans-latin-600-normal.woff2",
      "plus-jakarta-sans-latin-700-normal.woff2",
      "sora-latin-600-normal.woff2",
      "sora-latin-700-normal.woff2",
      "caveat-latin-500-normal.woff2",
      "caveat-latin-600-normal.woff2",
      "caveat-latin-700-normal.woff2",
    ]);
    for (const name of paths) {
      const bytes = readFileSync(`src/fonts/${name}`);
      assert.equal(bytes.subarray(0, 4).toString(), "wOF2", name);
      assert.ok(bytes.length > 1000, name);
    }
  });

  it("adds swap when SwapTotal is under 2G and stops databases on a small host", () => {
    const swap = readFileSync("deploy/scripts/ensure-swap.sh", "utf8");
    assert.match(swap, /SwapTotal:/);
    assert.match(swap, /MIN_SWAP_KB:-2000000/);
    assert.equal(swap.includes("swapon --show | grep -q ."), false);
    const deploy = readFileSync("deploy/scripts/deploy.sh", "utf8");
    assert.match(deploy, /MemTotal:/);
    assert.match(deploy, /total_kb\}" -lt 3500000/);
    assert.match(deploy, /docker compose stop web meilisearch postgres/);
    assert.equal(deploy.includes('curl -fsSI "http://127.0.0.1/"'), false);
    assert.match(deploy, /NEXT_PUBLIC_APP_URL/);
  });
});
