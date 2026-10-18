/**
 * Name → handwritten signature engine for Influrios in-app e-sign.
 * Produces deterministic stroke paths (PDF operators + SVG) so typed legal
 * names render as cursive ink rather than plain Helvetica text.
 */

export type SignaturePoint = { x: number; y: number };
export type SignatureCubic = { c1: SignaturePoint; c2: SignaturePoint; end: SignaturePoint };
export type SignatureStroke = { start: SignaturePoint; curves: SignatureCubic[] };

export type SignatureGlyph = {
  width: number;
  strokes: SignatureStroke[];
};

export type RenderedSignature = {
  name: string;
  initials: string;
  width: number;
  height: number;
  strokes: SignatureStroke[];
  svgPath: string;
};

/** Stable 0..1 hash from a string (for natural stroke variation). */
function hashUnit(seed: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

function pt(x: number, y: number): SignaturePoint {
  return { x, y };
}

/** Relative cursive letterforms (units ~ em). Baseline at y=0, ascenders negative. */
const GLYPHS: Record<string, SignatureGlyph> = {
  a: {
    width: 0.72,
    strokes: [
      {
        start: pt(0.55, -0.05),
        curves: [
          { c1: pt(0.55, -0.45), c2: pt(0.05, -0.45), end: pt(0.05, -0.05) },
          { c1: pt(0.05, 0.28), c2: pt(0.55, 0.28), end: pt(0.55, -0.05) },
        ],
      },
      {
        start: pt(0.55, -0.35),
        curves: [{ c1: pt(0.55, 0.05), c2: pt(0.55, 0.2), end: pt(0.7, 0.05) }],
      },
    ],
  },
  b: {
    width: 0.7,
    strokes: [
      {
        start: pt(0.12, -0.85),
        curves: [
          { c1: pt(0.12, -0.2), c2: pt(0.12, 0.15), end: pt(0.12, 0.22) },
          { c1: pt(0.45, 0.35), c2: pt(0.7, 0.05), end: pt(0.55, -0.15) },
          { c1: pt(0.4, -0.35), c2: pt(0.15, -0.25), end: pt(0.15, -0.05) },
        ],
      },
    ],
  },
  c: {
    width: 0.62,
    strokes: [
      {
        start: pt(0.58, -0.28),
        curves: [
          { c1: pt(0.5, -0.48), c2: pt(0.1, -0.48), end: pt(0.08, -0.08) },
          { c1: pt(0.06, 0.28), c2: pt(0.45, 0.3), end: pt(0.6, 0.08) },
        ],
      },
    ],
  },
  d: {
    width: 0.74,
    strokes: [
      {
        start: pt(0.62, -0.85),
        curves: [
          { c1: pt(0.62, -0.2), c2: pt(0.62, 0.1), end: pt(0.62, 0.2) },
          { c1: pt(0.35, 0.35), c2: pt(0.05, 0.15), end: pt(0.1, -0.1) },
          { c1: pt(0.15, -0.4), c2: pt(0.55, -0.4), end: pt(0.62, -0.05) },
        ],
      },
    ],
  },
  e: {
    width: 0.62,
    strokes: [
      {
        start: pt(0.08, -0.08),
        curves: [
          { c1: pt(0.2, -0.42), c2: pt(0.62, -0.35), end: pt(0.55, -0.05) },
          { c1: pt(0.48, 0.28), c2: pt(0.12, 0.3), end: pt(0.08, 0.05) },
          { c1: pt(0.25, -0.05), c2: pt(0.45, -0.05), end: pt(0.58, -0.02) },
        ],
      },
    ],
  },
  f: {
    width: 0.55,
    strokes: [
      {
        start: pt(0.45, -0.85),
        curves: [
          { c1: pt(0.15, -0.9), c2: pt(0.15, -0.4), end: pt(0.22, 0.05) },
          { c1: pt(0.3, 0.45), c2: pt(0.05, 0.55), end: pt(0.08, 0.35) },
        ],
      },
      {
        start: pt(0.05, -0.35),
        curves: [{ c1: pt(0.25, -0.35), c2: pt(0.4, -0.35), end: pt(0.5, -0.35) }],
      },
    ],
  },
  g: {
    width: 0.7,
    strokes: [
      {
        start: pt(0.55, -0.35),
        curves: [
          { c1: pt(0.55, -0.5), c2: pt(0.1, -0.5), end: pt(0.1, -0.1) },
          { c1: pt(0.1, 0.25), c2: pt(0.55, 0.25), end: pt(0.55, -0.1) },
          { c1: pt(0.55, 0.35), c2: pt(0.55, 0.65), end: pt(0.2, 0.7) },
          { c1: pt(0.05, 0.55), c2: pt(0.35, 0.4), end: pt(0.65, 0.15) },
        ],
      },
    ],
  },
  h: {
    width: 0.7,
    strokes: [
      {
        start: pt(0.12, -0.85),
        curves: [
          { c1: pt(0.12, -0.2), c2: pt(0.12, 0.1), end: pt(0.12, 0.22) },
          { c1: pt(0.12, -0.05), c2: pt(0.55, -0.45), end: pt(0.58, -0.05) },
          { c1: pt(0.6, 0.15), c2: pt(0.6, 0.2), end: pt(0.68, 0.18) },
        ],
      },
    ],
  },
  i: {
    width: 0.38,
    strokes: [
      {
        start: pt(0.12, -0.35),
        curves: [{ c1: pt(0.14, -0.05), c2: pt(0.16, 0.15), end: pt(0.28, 0.18) }],
      },
      {
        start: pt(0.16, -0.55),
        curves: [{ c1: pt(0.18, -0.58), c2: pt(0.2, -0.52), end: pt(0.18, -0.5) }],
      },
    ],
  },
  j: {
    width: 0.42,
    strokes: [
      {
        start: pt(0.28, -0.35),
        curves: [
          { c1: pt(0.28, 0.15), c2: pt(0.28, 0.55), end: pt(0.05, 0.65) },
          { c1: pt(-0.05, 0.45), c2: pt(0.2, 0.35), end: pt(0.38, 0.2) },
        ],
      },
      {
        start: pt(0.26, -0.55),
        curves: [{ c1: pt(0.28, -0.58), c2: pt(0.3, -0.52), end: pt(0.28, -0.5) }],
      },
    ],
  },
  k: {
    width: 0.68,
    strokes: [
      {
        start: pt(0.12, -0.85),
        curves: [{ c1: pt(0.12, -0.2), c2: pt(0.12, 0.1), end: pt(0.12, 0.22) }],
      },
      {
        start: pt(0.55, -0.4),
        curves: [
          { c1: pt(0.25, -0.15), c2: pt(0.2, -0.05), end: pt(0.15, -0.02) },
          { c1: pt(0.35, 0.05), c2: pt(0.5, 0.2), end: pt(0.65, 0.2) },
        ],
      },
    ],
  },
  l: {
    width: 0.42,
    strokes: [
      {
        start: pt(0.28, -0.85),
        curves: [
          { c1: pt(0.1, -0.9), c2: pt(0.1, -0.2), end: pt(0.15, 0.1) },
          { c1: pt(0.2, 0.25), c2: pt(0.35, 0.2), end: pt(0.4, 0.12) },
        ],
      },
    ],
  },
  m: {
    width: 1.05,
    strokes: [
      {
        start: pt(0.08, -0.35),
        curves: [
          { c1: pt(0.1, 0.05), c2: pt(0.12, 0.18), end: pt(0.18, 0.2) },
          { c1: pt(0.25, -0.45), c2: pt(0.5, -0.45), end: pt(0.52, -0.05) },
          { c1: pt(0.55, 0.15), c2: pt(0.55, 0.18), end: pt(0.55, 0.2) },
          { c1: pt(0.6, -0.45), c2: pt(0.9, -0.45), end: pt(0.92, -0.05) },
          { c1: pt(0.95, 0.15), c2: pt(0.95, 0.18), end: pt(1.0, 0.18) },
        ],
      },
    ],
  },
  n: {
    width: 0.72,
    strokes: [
      {
        start: pt(0.1, -0.35),
        curves: [
          { c1: pt(0.12, 0.05), c2: pt(0.12, 0.18), end: pt(0.18, 0.2) },
          { c1: pt(0.25, -0.45), c2: pt(0.55, -0.45), end: pt(0.58, -0.05) },
          { c1: pt(0.6, 0.15), c2: pt(0.6, 0.18), end: pt(0.68, 0.18) },
        ],
      },
    ],
  },
  o: {
    width: 0.68,
    strokes: [
      {
        start: pt(0.34, -0.4),
        curves: [
          { c1: pt(0.6, -0.4), c2: pt(0.65, 0.05), end: pt(0.34, 0.22) },
          { c1: pt(0.05, 0.05), c2: pt(0.08, -0.4), end: pt(0.34, -0.4) },
        ],
      },
    ],
  },
  p: {
    width: 0.7,
    strokes: [
      {
        start: pt(0.12, -0.35),
        curves: [
          { c1: pt(0.12, 0.15), c2: pt(0.12, 0.55), end: pt(0.12, 0.7) },
          { c1: pt(0.12, -0.05), c2: pt(0.55, -0.45), end: pt(0.58, -0.1) },
          { c1: pt(0.6, 0.2), c2: pt(0.25, 0.3), end: pt(0.15, 0.05) },
        ],
      },
    ],
  },
  q: {
    width: 0.7,
    strokes: [
      {
        start: pt(0.55, -0.35),
        curves: [
          { c1: pt(0.55, -0.5), c2: pt(0.1, -0.5), end: pt(0.1, -0.1) },
          { c1: pt(0.1, 0.25), c2: pt(0.55, 0.25), end: pt(0.55, -0.1) },
          { c1: pt(0.55, 0.25), c2: pt(0.55, 0.65), end: pt(0.7, 0.7) },
        ],
      },
    ],
  },
  r: {
    width: 0.52,
    strokes: [
      {
        start: pt(0.1, -0.35),
        curves: [
          { c1: pt(0.12, 0.05), c2: pt(0.12, 0.18), end: pt(0.18, 0.2) },
          { c1: pt(0.22, -0.35), c2: pt(0.4, -0.4), end: pt(0.5, -0.25) },
        ],
      },
    ],
  },
  s: {
    width: 0.58,
    strokes: [
      {
        start: pt(0.52, -0.32),
        curves: [
          { c1: pt(0.35, -0.5), c2: pt(0.05, -0.4), end: pt(0.15, -0.15) },
          { c1: pt(0.3, 0.05), c2: pt(0.55, 0.05), end: pt(0.45, 0.25) },
          { c1: pt(0.3, 0.4), c2: pt(0.05, 0.3), end: pt(0.08, 0.12) },
        ],
      },
    ],
  },
  t: {
    width: 0.48,
    strokes: [
      {
        start: pt(0.22, -0.65),
        curves: [
          { c1: pt(0.22, -0.1), c2: pt(0.22, 0.1), end: pt(0.35, 0.2) },
          { c1: pt(0.45, 0.25), c2: pt(0.5, 0.15), end: pt(0.45, 0.05) },
        ],
      },
      {
        start: pt(0.05, -0.35),
        curves: [{ c1: pt(0.2, -0.35), c2: pt(0.35, -0.35), end: pt(0.42, -0.35) }],
      },
    ],
  },
  u: {
    width: 0.7,
    strokes: [
      {
        start: pt(0.1, -0.35),
        curves: [
          { c1: pt(0.1, 0.2), c2: pt(0.35, 0.3), end: pt(0.5, 0.05) },
          { c1: pt(0.55, -0.15), c2: pt(0.55, -0.3), end: pt(0.55, -0.35) },
          { c1: pt(0.55, 0.05), c2: pt(0.55, 0.15), end: pt(0.68, 0.18) },
        ],
      },
    ],
  },
  v: {
    width: 0.68,
    strokes: [
      {
        start: pt(0.05, -0.35),
        curves: [
          { c1: pt(0.2, 0.15), c2: pt(0.3, 0.25), end: pt(0.35, 0.2) },
          { c1: pt(0.45, 0.05), c2: pt(0.55, -0.2), end: pt(0.65, -0.35) },
        ],
      },
    ],
  },
  w: {
    width: 1.0,
    strokes: [
      {
        start: pt(0.05, -0.35),
        curves: [
          { c1: pt(0.15, 0.2), c2: pt(0.25, 0.25), end: pt(0.32, 0.1) },
          { c1: pt(0.4, -0.2), c2: pt(0.45, -0.25), end: pt(0.5, -0.15) },
          { c1: pt(0.58, 0.2), c2: pt(0.7, 0.25), end: pt(0.78, 0.05) },
          { c1: pt(0.88, -0.2), c2: pt(0.92, -0.3), end: pt(0.98, -0.35) },
        ],
      },
    ],
  },
  x: {
    width: 0.62,
    strokes: [
      {
        start: pt(0.08, -0.35),
        curves: [{ c1: pt(0.25, -0.05), c2: pt(0.4, 0.1), end: pt(0.58, 0.2) }],
      },
      {
        start: pt(0.55, -0.35),
        curves: [{ c1: pt(0.35, -0.05), c2: pt(0.2, 0.1), end: pt(0.08, 0.2) }],
      },
    ],
  },
  y: {
    width: 0.7,
    strokes: [
      {
        start: pt(0.08, -0.35),
        curves: [
          { c1: pt(0.2, 0.15), c2: pt(0.3, 0.25), end: pt(0.4, 0.05) },
          { c1: pt(0.5, -0.2), c2: pt(0.55, -0.35), end: pt(0.55, -0.35) },
          { c1: pt(0.55, 0.25), c2: pt(0.55, 0.65), end: pt(0.2, 0.7) },
          { c1: pt(0.05, 0.5), c2: pt(0.35, 0.35), end: pt(0.65, 0.15) },
        ],
      },
    ],
  },
  z: {
    width: 0.62,
    strokes: [
      {
        start: pt(0.08, -0.35),
        curves: [
          { c1: pt(0.35, -0.35), c2: pt(0.55, -0.35), end: pt(0.58, -0.3) },
          { c1: pt(0.35, -0.05), c2: pt(0.2, 0.15), end: pt(0.1, 0.22) },
          { c1: pt(0.3, 0.22), c2: pt(0.5, 0.22), end: pt(0.6, 0.18) },
        ],
      },
    ],
  },
  " ": { width: 0.45, strokes: [] },
  "-": {
    width: 0.45,
    strokes: [
      {
        start: pt(0.05, -0.1),
        curves: [{ c1: pt(0.2, -0.1), c2: pt(0.3, -0.1), end: pt(0.4, -0.1) }],
      },
    ],
  },
  ".": {
    width: 0.28,
    strokes: [
      {
        start: pt(0.1, 0.12),
        curves: [{ c1: pt(0.12, 0.08), c2: pt(0.14, 0.14), end: pt(0.12, 0.16) }],
      },
    ],
  },
  "'": {
    width: 0.28,
    strokes: [
      {
        start: pt(0.12, -0.55),
        curves: [{ c1: pt(0.14, -0.4), c2: pt(0.12, -0.3), end: pt(0.1, -0.25) }],
      },
    ],
  },
};

function capitalGlyph(letter: string): SignatureGlyph {
  const lower = GLYPHS[letter.toLowerCase()] ?? {
    width: 0.7,
    strokes: [
      {
        start: pt(0.1, -0.4),
        curves: [{ c1: pt(0.3, 0.1), c2: pt(0.5, 0.1), end: pt(0.65, -0.2) }],
      },
    ],
  };
  // Scale capitals taller / slightly wider.
  const scaleX = 1.15;
  const scaleY = 1.35;
  return {
    width: lower.width * scaleX + 0.08,
    strokes: lower.strokes.map((stroke) => ({
      start: pt(stroke.start.x * scaleX, stroke.start.y * scaleY - 0.15),
      curves: stroke.curves.map((curve) => ({
        c1: pt(curve.c1.x * scaleX, curve.c1.y * scaleY - 0.15),
        c2: pt(curve.c2.x * scaleX, curve.c2.y * scaleY - 0.15),
        end: pt(curve.end.x * scaleX, curve.end.y * scaleY - 0.15),
      })),
    })),
  };
}

function glyphForChar(ch: string, isWordStart: boolean): SignatureGlyph {
  if (ch === " ") return GLYPHS[" "];
  if (/[A-Z]/.test(ch) || isWordStart) return capitalGlyph(ch);
  return GLYPHS[ch.toLowerCase()] ?? capitalGlyph(ch);
}

function wobble(seed: string, index: number, amount: number): number {
  return (hashUnit(seed, index) - 0.5) * 2 * amount;
}

function translateStroke(stroke: SignatureStroke, dx: number, dy: number, seed: string, index: number): SignatureStroke {
  const jx = wobble(seed, index * 7 + 1, 0.03);
  const jy = wobble(seed, index * 7 + 2, 0.025);
  const map = (p: SignaturePoint): SignaturePoint => pt(p.x + dx + jx, p.y + dy + jy);
  return {
    start: map(stroke.start),
    curves: stroke.curves.map((curve) => ({
      c1: map(curve.c1),
      c2: map(curve.c2),
      end: map(curve.end),
    })),
  };
}

/** Initials from a legal name (e.g. "Ada Lovelace" → "AL"). */
export function signatureInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

/** Build a cursive signature from a typed legal name. */
export function renderNameSignature(name: string, options?: { emSize?: number }): RenderedSignature {
  const cleaned = name.trim().replace(/\s+/g, " ").slice(0, 80);
  const em = options?.emSize ?? 18;
  const strokes: SignatureStroke[] = [];
  let cursorX = 0;
  let wordStart = true;
  let glyphIndex = 0;

  for (const ch of cleaned) {
    if (ch === " ") {
      cursorX += GLYPHS[" "].width * em;
      wordStart = true;
      continue;
    }
    const glyph = glyphForChar(ch, wordStart);
    wordStart = false;
    for (const stroke of glyph.strokes) {
      strokes.push(translateStroke(stroke, cursorX / em, 0, cleaned, glyphIndex));
      glyphIndex += 1;
    }
    cursorX += glyph.width * em * (0.92 + wobble(cleaned, glyphIndex, 0.04));
  }

  // Scale strokes from em-units to points.
  const scaled = strokes.map((stroke) => ({
    start: pt(stroke.start.x * em, stroke.start.y * em),
    curves: stroke.curves.map((curve) => ({
      c1: pt(curve.c1.x * em, curve.c1.y * em),
      c2: pt(curve.c2.x * em, curve.c2.y * em),
      end: pt(curve.end.x * em, curve.end.y * em),
    })),
  }));

  const height = em * 1.6;
  const width = Math.max(cursorX, em * 2);
  return {
    name: cleaned,
    initials: signatureInitials(cleaned),
    width,
    height,
    strokes: scaled,
    svgPath: strokesToSvgPath(scaled, height * 0.7),
  };
}

function strokesToSvgPath(strokes: SignatureStroke[], baselineY: number): string {
  const parts: string[] = [];
  for (const stroke of strokes) {
    parts.push(`M ${stroke.start.x.toFixed(2)} ${(baselineY + stroke.start.y).toFixed(2)}`);
    for (const curve of stroke.curves) {
      parts.push(
        `C ${curve.c1.x.toFixed(2)} ${(baselineY + curve.c1.y).toFixed(2)} ${curve.c2.x.toFixed(2)} ${(baselineY + curve.c2.y).toFixed(2)} ${curve.end.x.toFixed(2)} ${(baselineY + curve.end.y).toFixed(2)}`,
      );
    }
  }
  return parts.join(" ");
}

/** PDF content-stream path commands (user space, origin at lower-left of signature box). */
export function signatureToPdfPath(signature: RenderedSignature, originX: number, originY: number): string[] {
  const baseline = originY + signature.height * 0.35;
  const commands: string[] = [];
  for (const stroke of signature.strokes) {
    const sx = originX + stroke.start.x;
    const sy = baseline - stroke.start.y;
    commands.push(`${sx.toFixed(2)} ${sy.toFixed(2)} m`);
    for (const curve of stroke.curves) {
      commands.push(
        `${(originX + curve.c1.x).toFixed(2)} ${(baseline - curve.c1.y).toFixed(2)} ${(originX + curve.c2.x).toFixed(2)} ${(baseline - curve.c2.y).toFixed(2)} ${(originX + curve.end.x).toFixed(2)} ${(baseline - curve.end.y).toFixed(2)} c`,
      );
    }
  }
  return commands;
}

/** Compact SVG markup for live preview / tests. */
export function signatureToSvg(signature: RenderedSignature, options?: { stroke?: string; className?: string }): string {
  const stroke = options?.stroke ?? "#1a1a2e";
  const height = Math.ceil(signature.height + 8);
  const width = Math.ceil(signature.width + 8);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none"${options?.className ? ` class="${options.className}"` : ""}><path d="${signature.svgPath}" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function renderInitialsSignature(name: string, options?: { emSize?: number }): RenderedSignature {
  const initials = signatureInitials(name);
  return renderNameSignature(initials || name.slice(0, 2), { emSize: options?.emSize ?? 14 });
}
