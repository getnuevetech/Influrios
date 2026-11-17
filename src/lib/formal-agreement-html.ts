/**
 * Server-side printable HTML for the formal agreement PDF.
 * Embeds brand fonts as data URLs so Chrome print-to-PDF matches the Document tab.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formalAgreementLayoutCss,
  renderFormalAgreementArticleHtml,
  type FormalAgreementHtmlInput,
} from "@/lib/formal-agreement-markup";

export type { FormalAgreementHtmlInput } from "@/lib/formal-agreement-markup";
export { renderFormalAgreementArticleHtml, formalAgreementLayoutCss } from "@/lib/formal-agreement-markup";

function fontFace(family: string, weight: string, file: string): string {
  try {
    const bytes = readFileSync(join(process.cwd(), "src/fonts", file));
    const b64 = bytes.toString("base64");
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  } catch {
    return "";
  }
}

function formalFontsCss(): string {
  return [
    fontFace("Plus Jakarta Sans", "400", "plus-jakarta-sans-latin-400-normal.woff2"),
    fontFace("Plus Jakarta Sans", "600", "plus-jakarta-sans-latin-600-normal.woff2"),
    fontFace("Plus Jakarta Sans", "700", "plus-jakarta-sans-latin-700-normal.woff2"),
    fontFace("Sora", "700", "sora-latin-700-normal.woff2"),
    fontFace("Caveat", "600", "caveat-latin-600-normal.woff2"),
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Full printable HTML document for Chrome --print-to-pdf. */
export function renderFormalAgreementDocumentHtml(input: FormalAgreementHtmlInput): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(input.title)} · ${escapeHtml(input.agreementRef)}</title>
<style>${formalFontsCss()}
${formalAgreementLayoutCss()}</style>
</head>
<body>
${renderFormalAgreementArticleHtml(input)}
</body>
</html>`;
}
