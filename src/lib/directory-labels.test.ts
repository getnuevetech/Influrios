import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { directoryLabels, profilePlace } from "./directory";

describe("directory labels", () => {
  it("does not assign a rank and follows the open-to-collab flag", () => {
    assert.deepEqual(directoryLabels(true), {
      badge: "",
      statusLabel: "Open to partnerships",
    });
    assert.deepEqual(directoryLabels(false), {
      badge: "",
      statusLabel: "Not open to partnerships",
    });
    const directory = readFileSync("src/lib/directory.ts", "utf8");
    const card = readFileSync("src/components/creator-card.tsx", "utf8");
    assert.equal(directory.includes('badge: "Rising Star"'), false);
    assert.equal(card.includes("badgeLabel.trim()"), true);
    assert.equal(card.includes("creator.verified === true"), true);
  });

  it("joins a stored city and country and omits a blank side", () => {
    assert.equal(profilePlace("Austin", "USA"), "Austin, USA");
    assert.equal(profilePlace("Austin", "  "), "Austin");
    assert.equal(profilePlace("", "Nigeria"), "Nigeria");
    assert.equal(profilePlace("  ", ""), "");
  });
});
