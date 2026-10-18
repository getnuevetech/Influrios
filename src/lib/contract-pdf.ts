/**
 * Structured PDF layout for Influrios collaboration agreements.
 * Matches the approved template: header, numbered sections, signature ink,
 * and per-page endorsement initials.
 */
import {
  renderInitialsSignature,
  renderNameSignature,
  signatureToPdfPath,
  type RenderedSignature,
} from "@/lib/signing/signature-engine";

/** Map common Unicode punctuation to PDF-safe ASCII. Newlines must stay intact. */
export function asciiForPdf(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u00B7\u2022\u2023\u2043]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x20-\x7E]/g, "?");
}

export type ContractPdfLineStyle =
  | "title"
  | "subtitle"
  | "heading"
  | "meta"
  | "body"
  | "indent"
  | "table_header"
  | "table_row"
  | "signature"
  | "signature_ink"
  | "spacer";

export type ContractPdfLine = {
  text: string;
  style: ContractPdfLineStyle;
  /** 1-based party index when this line is a signature ink placeholder. */
  signatureParty?: number;
};

export type ContractPdfSignature = {
  partyIndex: number;
  typedName: string;
  role: string;
  email: string;
  signedAt: string;
};

export type ContractPdfEndorsementSlot = {
  partyIndex: number;
  role: string;
  typedName?: string;
};

export type ContractPdfOptions = {
  agreementId?: string;
  title?: string;
  signatures?: ContractPdfSignature[];
  /** All parties (signed + pending) for the page endorsement strip. */
  endorsementSlots?: ContractPdfEndorsementSlot[];
  /** When true, stamp initials endorsement strip on every content page. */
  pageEndorsements?: boolean;
};

const PDF_LINE_WIDTH: Record<ContractPdfLineStyle, number> = {
  title: 58,
  subtitle: 72,
  heading: 78,
  meta: 88,
  body: 88,
  indent: 84,
  table_header: 88,
  table_row: 88,
  signature: 84,
  signature_ink: 84,
  spacer: 88,
};

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function wrapContractLines(text: string, width = 88): string[] {
  const lines: string[] = [];
  for (const raw of asciiForPdf(text).split("\n")) {
    if (!raw.trim()) {
      lines.push("");
      continue;
    }
    let rest = raw;
    while (rest.length > width) {
      let cut = rest.lastIndexOf(" ", width);
      if (cut < 20) cut = width;
      lines.push(rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
    }
    lines.push(rest);
  }
  return lines.length > 0 ? lines : [""];
}

function isSectionHeading(line: string): boolean {
  return /^\d+\.\s+\S/.test(line.trim());
}

function isTitleLine(line: string, seenBody: boolean): boolean {
  if (seenBody) return false;
  const trimmed = line.trim();
  if (trimmed.length < 8 || trimmed.length > 72) return false;
  return /^[A-Z0-9][A-Z0-9 ,.'&/\-]{7,}$/.test(trimmed);
}

function isTableHeader(line: string): boolean {
  const trimmed = line.trim();
  return (
    /^(Item|Party Type|Field|Commercial Item|Milestone|Influencer|Usage Field|Party)\s+/i.test(trimmed) &&
    trimmed.split(/\s{2,}|\t/).length >= 2
  );
}

/** Classify agreement lines so the PDF can use title / heading / body hierarchy. */
export function classifyContractPdfLines(text: string): ContractPdfLine[] {
  const rawLines = wrapContractLines(text, 88);
  const out: ContractPdfLine[] = [];
  let seenBody = false;
  let titleUsed = false;
  for (const line of rawLines) {
    if (!line.trim()) {
      out.push({ text: "", style: "spacer" });
      continue;
    }
    if (!titleUsed && isTitleLine(line, seenBody)) {
      out.push({ text: line.trim(), style: "title" });
      titleUsed = true;
      continue;
    }
    if (/^Agreement (ID|purpose|Hash)/i.test(line.trim()) || /^Generated:/i.test(line.trim())) {
      out.push({ text: line.trim(), style: "meta" });
      seenBody = true;
      continue;
    }
    if (/^Commercial Summary|^Signature Audit Record|^END OF /i.test(line.trim())) {
      out.push({ text: line.trim(), style: "subtitle" });
      seenBody = true;
      continue;
    }
    if (isSectionHeading(line)) {
      out.push({ text: line.trim(), style: "heading" });
      seenBody = true;
      continue;
    }
    const inkMatch = line.match(/\[\[SIG_INK:(\d+)\]\]/i);
    if (inkMatch) {
      out.push({ text: "", style: "signature_ink", signatureParty: Number(inkMatch[1]) });
      seenBody = true;
      continue;
    }
    if (/^Signed in Influrios/i.test(line.trim()) || /\/sig\d+\//i.test(line) || /\[\[SIG:/i.test(line)) {
      out.push({ text: line, style: "signature" });
      seenBody = true;
      continue;
    }
    if (isTableHeader(line)) {
      out.push({ text: line.trim(), style: "table_header" });
      seenBody = true;
      continue;
    }
    if (/^\s{2,}/.test(line) || /^[-*]\s/.test(line.trim()) || /^[·•]\s/.test(line.trim())) {
      out.push({ text: line.replace(/^\s+/, "    ").replace(/^[·•]\s/, "- "), style: "indent" });
      seenBody = true;
      continue;
    }
    const width = PDF_LINE_WIDTH.body;
    let rest = line;
    while (rest.length > width) {
      let cut = rest.lastIndexOf(" ", width);
      if (cut < 20) cut = width;
      out.push({ text: rest.slice(0, cut).trimEnd(), style: "body" });
      rest = rest.slice(cut).trimStart();
    }
    out.push({ text: rest, style: "body" });
    seenBody = true;
  }
  return out.length > 0 ? out : [{ text: "", style: "spacer" }];
}

function pdfFontAndSize(style: ContractPdfLineStyle): { font: "F1" | "F2" | "F3"; size: number; leading: number } {
  switch (style) {
    case "title":
      return { font: "F2", size: 16, leading: 22 };
    case "subtitle":
      return { font: "F2", size: 11, leading: 16 };
    case "heading":
      return { font: "F2", size: 11, leading: 18 };
    case "meta":
      return { font: "F3", size: 9, leading: 12 };
    case "table_header":
      return { font: "F2", size: 9, leading: 13 };
    case "table_row":
      return { font: "F1", size: 9, leading: 13 };
    case "signature":
      return { font: "F3", size: 9, leading: 12 };
    case "signature_ink":
      return { font: "F1", size: 10, leading: 36 };
    case "indent":
      return { font: "F1", size: 9.5, leading: 13 };
    case "spacer":
      return { font: "F1", size: 10, leading: 8 };
    default:
      return { font: "F1", size: 9.5, leading: 13 };
  }
}

function paginateContractLines(lines: ContractPdfLine[]): ContractPdfLine[][] {
  const pages: ContractPdfLine[][] = [];
  const top = 720;
  const bottom = 88;
  let current: ContractPdfLine[] = [];
  let y = top;
  for (const line of lines) {
    const { leading } = pdfFontAndSize(line.style);
    if (current.length > 0 && y - leading < bottom) {
      pages.push(current);
      current = [];
      y = top;
    }
    current.push(line);
    y -= leading;
  }
  if (current.length > 0 || pages.length === 0) pages.push(current.length ? current : [{ text: "", style: "spacer" }]);
  return pages;
}

function findSignature(signatures: ContractPdfSignature[] | undefined, partyIndex: number): ContractPdfSignature | undefined {
  return signatures?.find((row) => row.partyIndex === partyIndex);
}

function drawInk(commands: string[], signature: RenderedSignature, x: number, y: number, strokeWidth = 1.35) {
  commands.push("q");
  commands.push(`${strokeWidth} w`);
  commands.push("0.08 0.08 0.14 RG");
  commands.push("1 J");
  commands.push("1 j");
  for (const op of signatureToPdfPath(signature, x, y)) {
    commands.push(op);
  }
  commands.push("S");
  commands.push("Q");
}

function headerCommands(pageIndex: number, title?: string): string[] {
  const commands: string[] = [];
  // Solid brand bar so every downloaded page clearly uses Influrios chrome.
  commands.push("q");
  commands.push("0.12 0.16 0.42 rg");
  commands.push("0 760 612 32 re");
  commands.push("f");
  commands.push("Q");
  commands.push("BT");
  commands.push("/F2 9 Tf");
  commands.push("1 1 1 rg");
  commands.push("50 771 Td");
  const label =
    pageIndex === 0
      ? "INFLURIOS  |  COLLABORATION AGREEMENT"
      : `INFLURIOS  |  COLLABORATION AGREEMENT  |  ${(title ?? "GENERATED CONTRACT").slice(0, 40).toUpperCase()}`;
  commands.push(`(${pdfEscape(label)}) Tj`);
  commands.push("0 0 0 rg");
  commands.push("ET");
  return commands;
}

function footerCommands(input: {
  pageIndex: number;
  pageCount: number;
  agreementId?: string;
  signatures?: ContractPdfSignature[];
  endorsementSlots?: ContractPdfEndorsementSlot[];
  pageEndorsements: boolean;
}): string[] {
  const commands: string[] = [];
  commands.push("q");
  commands.push("0.15 0.2 0.45 RG");
  commands.push("0.8 w");
  commands.push("50 72 m 562 72 l S");
  commands.push("Q");

  if (input.pageEndorsements) {
    commands.push("BT");
    commands.push("/F3 7 Tf");
    commands.push("50 58 Td");
    commands.push("(Page endorsement / initials) Tj");
    commands.push("ET");

    const fromSlots = (input.endorsementSlots ?? [])
      .slice()
      .sort((a, b) => a.partyIndex - b.partyIndex)
      .map((slot) => ({
        partyIndex: slot.partyIndex,
        role: slot.role,
        typedName: slot.typedName ?? "",
      }));
    const fromSignatures = [...(input.signatures ?? [])]
      .sort((a, b) => a.partyIndex - b.partyIndex)
      .map((row) => ({
        partyIndex: row.partyIndex,
        role: row.role,
        typedName: row.typedName,
      }));
    // Prefer explicit slots (includes pending parties); fall back to signed-only, then blanks.
    const slots =
      fromSlots.length > 0
        ? fromSlots
        : fromSignatures.length > 0
          ? fromSignatures
          : [
              { partyIndex: 1, typedName: "", role: "business" },
              { partyIndex: 2, typedName: "", role: "creator" },
            ];
    let x = 160;
    for (const slot of slots.slice(0, 4)) {
      const label = slot.role === "business" ? "Business" : "Influencer";
      commands.push("BT");
      commands.push("/F1 7 Tf");
      commands.push(`${x} 58 Td`);
      commands.push(`(${pdfEscape(label)}:) Tj`);
      commands.push("ET");
      if (slot.typedName) {
        const ink = renderInitialsSignature(slot.typedName, { emSize: 9 });
        drawInk(commands, ink, x + 42, 48, 1.1);
      } else {
        commands.push("q");
        commands.push("0.55 0.55 0.6 RG");
        commands.push("0.6 w");
        commands.push(`${x + 42} 52 m ${x + 88} 52 l S`);
        commands.push("Q");
      }
      x += 110;
    }
  }

  commands.push("BT");
  commands.push("/F3 8 Tf");
  commands.push("50 36 Td");
  const idPart = input.agreementId ? `  -  ${input.agreementId.slice(0, 24)}` : "";
  commands.push(
    `(${pdfEscape(`Influrios collaboration agreement${idPart}  -  page ${input.pageIndex + 1} of ${input.pageCount}`)}) Tj`,
  );
  commands.push("ET");
  return commands;
}

/** Multi-page Helvetica PDF with cursive signature ink and page endorsements. */
export function renderContractPdf(text: string, options: ContractPdfOptions = {}): Buffer {
  const classified = classifyContractPdfLines(text);
  const pages = paginateContractLines(classified);
  const fontRegularId = 3 + pages.length * 2;
  const fontBoldId = fontRegularId + 1;
  const fontObliqueId = fontRegularId + 2;
  const parts: { id: number; body: string }[] = [];
  const kids: number[] = [];
  const pageEndorsements = options.pageEndorsements !== false;
  const signatures = options.signatures ?? [];
  const endorsementSlots = options.endorsementSlots;

  pages.forEach((pageLines, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    kids.push(pageId);
    const commands: string[] = [...headerCommands(index, options.title)];
    commands.push("BT");
    let y = 720;
    let currentFont: string | null = null;
    let currentSize: number | null = null;
    let textOpen = true;

    const ensureText = () => {
      if (!textOpen) {
        commands.push("BT");
        textOpen = true;
        currentFont = null;
        currentSize = null;
      }
    };
    const endText = () => {
      if (textOpen) {
        commands.push("ET");
        textOpen = false;
      }
    };

    pageLines.forEach((line, lineIndex) => {
      const { font, size, leading } = pdfFontAndSize(line.style);

      if (line.style === "signature_ink") {
        endText();
        const party = findSignature(signatures, line.signatureParty ?? 0);
        const inkY = y - 28;
        if (party?.typedName) {
          const ink = renderNameSignature(party.typedName, { emSize: 16 });
          drawInk(commands, ink, 56, inkY, 1.45);
        } else {
          commands.push("q");
          commands.push("0.55 0.55 0.6 RG");
          commands.push("0.7 w");
          commands.push(`56 ${inkY + 8} m 280 ${inkY + 8} l S`);
          commands.push("Q");
        }
        y -= leading;
        ensureText();
        commands.push(`/${font} ${size} Tf`);
        commands.push(`50 ${y} Td`);
        currentFont = font;
        currentSize = size;
        commands.push(`() Tj`);
        return;
      }

      ensureText();
      if (lineIndex === 0 || !currentFont) {
        commands.push(`/${font} ${size} Tf`);
        commands.push(`50 ${y} Td`);
        currentFont = font;
        currentSize = size;
      } else {
        if (font !== currentFont || size !== currentSize) {
          commands.push(`/${font} ${size} Tf`);
          currentFont = font;
          currentSize = size;
        }
        commands.push(`0 -${leading} Td`);
        y -= leading;
      }

      if (line.style === "title") {
        const approxChar = size * 0.48;
        const textWidth = line.text.length * approxChar;
        const shift = Math.max(0, Math.floor((512 - textWidth) / 2));
        if (shift > 0) commands.push(`${shift} 0 Td`);
        commands.push(`(${pdfEscape(line.text)}) Tj`);
        if (shift > 0) commands.push(`${-shift} 0 Td`);
      } else if (line.style === "spacer") {
        commands.push(`() Tj`);
      } else if (line.style === "signature" && /\[\[SIG:/i.test(line.text)) {
        // Human-readable attestation under ink; strip machine markers.
        const cleaned = line.text.replace(/\[\[SIG:[^\]]+\]\]/g, "").trim();
        commands.push(`(${pdfEscape(cleaned || line.text)}) Tj`);
      } else {
        commands.push(`(${pdfEscape(line.text)}) Tj`);
      }
      if (lineIndex === 0) y -= leading;
    });

    endText();
    commands.push(
      ...footerCommands({
        pageIndex: index,
        pageCount: pages.length,
        agreementId: options.agreementId,
        signatures,
        endorsementSlots,
        pageEndorsements,
      }),
    );

    const stream = commands.join("\n");
    parts.push({
      id: contentId,
      body: `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    });
    parts.push({
      id: pageId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontObliqueId} 0 R >> >> >>`,
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

/** Collect PDF signature overlays from party rows (signed parties only). */
export function signaturesFromParties(
  parties: {
    role: string;
    email: string;
    attestation: string | null;
    signedAt: Date | null;
    status: string;
    name?: string | null;
  }[],
): ContractPdfSignature[] {
  const out: ContractPdfSignature[] = [];
  parties.forEach((party, index) => {
    if (party.status !== "signed") return;
    const typedName = (party.attestation || party.name || "").trim();
    if (!typedName) return;
    out.push({
      partyIndex: index + 1,
      typedName,
      role: party.role,
      email: party.email,
      signedAt: party.signedAt?.toISOString() ?? "",
    });
  });
  return out;
}

/** Page-endorsement slots for every party (blank line until signed). */
export function endorsementSlotsFromParties(
  parties: { role: string; attestation: string | null; status: string; name?: string | null }[],
): ContractPdfEndorsementSlot[] {
  return parties.map((party, index) => ({
    partyIndex: index + 1,
    role: party.role,
    typedName: party.status === "signed" ? (party.attestation || party.name || "").trim() : "",
  }));
}
