/**
 * Freehand (screen-written) signature ink for Influrios in-app e-sign.
 * Stores stroke polylines so the same original mark can render in SVG, HTML, and PDF.
 */

export type DrawnPoint = { x: number; y: number };
export type DrawnStroke = DrawnPoint[];

export type DrawnInk = {
  version: 1;
  width: number;
  height: number;
  strokes: DrawnStroke[];
};

const MAX_STROKES = 80;
const MAX_POINTS_PER_STROKE = 2_000;
const MAX_TOTAL_POINTS = 8_000;
const MAX_WIDTH = 2_400;
const MAX_HEIGHT = 900;
const MIN_POINTS = 8;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** True when the payload has enough ink to count as an original screen-written mark. */
export function drawnInkHasContent(ink: DrawnInk | null | undefined): boolean {
  if (!ink) return false;
  let points = 0;
  for (const stroke of ink.strokes) {
    points += stroke.length;
    if (points >= MIN_POINTS) return true;
  }
  return false;
}

/** Parse and validate a drawn-ink payload from form JSON or stored text. */
export function parseDrawnInk(raw: unknown): DrawnInk | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const row = value as { version?: unknown; width?: unknown; height?: unknown; strokes?: unknown };
  if (row.version !== 1) return null;
  if (!isFiniteNumber(row.width) || !isFiniteNumber(row.height)) return null;
  if (row.width < 40 || row.height < 40 || row.width > MAX_WIDTH || row.height > MAX_HEIGHT) return null;
  if (!Array.isArray(row.strokes) || row.strokes.length === 0 || row.strokes.length > MAX_STROKES) return null;

  const strokes: DrawnStroke[] = [];
  let totalPoints = 0;
  for (const strokeRaw of row.strokes) {
    if (!Array.isArray(strokeRaw) || strokeRaw.length < 2 || strokeRaw.length > MAX_POINTS_PER_STROKE) continue;
    const stroke: DrawnPoint[] = [];
    for (const pointRaw of strokeRaw) {
      if (!pointRaw || typeof pointRaw !== "object") continue;
      const point = pointRaw as { x?: unknown; y?: unknown };
      if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) continue;
      stroke.push({
        x: clamp(point.x, 0, row.width),
        y: clamp(point.y, 0, row.height),
      });
    }
    if (stroke.length < 2) continue;
    totalPoints += stroke.length;
    if (totalPoints > MAX_TOTAL_POINTS) return null;
    strokes.push(stroke);
  }
  if (strokes.length === 0) return null;
  return { version: 1, width: row.width, height: row.height, strokes };
}

export function serializeDrawnInk(ink: DrawnInk): string {
  return JSON.stringify(ink);
}

/** Compact SVG for live preview and formal HTML execution blocks. */
export function drawnInkToSvg(
  ink: DrawnInk,
  options?: { stroke?: string; className?: string; maxWidth?: number; maxHeight?: number },
): string {
  const stroke = options?.stroke ?? "#1a1440";
  const maxW = options?.maxWidth ?? 420;
  const maxH = options?.maxHeight ?? 140;
  const scale = Math.min(maxW / ink.width, maxH / ink.height, 1);
  const width = Math.max(1, Math.round(ink.width * scale));
  const height = Math.max(1, Math.round(ink.height * scale));
  const paths = ink.strokes
    .map((strokePoints) => {
      if (strokePoints.length < 2) return "";
      const [first, ...rest] = strokePoints;
      const head = `M ${(first!.x * scale).toFixed(2)} ${(first!.y * scale).toFixed(2)}`;
      const body = rest.map((point) => `L ${(point.x * scale).toFixed(2)} ${(point.y * scale).toFixed(2)}`).join(" ");
      return `${head} ${body}`;
    })
    .filter(Boolean)
    .join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none"${
    options?.className ? ` class="${options.className}"` : ""
  }><path d="${paths}" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/**
 * PDF path operators for a drawn signature.
 * Origin is the lower-left of the ink box; y grows upward in PDF space.
 */
export function drawnInkToPdfPath(
  ink: DrawnInk,
  originX: number,
  originY: number,
  options?: { targetWidth?: number; targetHeight?: number },
): string[] {
  const targetWidth = options?.targetWidth ?? Math.min(280, ink.width * 0.55);
  const scale = targetWidth / ink.width;
  const targetHeight = options?.targetHeight ?? ink.height * scale;
  const commands: string[] = [];
  for (const stroke of ink.strokes) {
    if (stroke.length < 2) continue;
    stroke.forEach((point, index) => {
      const x = originX + point.x * scale;
      // Canvas y grows downward; PDF y grows upward from the box baseline.
      const y = originY + targetHeight - point.y * scale;
      commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${index === 0 ? "m" : "l"}`);
    });
  }
  return commands;
}

/** Reject oversized form payloads before they hit the DB. */
export function drawnInkPayloadTooLarge(raw: string): boolean {
  return raw.length > 120_000;
}
