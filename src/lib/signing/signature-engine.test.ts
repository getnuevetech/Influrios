import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  renderInitialsSignature,
  renderNameSignature,
  signatureInitials,
  signatureToPdfPath,
  signatureToSvg,
} from "./signature-engine";

describe("signature engine", () => {
  it("derives initials from a legal name", () => {
    assert.equal(signatureInitials("Ada Lovelace"), "AL");
    assert.equal(signatureInitials("North Co"), "NC");
    assert.equal(signatureInitials("Madonna"), "MA");
  });

  it("renders a cursive path for a typed name", () => {
    const signature = renderNameSignature("Ada Lovelace");
    assert.equal(signature.name, "Ada Lovelace");
    assert.equal(signature.initials, "AL");
    assert.ok(signature.strokes.length > 5);
    assert.ok(signature.width > 40);
    assert.match(signature.svgPath, /^M /);
    assert.match(signature.svgPath, / C /);
  });

  it("is deterministic for the same name", () => {
    const a = renderNameSignature("North Co");
    const b = renderNameSignature("North Co");
    assert.equal(a.svgPath, b.svgPath);
    assert.equal(a.width, b.width);
  });

  it("emits PDF path operators and SVG markup", () => {
    const signature = renderNameSignature("Bea");
    const ops = signatureToPdfPath(signature, 50, 100);
    assert.ok(ops.some((line) => line.endsWith(" m")));
    assert.ok(ops.some((line) => line.endsWith(" c")));
    const svg = signatureToSvg(signature);
    assert.match(svg, /<svg /);
    assert.match(svg, /stroke-linecap="round"/);
  });

  it("renders compact initials for page endorsements", () => {
    const ink = renderInitialsSignature("Ada Lovelace", { emSize: 10 });
    assert.equal(ink.initials, "AL");
    assert.ok(ink.width < renderNameSignature("Ada Lovelace").width);
  });
});
