/**
 * PDF renderer that mirrors FormalAgreementDocument (Document tab layout).
 * Absolute coordinates keep section bars, tables, and signature blocks aligned.
 */
import {
  isFieldRow,
  parseAgreementBodySections,
  splitFieldRow,
  type AgreementBodySection,
} from "@/lib/contract-body-sections";
import { asciiForPdf } from "@/lib/contract-pdf";
import { stripSignatureTokens } from "@/lib/contract-signature-text";
import { drawnInkHasContent, drawnInkToPdfPath, parseDrawnInk } from "@/lib/signing/drawn-ink";
import {
  renderNameSignature,
  signatureToPdfPath,
  type RenderedSignature,
} from "@/lib/signing/signature-engine";

export type FormalPdfParty = {
  role: "business" | "influencer";
  legalName: string;
  handle?: string;
  signerName?: string;
  capacity?: string;
  signedAtLabel?: string;
  signed?: boolean;
  signatureInkJson?: string;
  signatureInkSvg?: string;
};

export type FormalPdfMilestone = {
  title: string;
  shareLabel: string;
  grossLabel: string;
  feeLabel?: string;
  netLabel?: string;
};

export type FormalPdfInput = {
  title: string;
  campaign: string;
  agreementRef: string;
  versionLabel: string;
  parties: FormalPdfParty[];
  body: string;
  compensation: {
    grossLabel: string;
    feeLabel: string;
    taxLabel?: string;
    netLabel: string;
  };
  milestones: FormalPdfMilestone[];
  showFeeColumns?: boolean;
  draft?: boolean;
  footerNote?: string;
};

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 50;
const CONTENT_W = 512;
const BOTTOM = 72;
const INDIGO = "0.106 0.078 0.392";
const NAVY = "0.067 0.102 0.353";
const MUTED = "0.4 0.44 0.52";
const BODY = "0.106 0.078 0.392";
const BLUE = "0.161 0.475 1";

function esc(value: string): string {
  return asciiForPdf(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text: string, widthChars: number): string[] {
  const lines: string[] = [];
  for (const raw of asciiForPdf(text).split("\n")) {
    if (!raw.trim()) {
      lines.push("");
      continue;
    }
    let rest = raw;
    while (rest.length > widthChars) {
      let cut = rest.lastIndexOf(" ", widthChars);
      if (cut < 20) cut = widthChars;
      lines.push(rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
    }
    lines.push(rest);
  }
  return lines.length ? lines : [""];
}

function drawInk(commands: string[], signature: RenderedSignature, x: number, y: number) {
  commands.push("q", "1.35 w", "0.08 0.08 0.14 RG", "1 J", "1 j");
  for (const op of signatureToPdfPath(signature, x, y)) commands.push(op);
  commands.push("S", "Q");
}

function drawPartyFormalInk(commands: string[], party: FormalPdfParty, x: number, y: number) {
  const drawn = party.signatureInkJson ? parseDrawnInk(party.signatureInkJson) : null;
  if (drawnInkHasContent(drawn) && drawn) {
    commands.push("q", "1.35 w", "0.08 0.08 0.14 RG", "1 J", "1 j");
    for (const op of drawnInkToPdfPath(drawn, x, y - 8, { targetWidth: 220 })) commands.push(op);
    commands.push("S", "Q");
    return;
  }
  if (party.signerName) {
    const ink = renderNameSignature(party.signerName, { emSize: 15 });
    drawInk(commands, ink, x, y - 8);
  }
}

type Page = { commands: string[] };

function newPage(): Page {
  return { commands: [] };
}

class FormalPdfBuilder {
  pages: Page[] = [newPage()];
  y = 0;
  showFeeColumns: boolean;

  constructor(private input: FormalPdfInput) {
    this.showFeeColumns = input.showFeeColumns !== false;
  }

  get page() {
    return this.pages[this.pages.length - 1]!;
  }

  push(...cmds: string[]) {
    this.page.commands.push(...cmds);
  }

  ensure(need: number) {
    if (this.y - need < BOTTOM) {
      this.pages.push(newPage());
      this.drawChrome(false);
    }
  }

  drawChrome(first: boolean) {
    const page = this.page;
    // Brand mark circle
    page.commands.push("q", `${BLUE} rg`, `${MARGIN_X} 762 16 16 re`, "f", "Q");
    page.commands.push("BT", "/F2 8 Tf", "1 1 1 rg", "54.5 767 Td", "(oo) Tj", "ET");
    page.commands.push("BT", "/F2 12 Tf", `${INDIGO} rg`, "72 766 Td", "(Influrios) Tj", "ET");
    page.commands.push(
      "BT",
      "/F1 8 Tf",
      `${MUTED} rg`,
      "400 774 Td",
      `(${esc(`Agreement ID: ${this.input.agreementRef}`)}) Tj`,
      "0 -11 Td",
      `(${esc(`Version: ${this.input.versionLabel}`)}) Tj`,
      "ET",
    );
    page.commands.push("q", `${INDIGO} RG`, "1 w", `${MARGIN_X} 752 m ${MARGIN_X + CONTENT_W} 752 l`, "S", "Q");

    if (first) {
      const title = this.input.title || "Collaboration Agreement";
      const titleShift = Math.max(MARGIN_X, Math.floor((PAGE_W - title.length * 18 * 0.48) / 2));
      page.commands.push("BT", "/F4 20 Tf", `${INDIGO} rg`, `${titleShift} 724 Td`, `(${esc(title)}) Tj`, "ET");
      if (this.input.campaign.trim()) {
        const campaign = this.input.campaign.trim().slice(0, 78);
        const cShift = Math.max(MARGIN_X, Math.floor((PAGE_W - campaign.length * 11 * 0.42) / 2));
        page.commands.push("BT", "/F5 11 Tf", "0.2 0.25 0.33 rg", `${cShift} 704 Td`, `(${esc(campaign)}) Tj`, "ET");
      }
      if (this.input.draft) {
        page.commands.push("BT", "/F2 9 Tf", "0.72 0.43 0 rg", "230 688 Td", "(Draft - not executed) Tj", "ET");
        this.y = 668;
      } else {
        this.y = 684;
      }
    } else {
      page.commands.push(
        "BT",
        "/F2 9 Tf",
        `${INDIGO} rg`,
        `${MARGIN_X} 732 Td`,
        `(${esc(`${this.input.title}  |  ${this.input.campaign}`.slice(0, 70))}) Tj`,
        "ET",
      );
      this.y = 714;
    }
  }

  sectionBar(label: string) {
    this.ensure(36);
    this.y -= 10;
    const barH = 18;
    const barY = this.y - barH;
    this.push("q", `${NAVY} rg`, `${MARGIN_X} ${barY} ${CONTENT_W} ${barH} re`, "f", "Q");
    this.push("BT", "/F2 9 Tf", "1 1 1 rg", `${MARGIN_X + 8} ${barY + 5} Td`, `(${esc(label.toUpperCase())}) Tj`, "ET");
    this.y = barY - 12;
  }

  text(text: string, opts?: { size?: number; font?: "F1" | "F2" | "F3" | "F4" | "F5"; color?: string; indent?: number; width?: number }) {
    const size = opts?.size ?? 10;
    const font = opts?.font ?? "F1";
    const color = opts?.color ?? BODY;
    const indent = opts?.indent ?? 0;
    const width = opts?.width ?? 88 - Math.floor(indent / 6);
    const leading = size + 3;
    for (const line of wrap(text, width)) {
      this.ensure(leading + 2);
      if (!line) {
        this.y -= leading * 0.55;
        continue;
      }
      this.push("BT", `/${font} ${size} Tf`, `${color} rg`, `${MARGIN_X + indent} ${this.y} Td`, `(${esc(line)}) Tj`, "ET");
      this.y -= leading;
    }
  }

  kvRow(label: string, value: string, emphasize = false) {
    this.ensure(18);
    const rowY = this.y;
    if (emphasize) {
      this.push("q", "0.957 0.965 0.984 rg", `${MARGIN_X} ${rowY - 4} ${CONTENT_W} 16 re`, "f", "Q");
    }
    this.push("q", "0.906 0.925 0.961 RG", "0.5 w", `${MARGIN_X} ${rowY - 4} m ${MARGIN_X + CONTENT_W} ${rowY - 4} l`, "S", "Q");
    this.push("BT", "/F2 10 Tf", "0.2 0.25 0.33 rg", `${MARGIN_X + 2} ${rowY} Td`, `(${esc(label)}) Tj`, "ET");
    const valueLines = wrap(value, 48);
    valueLines.forEach((line, index) => {
      if (index > 0) this.ensure(14);
      const y = rowY - index * 13;
      this.push(
        "BT",
        emphasize ? "/F2 10 Tf" : "/F1 10 Tf",
        `${BODY} rg`,
        `${MARGIN_X + 220} ${y} Td`,
        `(${esc(line)}) Tj`,
        "ET",
      );
    });
    this.y = rowY - Math.max(1, valueLines.length) * 15;
  }

  partiesBlock(parties: FormalPdfParty[]) {
    this.sectionBar("1. Parties");
    const business = parties.find((party) => party.role === "business");
    const influencers = parties.filter((party) => party.role === "influencer");
    this.kvRow("Business:", business?.legalName || "—");
    for (const party of influencers) {
      this.kvRow("Influencer:", party.legalName || "—");
      if (party.handle) {
        const handle = party.handle.startsWith("@") ? party.handle : `@${party.handle}`;
        this.kvRow("Platform handle:", handle);
      }
    }
    this.y -= 4;
    this.text(
      "Influrios records this collaboration on the platform. It is not a contracting party to this business-influencer agreement.",
      { size: 9, color: MUTED },
    );
  }

  compensationBlock() {
    this.sectionBar("3. Compensation");
    this.kvRow("Gross influencer compensation", this.input.compensation.grossLabel);
    this.kvRow("Influencer fee", `-${this.input.compensation.feeLabel.replace(/^-/, "")}`);
    if (this.input.compensation.taxLabel) {
      this.kvRow("Tax", this.input.compensation.taxLabel);
    }
    this.kvRow("Net compensation", this.input.compensation.netLabel, true);
  }

  milestonesBlock() {
    if (this.input.milestones.length === 0) return;
    this.ensure(50);
    this.y -= 14;
    this.push("BT", "/F4 16 Tf", `${INDIGO} rg`, `${MARGIN_X} ${this.y} Td`, "(Schedule A - Milestones) Tj", "ET");
    this.y -= 18;
    const headers = this.showFeeColumns
      ? ["Milestone", "Share", "Gross amount", "Influencer fee", "Net compensation"]
      : ["Milestone", "Share", "Gross amount"];
    const cols = this.showFeeColumns ? [150, 50, 90, 100, 122] : [220, 80, 212];
    this.ensure(20);
    this.push("q", `${INDIGO} RG`, "1.2 w", `${MARGIN_X} ${this.y + 2} m ${MARGIN_X + CONTENT_W} ${this.y + 2} l`, "S", "Q");
    let x = MARGIN_X;
    headers.forEach((header, index) => {
      const alignRight = index > 0;
      const textX = alignRight ? x + cols[index]! - header.length * 5.2 : x;
      this.push("BT", "/F2 8 Tf", `${INDIGO} rg`, `${Math.max(x, textX)} ${this.y - 10} Td`, `(${esc(header.toUpperCase())}) Tj`, "ET");
      x += cols[index]!;
    });
    this.y -= 18;
    const rows = [
      ...this.input.milestones.map((row) => [
        row.title,
        row.shareLabel,
        row.grossLabel,
        row.feeLabel || "—",
        row.netLabel || "—",
      ]),
      [
        "Total",
        "100%",
        this.input.compensation.grossLabel,
        this.input.compensation.feeLabel,
        this.input.compensation.netLabel,
      ],
    ];
    rows.forEach((row, rowIndex) => {
      this.ensure(18);
      if (rowIndex === rows.length - 1) {
        this.push("q", "0.957 0.965 0.984 rg", `${MARGIN_X} ${this.y - 4} ${CONTENT_W} 16 re`, "f", "Q");
      }
      this.push("q", "0.906 0.925 0.961 RG", "0.5 w", `${MARGIN_X} ${this.y - 4} m ${MARGIN_X + CONTENT_W} ${this.y - 4} l`, "S", "Q");
      let cx = MARGIN_X;
      const cells = this.showFeeColumns ? row : row.slice(0, 3);
      cells.forEach((cell, index) => {
        const font = rowIndex === rows.length - 1 ? "/F2" : "/F1";
        const alignRight = index > 0;
        const label = esc(cell);
        const textX = alignRight ? cx + cols[index]! - Math.min(cols[index]! - 4, label.length * 5.1) : cx + 2;
        this.push("BT", `${font} 9 Tf`, `${BODY} rg`, `${textX} ${this.y} Td`, `(${label}) Tj`, "ET");
        cx += cols[index]!;
      });
      this.y -= 16;
    });
  }

  bodySection(section: AgreementBodySection) {
    if (section.heading) this.sectionBar(section.heading);
    else this.y -= 6;
    let index = 0;
    const lines = section.lines;
    while (index < lines.length) {
      const line = lines[index] ?? "";
      if (!line.trim()) {
        this.y -= 6;
        index += 1;
        continue;
      }
      if (/^\s*[-·]\s+/.test(line)) {
        const items: string[] = [];
        while (index < lines.length && /^\s*[-·]\s+/.test(lines[index] ?? "")) {
          items.push((lines[index] ?? "").replace(/^\s*[-·]\s+/, "").trim());
          index += 1;
        }
        for (const item of items) this.text(`- ${item}`, { size: 10, indent: 8, width: 82 });
        continue;
      }
      if (isFieldRow(line)) {
        while (index < lines.length && isFieldRow(lines[index] ?? "")) {
          const split = splitFieldRow(lines[index] ?? "");
          if (split) this.kvRow(split.label, split.value);
          index += 1;
        }
        continue;
      }
      this.text(line, { size: 10 });
      index += 1;
    }
  }

  executionBlock() {
    this.sectionBar("Execution");
    const parties = this.input.parties;
    const colW = (CONTENT_W - 24) / 2;
    this.ensure(110);
    parties.forEach((party, index) => {
      const x = MARGIN_X + index * (colW + 24);
      const heading = party.role === "business" ? `For ${party.legalName}` : party.legalName || "Influencer";
      this.push("BT", "/F2 11 Tf", `${INDIGO} rg`, `${x} ${this.y} Td`, `(${esc(heading)}) Tj`, "ET");
      let localY = this.y - 22;
      if (party.signed && party.signerName) {
        drawPartyFormalInk(this.page.commands, party, x, localY);
        localY -= 28;
        this.push("BT", "/F1 10 Tf", `${BODY} rg`, `${x} ${localY} Td`, `(${esc(`Printed name: ${party.signerName}`)}) Tj`, "ET");
        localY -= 14;
        this.push(
          "BT",
          "/F1 10 Tf",
          `${BODY} rg`,
          `${x} ${localY} Td`,
          `(${esc(`Capacity: ${party.capacity || (party.role === "business" ? "Authorized representative" : "Influencer")}`)}) Tj`,
          "ET",
        );
        localY -= 14;
        this.push("BT", "/F1 10 Tf", `${BODY} rg`, `${x} ${localY} Td`, `(${esc(`Date: ${party.signedAtLabel || "—"}`)}) Tj`, "ET");
      } else {
        for (const label of ["Printed name:", "Capacity:", "Date:"]) {
          this.push("BT", "/F1 10 Tf", `${MUTED} rg`, `${x} ${localY} Td`, `(${esc(label)}) Tj`, "ET");
          this.push("q", "0.6 0.64 0.7 RG", "0.7 w", `${x + 70} ${localY} m ${x + colW - 8} ${localY} l`, "S", "Q");
          localY -= 18;
        }
      }
    });
    this.y -= 100;
  }

  footer() {
    const note = this.input.footerNote || "Agreement preview";
    for (let i = 0; i < this.pages.length; i += 1) {
      const page = this.pages[i]!;
      page.commands.push("q", `${INDIGO} RG`, "0.8 w", `${MARGIN_X} 56 m ${MARGIN_X + CONTENT_W} 56 l`, "S", "Q");
      page.commands.push(
        "BT",
        "/F3 9 Tf",
        `${MUTED} rg`,
        `${MARGIN_X} 42 Td`,
        `(${esc(note)}) Tj`,
        "ET",
      );
      page.commands.push(
        "BT",
        "/F1 8 Tf",
        `${MUTED} rg`,
        `480 42 Td`,
        `(${esc(`Page ${i + 1} of ${this.pages.length}`)}) Tj`,
        "ET",
      );
    }
  }

  build(): Buffer {
    this.drawChrome(true);
    const cleanedBody = stripSignatureTokens(this.input.body);
    const sections = parseAgreementBodySections(cleanedBody);
    const kinds = new Set(
      sections.map((section) => {
        const heading = (section.heading ?? "").toLowerCase();
        if (/^1\.\s+parties/.test(heading)) return "parties";
        if (/^3\.\s+compensation/.test(heading)) return "compensation";
        if (/^4\.\s+milestone/.test(heading)) return "milestones";
        return "other";
      }),
    );

    if (!kinds.has("parties")) this.partiesBlock(this.input.parties);

    for (const section of sections) {
      const heading = (section.heading ?? "").toLowerCase();
      if (/^1\.\s+parties/.test(heading)) {
        this.partiesBlock(this.input.parties);
        continue;
      }
      if (/^3\.\s+compensation/.test(heading)) {
        this.compensationBlock();
        if (!kinds.has("milestones")) this.milestonesBlock();
        continue;
      }
      if (/^4\.\s+milestone/.test(heading)) {
        this.milestonesBlock();
        continue;
      }
      this.bodySection(section);
    }

    if (!kinds.has("compensation")) {
      this.compensationBlock();
      this.milestonesBlock();
    }

    this.executionBlock();
    this.footer();
    return assemblePdf(this.pages);
  }
}

function assemblePdf(pages: Page[]): Buffer {
  const fontRegularId = 3 + pages.length * 2;
  const fontBoldId = fontRegularId + 1;
  const fontObliqueId = fontRegularId + 2;
  const fontTimesBoldId = fontRegularId + 3;
  const fontTimesItalicId = fontRegularId + 4;
  const parts: { id: number; body: string }[] = [];
  const kids: number[] = [];

  pages.forEach((page, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    kids.push(pageId);
    const stream = page.commands.join("\n");
    parts.push({
      id: contentId,
      body: `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    });
    parts.push({
      id: pageId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontObliqueId} 0 R /F4 ${fontTimesBoldId} 0 R /F5 ${fontTimesItalicId} 0 R >> >> >>`,
    });
  });

  const objects = [
    { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    {
      id: 2,
      body: `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    },
    ...parts,
    { id: fontRegularId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" },
    { id: fontBoldId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>" },
    { id: fontObliqueId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>" },
    { id: fontTimesBoldId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>" },
    { id: fontTimesItalicId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>" },
  ].sort((a, b) => a.id - b.id);

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const object of objects) {
    offsets[object.id] = Buffer.byteLength(out);
    out += `${object.id} 0 obj\n${object.body}\nendobj\n`;
  }
  const xrefAt = Buffer.byteLength(out);
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= objects.length; id += 1) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return Buffer.from(out + xref, "utf8");
}

/** Render a PDF that matches the on-screen FormalAgreementDocument layout. */
export function renderFormalAgreementPdf(input: FormalPdfInput): Buffer {
  return new FormalPdfBuilder(input).build();
}
