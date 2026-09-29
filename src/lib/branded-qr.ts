/**
 * Branded Influrios QR — primary electric blue modules + optional center wordmark.
 */
import QRCode from "qrcode";

export const QR_PRIMARY = "#2979FF";
export const QR_LIGHT = "#FFFFFF";

export type BrandedQrOptions = {
  target: string;
  /** Pixel size of the square QR. */
  size?: number;
  /** Draw the INFLURIOS center mark (needs error correction H). */
  withLogo?: boolean;
  margin?: number;
};

/**
 * SVG QR in brand blue. When `withLogo` is true, clears a center pad and
 * draws the Influrios wordmark so phones can still scan (ECC H).
 *
 * Coordinates are in the SVG viewBox (module units from `qrcode`), not pixels.
 */
export async function buildBrandedQrSvg({
  target,
  size = 512,
  withLogo = true,
  margin = 2,
}: BrandedQrOptions): Promise<string> {
  const svg = await QRCode.toString(target, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin,
    width: size,
    color: { dark: QR_PRIMARY, light: QR_LIGHT },
  });

  if (!withLogo) return svg;

  const vbMatch = svg.match(/viewBox="0\s+0\s+([\d.]+)\s+([\d.]+)"/);
  const vb = vbMatch ? Number(vbMatch[1]) : 41;
  // ~24% center pad — within ECC H recovery budget.
  const pad = vb * 0.24;
  const x = (vb - pad) / 2;
  const y = (vb - pad) / 2;
  const cx = vb / 2;
  const infinitySize = pad * 0.38;
  const wordSize = pad * 0.16;

  const logo = `
  <g id="influrios-mark">
    <rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${pad.toFixed(3)}" height="${pad.toFixed(3)}"
      rx="${(pad * 0.12).toFixed(3)}" fill="${QR_LIGHT}"/>
    <text x="${cx.toFixed(3)}" y="${(y + pad * 0.4).toFixed(3)}" text-anchor="middle" dominant-baseline="middle"
      font-family="Sora, Plus Jakarta Sans, Segoe UI, sans-serif"
      font-size="${infinitySize.toFixed(3)}" font-weight="700" fill="${QR_PRIMARY}">∞</text>
    <text x="${cx.toFixed(3)}" y="${(y + pad * 0.72).toFixed(3)}" text-anchor="middle" dominant-baseline="middle"
      font-family="Sora, Plus Jakarta Sans, Segoe UI, sans-serif"
      font-size="${wordSize.toFixed(3)}" font-weight="800" letter-spacing="0.04em" fill="${QR_PRIMARY}">INFLURIOS</text>
  </g>`;

  return svg.replace("</svg>", `${logo}</svg>`);
}
