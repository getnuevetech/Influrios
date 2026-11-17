/**
 * Official Influrios wordmark mark used on site chrome and agreement PDFs:
 * electric-blue → royal-violet circle with white ∞.
 */
export function influriosLogoMarkSvg(size = 32): string {
  const id = `influriosGrad${size}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2979FF"/>
      <stop offset="100%" stop-color="#633CFF"/>
    </linearGradient>
  </defs>
  <circle cx="16" cy="16" r="16" fill="url(#${id})"/>
  <text x="16" y="21.5" text-anchor="middle" fill="#FFFFFF" font-size="15" font-family="Sora, Plus Jakarta Sans, system-ui, sans-serif" font-weight="700">∞</text>
</svg>`;
}

export function influriosWordmarkHtml(opts?: { markSize?: number; className?: string }): string {
  const size = opts?.markSize ?? 32;
  const className = opts?.className ?? "influrios-wordmark";
  return `<span class="${className}">${influriosLogoMarkSvg(size)}<span class="influrios-wordmark-text">Influrios</span></span>`;
}
