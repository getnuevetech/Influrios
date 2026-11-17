/**
 * Split a stored collaboration agreement body into readable sections for the formal Document tab.
 * Preserves the approved 19-section content; does not invent clauses.
 */
import { stripSignatureTokens } from "@/lib/contract-signature-text";

export type AgreementBodySection = {
  id: string;
  heading: string | null;
  lines: string[];
};

/** Real clause headings look like "2. Campaign Scope…", not milestone rows like "1. Kickoff  34%  $1,428". */
const NUMBERED = /^(\d+)\.\s+([A-Za-z].+)$/;
const SUBTITLE =
  /^(Agreement purpose|Commercial Summary|Signature Audit Record|END OF\b.*|Schedule A\b.*)$/i;

function isNumberedClauseHeading(line: string): RegExpExecArray | null {
  const trimmed = line.trim();
  const numbered = NUMBERED.exec(trimmed);
  if (!numbered) return null;
  // Milestone / share table rows keep several spaced columns after the title.
  if (trimmed.split(/[ \t]{2,}|\t/).length >= 3) return null;
  if (/\$\d/.test(trimmed) && /\d+%/.test(trimmed)) return null;
  return numbered;
}

/** Drop trailing signature ink / audit lines — the formal Execution block replaces them. */
export function trimSignatureTrailer(body: string): string {
  const cleaned = stripSignatureTokens(body);
  const cutMarkers = [
    /\n19\.\s+Electronic Signature\b/i,
    /\nParty\s{2,}Signer\s{2,}Email\s{2,}Signature Status\b/i,
    /\nSignature Audit Record\b/i,
    /\nEND OF COLLABORATION AGREEMENT\b/i,
  ];
  let end = cleaned.length;
  for (const marker of cutMarkers) {
    const match = marker.exec(cleaned);
    if (match?.index != null && match.index < end) end = match.index;
  }
  return cleaned.slice(0, end).trim();
}

/**
 * Remove the short chrome header that the formal article already renders
 * (title, agreement id row) so the Document tab does not repeat it.
 */
export function stripLeadingChrome(body: string): string {
  const lines = body.split("\n");
  let index = 0;
  while (index < lines.length && !lines[index]!.trim()) index += 1;
  if (index < lines.length && /^COLLABORATION AGREEMENT$/i.test(lines[index]!.trim())) {
    index += 1;
    while (index < lines.length && !lines[index]!.trim()) index += 1;
    // campaign title line
    if (index < lines.length && !NUMBERED.test(lines[index]!.trim()) && !SUBTITLE.test(lines[index]!.trim())) {
      index += 1;
    }
    while (index < lines.length && !lines[index]!.trim()) index += 1;
    if (index < lines.length && /^Agreement ID Status Generated Jurisdiction$/i.test(lines[index]!.trim())) {
      index += 1;
      if (index < lines.length) index += 1; // values row
    }
    while (index < lines.length && !lines[index]!.trim()) index += 1;
  }
  return lines.slice(index).join("\n").trim();
}

export function parseAgreementBodySections(body: string): AgreementBodySection[] {
  const prepared = stripLeadingChrome(trimSignatureTrailer(body));
  if (!prepared) return [];
  const lines = prepared.split("\n");
  const sections: AgreementBodySection[] = [];
  let current: AgreementBodySection = { id: "preamble", heading: null, lines: [] };

  const push = () => {
    if (current.heading || current.lines.some((line) => line.trim())) {
      sections.push({
        id: current.id,
        heading: current.heading,
        lines: current.lines,
      });
    }
  };

  for (const raw of lines) {
    const trimmed = raw.trimEnd();
    const numbered = isNumberedClauseHeading(trimmed);
    if (numbered) {
      push();
      current = {
        id: `section-${numbered[1]}`,
        heading: `${numbered[1]}. ${numbered[2]!.trim()}`,
        lines: [],
      };
      continue;
    }
    if (SUBTITLE.test(trimmed.trim()) && current.lines.length > 0) {
      push();
      current = {
        id: `block-${sections.length + 1}`,
        heading: trimmed.trim(),
        lines: [],
      };
      continue;
    }
    current.lines.push(trimmed);
  }
  push();
  return sections;
}

/** True when a line looks like a two-column field row from the template. */
export function isFieldRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("-") || trimmed.startsWith("·")) return false;
  return /\S[ \t]{2,}\S/.test(trimmed) || /^(Item|Field|Commercial Item|Party Type|Milestone|Usage Field|Influencer)\b/i.test(trimmed);
}

export function splitFieldRow(line: string): { label: string; value: string } | null {
  const trimmed = line.trim();
  if (/^(Item|Field|Commercial Item|Party Type|Milestone|Usage Field|Influencer)\b/i.test(trimmed) && trimmed.split(/[ \t]{2,}|\t/).length >= 2) {
    return null; // table header
  }
  const parts = trimmed.split(/[ \t]{2,}|\t/);
  if (parts.length >= 2) {
    return { label: parts[0]!.trim(), value: parts.slice(1).join("  ").trim() };
  }
  return null;
}
