/**
 * Shared formal-agreement markup + CSS (client-safe: no Node fs).
 * Document tab and PDF print both render from this source.
 */
import {
  isFieldRow,
  parseAgreementBodySections,
  splitFieldRow,
  type AgreementBodySection,
} from "@/lib/contract-body-sections";
import { stripSignatureTokens } from "@/lib/contract-signature-text";
import { influriosWordmarkHtml } from "@/lib/influrios-logo-svg";

export type FormalAgreementHtmlParty = {
  role: "business" | "influencer";
  legalName: string;
  handle?: string;
  signerName?: string;
  capacity?: string;
  signedAtLabel?: string;
  signed?: boolean;
  /** Safe SVG markup for an original screen-written signature, when present. */
  signatureInkSvg?: string;
};

export type FormalAgreementHtmlMilestone = {
  title: string;
  shareLabel: string;
  grossLabel: string;
  feeLabel?: string;
  netLabel?: string;
};

export type FormalAgreementHtmlInput = {
  title: string;
  campaign: string;
  agreementRef: string;
  versionLabel: string;
  parties: FormalAgreementHtmlParty[];
  body: string;
  compensation: {
    grossLabel: string;
    feeLabel: string;
    taxLabel?: string;
    netLabel: string;
  };
  milestones: FormalAgreementHtmlMilestone[];
  showFeeColumns?: boolean;
  draft?: boolean;
  footerNote?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Layout CSS shared by Document tab and printable PDF (fonts injected separately for PDF). */
export function formalAgreementLayoutCss(): string {
  return `
:root {
  --indigo: #1B1464;
  --navy: #111A5A;
  --muted: #667085;
  --line: #E7ECF5;
  --soft: #F4F6FB;
  --label: #344054;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: var(--indigo);
}
.formal-agreement {
  margin: 0 auto;
  max-width: 720px;
  border: 1px solid rgba(27,20,100,0.25);
  background: #fff;
  padding: 40px 48px;
  font-family: Georgia, "Times New Roman", Times, serif;
  color: var(--indigo);
}
.formal-header {
  border-bottom: 1px solid var(--navy);
  padding-bottom: 16px;
}
.formal-header-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.influrios-wordmark {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: Sora, "Plus Jakarta Sans", system-ui, sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--indigo);
  line-height: 1;
}
.influrios-wordmark svg {
  display: block;
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  box-shadow: 0 4px 10px rgba(99,60,255,0.30);
}
.influrios-wordmark-text { letter-spacing: 0; }
.formal-meta {
  font-family: "Plus Jakarta Sans", system-ui, sans-serif;
  font-size: 11px;
  line-height: 1.45;
  text-align: right;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.formal-title {
  margin: 24px 0 8px;
  text-align: center;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.15;
  color: var(--navy);
}
.formal-campaign {
  margin: 0;
  text-align: center;
  font-size: 15px;
  font-style: italic;
  color: var(--label);
}
.formal-draft {
  margin: 12px 0 0;
  text-align: center;
  font-family: "Plus Jakarta Sans", system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #B86E00;
}
.formal-section { margin-top: 24px; }
.formal-section-bar {
  background: var(--navy);
  color: #fff;
  padding: 6px 12px;
  font-family: "Plus Jakarta Sans", system-ui, sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.formal-section-body {
  margin-top: 12px;
  font-family: "Plus Jakarta Sans", system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.55;
  color: var(--indigo);
}
.formal-section-body p { margin: 8px 0; white-space: pre-wrap; }
.formal-section-body ul {
  margin: 8px 0;
  padding-left: 20px;
}
.formal-section-body li { margin: 4px 0; }
.formal-note {
  margin-top: 12px;
  font-size: 12px;
  color: var(--muted);
}
.formal-kv { width: 100%; border-collapse: collapse; }
.formal-kv td {
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}
.formal-kv .label {
  width: 42%;
  padding-right: 12px;
  font-weight: 600;
  color: var(--label);
}
.formal-kv .value { color: var(--indigo); }
.formal-money { width: 100%; border-collapse: collapse; }
.formal-money td {
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}
.formal-money .right {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.formal-money .total {
  background: var(--soft);
  font-weight: 700;
}
.formal-party-row { display: flex; gap: 8px; margin: 6px 0; }
.formal-party-row dt {
  width: 144px;
  flex-shrink: 0;
  font-weight: 600;
}
.schedule-title {
  margin: 40px 0 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--navy);
}
.schedule-table {
  width: 100%;
  margin-top: 16px;
  border-collapse: collapse;
  font-family: "Plus Jakarta Sans", system-ui, sans-serif;
  font-size: 12px;
}
.schedule-table th {
  padding: 8px 4px;
  border-bottom: 2px solid var(--indigo);
  text-align: left;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--indigo);
}
.schedule-table th.right, .schedule-table td.right {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.schedule-table td {
  padding: 8px 4px;
  border-bottom: 1px solid var(--line);
}
.schedule-table tr.total {
  background: var(--soft);
  font-weight: 700;
}
.execution-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  font-family: "Plus Jakarta Sans", system-ui, sans-serif;
}
.execution-party { break-inside: avoid; }
.execution-party h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--indigo);
}
.signature-ink {
  margin: 16px 0 8px;
  font-family: Caveat, Georgia, serif;
  font-size: 22px;
  font-style: italic;
  font-weight: 600;
  color: #2979FF;
  line-height: 1.1;
}
.signature-ink-draw {
  margin: 12px 0 8px;
  max-width: 100%;
  overflow: hidden;
}
.signature-ink-draw svg {
  display: block;
  max-width: 100%;
  height: auto;
}
.execution-party p {
  margin: 6px 0;
  font-size: 13px;
}
.sig-blank {
  display: inline-block;
  min-width: 12rem;
  border-bottom: 1px solid #98A2B3;
}
.formal-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 40px;
  padding-top: 12px;
  border-top: 1px solid var(--navy);
  font-family: "Plus Jakarta Sans", system-ui, sans-serif;
  font-size: 11px;
  font-style: italic;
  color: #98A2B3;
}
.formal-footer .rule {
  flex: 1;
  height: 1px;
  background: rgba(27,20,100,0.30);
}
@media print {
  body { background: #fff; }
  .formal-agreement {
    border: none;
    max-width: none;
    padding: 0;
    box-shadow: none;
  }
}
`;
}

function sectionBar(heading: string): string {
  return `<div class="formal-section-bar">${escapeHtml(heading)}</div>`;
}

function bodyLinesHtml(lines: string[]): string {
  const parts: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      parts.push(`<div style="height:8px"></div>`);
      index += 1;
      continue;
    }
    if (/^\s*[-·]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-·]\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*[-·]\s+/, "").trim());
        index += 1;
      }
      parts.push(`<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
      continue;
    }
    if (isFieldRow(line)) {
      const rows: { label: string; value: string }[] = [];
      while (index < lines.length && isFieldRow(lines[index] ?? "")) {
        const split = splitFieldRow(lines[index] ?? "");
        if (split) rows.push(split);
        index += 1;
      }
      if (rows.length) {
        parts.push(
          `<table class="formal-kv"><tbody>${rows
            .map(
              (row) =>
                `<tr><td class="label">${escapeHtml(row.label)}</td><td class="value">${escapeHtml(row.value)}</td></tr>`,
            )
            .join("")}</tbody></table>`,
        );
        continue;
      }
    }
    parts.push(`<p>${escapeHtml(line)}</p>`);
    index += 1;
  }
  return parts.join("");
}

function partiesHtml(parties: FormalAgreementHtmlParty[]): string {
  const business = parties.find((party) => party.role === "business");
  const influencers = parties.filter((party) => party.role === "influencer");
  const rows = [
    `<div class="formal-party-row"><dt>Business:</dt><dd>${escapeHtml(business?.legalName || "—")}</dd></div>`,
    ...influencers.flatMap((party) => {
      const handle = party.handle
        ? `<div class="formal-party-row"><dt>Platform handle:</dt><dd>${escapeHtml(
            party.handle.startsWith("@") ? party.handle : `@${party.handle}`,
          )}</dd></div>`
        : "";
      return [
        `<div class="formal-party-row"><dt>Influencer:</dt><dd>${escapeHtml(party.legalName)}</dd></div>`,
        handle,
      ];
    }),
  ];
  return `<section class="formal-section">${sectionBar("1. Parties")}<div class="formal-section-body"><dl>${rows.join(
    "",
  )}</dl><p class="formal-note">Influrios records this collaboration on the platform. It is not a contracting party to this business–influencer agreement.</p></div></section>`;
}

function compensationHtml(input: FormalAgreementHtmlInput): string {
  const fee = input.compensation.feeLabel.replace(/^-/, "");
  const tax = input.compensation.taxLabel
    ? `<tr><td>Tax</td><td class="right">${escapeHtml(input.compensation.taxLabel)}</td></tr>`
    : "";
  return `<section class="formal-section">${sectionBar("3. Compensation")}<div class="formal-section-body"><table class="formal-money"><tbody>
<tr><td>Gross influencer compensation</td><td class="right">${escapeHtml(input.compensation.grossLabel)}</td></tr>
<tr><td>Influencer fee</td><td class="right">−${escapeHtml(fee)}</td></tr>
${tax}
<tr class="total"><td>Net compensation</td><td class="right">${escapeHtml(input.compensation.netLabel)}</td></tr>
</tbody></table></div></section>`;
}

function milestonesHtml(input: FormalAgreementHtmlInput): string {
  if (input.milestones.length === 0) return "";
  const showFee = input.showFeeColumns !== false;
  const head = showFee
    ? `<tr><th>Milestone</th><th>Share</th><th class="right">Gross amount</th><th class="right">Influencer fee</th><th class="right">Net compensation</th></tr>`
    : `<tr><th>Milestone</th><th>Share</th><th class="right">Gross amount</th></tr>`;
  const rows = input.milestones
    .map((row) =>
      showFee
        ? `<tr><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.shareLabel)}</td><td class="right">${escapeHtml(
            row.grossLabel,
          )}</td><td class="right">${escapeHtml(row.feeLabel || "—")}</td><td class="right">${escapeHtml(
            row.netLabel || "—",
          )}</td></tr>`
        : `<tr><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.shareLabel)}</td><td class="right">${escapeHtml(
            row.grossLabel,
          )}</td></tr>`,
    )
    .join("");
  const total = showFee
    ? `<tr class="total"><td>Total</td><td>100%</td><td class="right">${escapeHtml(
        input.compensation.grossLabel,
      )}</td><td class="right">${escapeHtml(input.compensation.feeLabel)}</td><td class="right">${escapeHtml(
        input.compensation.netLabel,
      )}</td></tr>`
    : `<tr class="total"><td>Total</td><td>100%</td><td class="right">${escapeHtml(input.compensation.grossLabel)}</td></tr>`;
  return `<section class="formal-section"><h2 class="schedule-title">Schedule A · Milestones</h2><table class="schedule-table"><thead>${head}</thead><tbody>${rows}${total}</tbody></table></section>`;
}

function executionHtml(parties: FormalAgreementHtmlParty[]): string {
  const cols = parties
    .map((party) => {
      const heading =
        party.role === "business" ? `For ${party.legalName}` : party.legalName || "Influencer";
      if (party.signed && party.signerName) {
        const ink = party.signatureInkSvg
          ? `<div class="signature-ink-draw">${party.signatureInkSvg}</div>`
          : `<p class="signature-ink">${escapeHtml(party.signerName)}</p>`;
        return `<div class="execution-party"><h4>${escapeHtml(heading)}</h4>
${ink}
<p>Printed name: ${escapeHtml(party.signerName)}</p>
<p>Capacity: ${escapeHtml(party.capacity || (party.role === "business" ? "Authorized representative" : "Influencer"))}</p>
<p>Date: ${escapeHtml(party.signedAtLabel || "—")}</p></div>`;
      }
      return `<div class="execution-party"><h4>${escapeHtml(heading)}</h4>
<p>Printed name: <span class="sig-blank">&nbsp;</span></p>
<p>Capacity: <span class="sig-blank">&nbsp;</span></p>
<p>Date: <span class="sig-blank">&nbsp;</span></p></div>`;
    })
    .join("");
  return `<section class="formal-section">${sectionBar("Execution")}<div class="formal-section-body"><div class="execution-grid">${cols}</div></div></section>`;
}

function sectionKind(section: AgreementBodySection): "parties" | "compensation" | "milestones" | "other" {
  const heading = (section.heading ?? "").toLowerCase();
  if (/^1\.\s+parties/.test(heading)) return "parties";
  if (/^3\.\s+compensation/.test(heading)) return "compensation";
  if (/^4\.\s+milestone/.test(heading)) return "milestones";
  return "other";
}

/** Inner article HTML used by both the Document tab and PDF print. */
export function renderFormalAgreementArticleHtml(input: FormalAgreementHtmlInput): string {
  const cleanedBody = stripSignatureTokens(input.body);
  const sections = parseAgreementBodySections(cleanedBody);
  const kinds = new Set(sections.map((section) => sectionKind(section)));
  const chunks: string[] = [];

  chunks.push(`<header class="formal-header">
  <div class="formal-header-row">
    ${influriosWordmarkHtml({ markSize: 32 })}
    <div class="formal-meta">Agreement ID: ${escapeHtml(input.agreementRef)}<br/>Version: ${escapeHtml(input.versionLabel)}</div>
  </div>
  <h1 class="formal-title">${escapeHtml(input.title)}</h1>
  <p class="formal-campaign">${escapeHtml(input.campaign)}</p>
  ${input.draft ? `<p class="formal-draft">Draft — not executed</p>` : ""}
</header>`);

  if (!kinds.has("parties")) chunks.push(partiesHtml(input.parties));

  for (const section of sections) {
    const kind = sectionKind(section);
    if (kind === "parties") {
      chunks.push(partiesHtml(input.parties));
      continue;
    }
    if (kind === "compensation") {
      chunks.push(compensationHtml(input));
      if (!kinds.has("milestones")) chunks.push(milestonesHtml(input));
      continue;
    }
    if (kind === "milestones") {
      chunks.push(milestonesHtml(input));
      continue;
    }
    if (section.heading) {
      chunks.push(
        `<section class="formal-section">${sectionBar(section.heading)}<div class="formal-section-body">${bodyLinesHtml(
          section.lines,
        )}</div></section>`,
      );
    } else {
      chunks.push(`<div class="formal-section"><div class="formal-section-body">${bodyLinesHtml(section.lines)}</div></div>`);
    }
  }

  if (!kinds.has("compensation")) {
    chunks.push(compensationHtml(input));
    chunks.push(milestonesHtml(input));
  }

  chunks.push(executionHtml(input.parties));
  chunks.push(
    `<footer class="formal-footer"><span class="rule"></span>${escapeHtml(
      input.footerNote || "Agreement preview",
    )}<span class="rule"></span></footer>`,
  );

  return `<article class="formal-agreement">${chunks.join("\n")}</article>`;
}
