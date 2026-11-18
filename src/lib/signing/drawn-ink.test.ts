import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  drawnInkHasContent,
  drawnInkPayloadTooLarge,
  drawnInkToPdfPath,
  drawnInkToSvg,
  parseDrawnInk,
  serializeDrawnInk,
} from "./drawn-ink";

const sample = {
  version: 1 as const,
  width: 400,
  height: 120,
  strokes: [
    [
      { x: 20, y: 70 },
      { x: 40, y: 40 },
      { x: 80, y: 75 },
      { x: 120, y: 45 },
      { x: 160, y: 70 },
      { x: 200, y: 50 },
      { x: 240, y: 65 },
      { x: 280, y: 55 },
    ],
  ],
};

describe("drawn ink", () => {
  it("parses and round-trips a screen-written signature", () => {
    const parsed = parseDrawnInk(serializeDrawnInk(sample));
    assert.ok(parsed);
    assert.equal(parsed.version, 1);
    assert.equal(parsed.strokes[0]?.length, 8);
    assert.equal(drawnInkHasContent(parsed), true);
  });

  it("rejects empty or malformed ink", () => {
    assert.equal(parseDrawnInk(""), null);
    assert.equal(parseDrawnInk("{}"), null);
    assert.equal(parseDrawnInk({ version: 1, width: 400, height: 120, strokes: [] }), null);
    assert.equal(
      drawnInkHasContent({
        version: 1,
        width: 400,
        height: 120,
        strokes: [
          [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
          ],
        ],
      }),
      false,
    );
  });

  it("emits SVG and PDF path operators", () => {
    const svg = drawnInkToSvg(sample);
    assert.match(svg, /<svg /);
    assert.match(svg, /stroke-linecap="round"/);
    const ops = drawnInkToPdfPath(sample, 50, 100, { targetWidth: 200 });
    assert.ok(ops.some((line) => line.endsWith(" m")));
    assert.ok(ops.some((line) => line.endsWith(" l")));
  });

  it("flags oversized payloads", () => {
    assert.equal(drawnInkPayloadTooLarge("x".repeat(120_001)), true);
    assert.equal(drawnInkPayloadTooLarge("{}"), false);
  });
});
