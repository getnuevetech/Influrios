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

  // Center pad ~22% of the QR — stays within ECC H recovery budget.
  const pad = Math.round(size * 0.22);
  const x = (size - pad) / 2;
  const y = (size - pad) / 2;
  const cx = size / 2;
  const fontSize = Math.max(9, Math.round(pad * 0.22));
  const infinitySize = Math.max(12, Math.round(pad * 0.36));

  const logo = `
  <g id="influrios-mark">
    <rect x="${x}" y="${y}" width="${pad}" height="${pad}" rx="${Math.round(pad * 0.12)}" fill="${QR_LIGHT}"/>
    <text x="${cx}" y="${y + pad * 0.42}" text-anchor="middle" dominant-baseline="middle"
      font-family="Sora, Plus Jakarta Sans, Segoe UI, sans-serif"
      font-size="${infinitySize}" font-weight="700" fill="${QR_PRIMARY}">∞</text>
    <text x="${cx}" y="${y + pad * 0.72}" text-anchor="middle" dominant-baseline="middle"
      font-family="Sora, Plus Jakarta Sans, Segoe UI, sans-serif"
      font-size="${fontSize}" font-weight="800" letter-spacing="0.04em" fill="${QR_PRIMARY}">INFLURIOS</text>
  </g>`;

  return svg.replace("</svg>", `${logo}</svg>`);
}
