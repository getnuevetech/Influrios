/**
 * Influrios Collaboration Agreement PDF — matches the approved design template:
 * logo wordmark, navy table headers, purpose callout, serif title, section chrome.
 */
import { readFileSync } from "fs";
import { join } from "path";
import type { ContractPdfOptions, ContractPdfSignature } from "@/lib/contract-pdf";
import type { ContractTemplateValues } from "@/lib/contract-template-values";
import {
  renderInitialsSignature,
  renderNameSignature,
  signatureToPdfPath,
} from "@/lib/signing/signature-engine";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 45;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

// Template colors (from approved PDF)
const NAVY = { r: 0.027, g: 0.078, b: 0.369 }; // #07135E
const PURPLE = { r: 0.416, g: 0.247, b: 0.498 }; // #6A3F7F
const BODY = { r: 0.06, g: 0.09, b: 0.22 };
const MUTED = { r: 0.41, g: 0.49, b: 0.55 };
const ROW_ALT = { r: 0.973, g: 0.98, b: 1.0 };
const PURPOSE_BG = { r: 0.961, g: 0.969, b: 1.0 };
const WHITE = { r: 1, g: 1, b: 1 };
const RULE = { r: 0.78, g: 0.82, b: 0.88 };

type RGB = { r: number; g: number; b: number };

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function ascii(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x20-\x7E]/g, "?");
}

function v(values: ContractTemplateValues, key: string): string {
  return ascii((values[key] ?? "").trim());
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const raw of ascii(text).split("\n")) {
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
  return lines.length ? lines : [""];
}

function loadLogo(kind: "lg" | "sm"): { bytes: Buffer; width: number; height: number } {
  const file = kind === "lg" ? "influrios-wordmark.jpg" : "influrios-wordmark-sm.jpg";
  const candidates = [
    join(process.cwd(), "src/assets/contracts", file),
    join(process.cwd(), "public/brand/logo", file),
    join(__dirname, "../assets/contracts", file),
  ];
  for (const path of candidates) {
    try {
      const bytes = readFileSync(path);
      // Dimensions known from extracted assets
      return {
        bytes,
        width: kind === "lg" ? 616 : 353,
        height: kind === "lg" ? 205 : 118,
      };
    } catch {
      /* try next */
    }
  }
  throw new Error("Influrios contract logo asset is missing.");
}

type Cmd = string;

class PageBuilder {
  cmds: Cmd[] = [];
  y = 742;

  rg(c: RGB) {
    this.cmds.push(`${c.r.toFixed(3)} ${c.g.toFixed(3)} ${c.b.toFixed(3)} rg`);
  }
  RG(c: RGB) {
    this.cmds.push(`${c.r.toFixed(3)} ${c.g.toFixed(3)} ${c.b.toFixed(3)} RG`);
  }
  rect(x: number, y: number, w: number, h: number, fill?: RGB, stroke?: RGB) {
    if (fill) {
      this.rg(fill);
      this.cmds.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
      this.cmds.push(stroke ? "B" : "f");
    }
    if (stroke && !fill) {
      this.RG(stroke);
      this.cmds.push("0.6 w");
      this.cmds.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
      this.cmds.push("S");
    }
    if (fill && stroke) {
      this.RG(stroke);
      this.cmds.push("0.6 w");
      this.cmds.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
      this.cmds.push("S");
    }
  }
  text(input: {
    x: number;
    y: number;
    text: string;
    font?: "F1" | "F2" | "F3";
    size?: number;
    color?: RGB;
  }) {
    const font = input.font ?? "F1";
    const size = input.size ?? 9;
    const color = input.color ?? BODY;
    this.cmds.push("BT");
    this.rg(color);
    this.cmds.push(`/${font} ${size} Tf`);
    this.cmds.push(`${input.x.toFixed(2)} ${input.y.toFixed(2)} Td`);
    this.cmds.push(`(${pdfEscape(ascii(input.text))}) Tj`);
    this.cmds.push("ET");
  }
  image(name: string, x: number, y: number, w: number, h: number) {
    this.cmds.push("q");
    this.cmds.push(`${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`);
    this.cmds.push(`/${name} Do`);
    this.cmds.push("Q");
  }
  ink(signatureName: string, x: number, y: number, em = 14) {
    const ink = renderNameSignature(signatureName, { emSize: em });
    this.cmds.push("q");
    this.cmds.push("1.35 w");
    this.RG(NAVY);
    this.cmds.push("1 J");
    this.cmds.push("1 j");
    for (const op of signatureToPdfPath(ink, x, y)) this.cmds.push(op);
    this.cmds.push("S");
    this.cmds.push("Q");
  }
  initials(signatureName: string, x: number, y: number) {
    const ink = renderInitialsSignature(signatureName, { emSize: 9 });
    this.cmds.push("q");
    this.cmds.push("1.1 w");
    this.RG(NAVY);
    this.cmds.push("1 J");
    this.cmds.push("1 j");
    for (const op of signatureToPdfPath(ink, x, y)) this.cmds.push(op);
    this.cmds.push("S");
    this.cmds.push("Q");
  }
}

function ensureSpace(page: PageBuilder, need: number, pages: PageBuilder[], onNew: (p: PageBuilder) => void) {
  if (page.y - need < 88) {
    pages.push(page);
    const next = new PageBuilder();
    onNew(next);
    return next;
  }
  return page;
}

function drawContinuationHeader(page: PageBuilder, smallLogo: { drawW: number; drawH: number }) {
  page.image("LogoSm", MARGIN_X, PAGE_H - 64, smallLogo.drawW, smallLogo.drawH);
  page.text({
    x: MARGIN_X + smallLogo.drawW + 10,
    y: PAGE_H - 48,
    text: "INFLURIOS | COLLABORATION AGREEMENT | GENERATED CONTRACT",
    font: "F1",
    size: 6.5,
    color: MUTED,
  });
  page.y = PAGE_H - 78;
}

function drawFooter(
  page: PageBuilder,
  pageIndex: number,
  pageCount: number,
  agreementId: string,
  signatures: ContractPdfSignature[],
) {
  page.RG(NAVY);
  page.cmds.push("0.8 w");
  page.cmds.push(`${MARGIN_X} 72 m ${PAGE_W - MARGIN_X} 72 l S`);
  page.text({
    x: MARGIN_X,
    y: 58,
    text: "Page endorsement / initials",
    font: "F3",
    size: 7,
    color: MUTED,
  });
  const slots =
    signatures.length > 0
      ? signatures
      : [
          { partyIndex: 1, typedName: "", role: "business", email: "", signedAt: "" },
          { partyIndex: 2, typedName: "", role: "creator", email: "", signedAt: "" },
        ];
  let x = 160;
  for (const slot of slots.slice(0, 4)) {
    const label = slot.role === "business" ? "Business" : "Influencer";
    page.text({ x, y: 58, text: `${label}:`, font: "F1", size: 7, color: BODY });
    if (slot.typedName) page.initials(slot.typedName, x + 42, 48);
    else {
      page.RG(RULE);
      page.cmds.push("0.6 w");
      page.cmds.push(`${x + 42} 52 m ${x + 88} 52 l S`);
    }
    x += 110;
  }
  page.text({
    x: MARGIN_X,
    y: 36,
    text: `Influrios collaboration agreement  -  ${agreementId.slice(0, 24)}  -  page ${pageIndex + 1} of ${pageCount}`,
    font: "F3",
    size: 8,
    color: MUTED,
  });
}

function tableHeader(page: PageBuilder, cols: { label: string; x: number; w: number }[], y: number, h = 16) {
  page.rect(MARGIN_X, y - h + 4, CONTENT_W, h, NAVY);
  for (const col of cols) {
    page.text({
      x: col.x,
      y: y - 8,
      text: col.label,
      font: "F2",
      size: 8,
      color: WHITE,
    });
  }
  return y - h - 2;
}

function tableRow(
  page: PageBuilder,
  cells: { text: string; x: number; w: number; bold?: boolean }[],
  y: number,
  alt: boolean,
  h = 15,
) {
  if (alt) page.rect(MARGIN_X, y - h + 4, CONTENT_W, h, ROW_ALT);
  page.RG(RULE);
  page.cmds.push("0.4 w");
  page.cmds.push(`${MARGIN_X} ${y - h + 4} ${CONTENT_W} ${h} re S`);
  for (const cell of cells) {
    const lines = wrap(cell.text, Math.max(8, Math.floor(cell.w / 4.6)));
    page.text({
      x: cell.x,
      y: y - 8,
      text: lines[0] ?? "",
      font: cell.bold ? "F2" : "F1",
      size: 8,
      color: BODY,
    });
  }
  return y - h;
}

/**
 * Render the approved Influrios collaboration agreement PDF (logo + template chrome).
 */
export function renderInfluriosTemplatePdf(
  values: ContractTemplateValues,
  options: ContractPdfOptions = {},
): Buffer {
  const logoLg = loadLogo("lg");
  const logoSm = loadLogo("sm");
  const logoLgDraw = { w: 148, h: (148 / logoLg.width) * logoLg.height };
  const logoSmDraw = { w: 85, h: (85 / logoSm.width) * logoSm.height };

  const signatures = options.signatures ?? [];
  const agreementId = v(values, "AGREEMENT_ID") || options.agreementId || "agreement";
  const hasInf2 = Boolean(v(values, "INFLUENCER_2_LEGAL_OR_DISPLAY_NAME_IF_ANY"));
  const milestoneCount = Number(values.__MILESTONE_COUNT__ || "0");

  const pages: PageBuilder[] = [];
  let page = new PageBuilder();

  // —— Cover / page 1 ——
  page.image("LogoLg", MARGIN_X, PAGE_H - 48 - logoLgDraw.h, logoLgDraw.w, logoLgDraw.h);
  page.y = PAGE_H - 56 - logoLgDraw.h;
  page.text({
    x: MARGIN_X,
    y: page.y,
    text: "COLLABORATION AGREEMENT",
    font: "F2",
    size: 22,
    color: NAVY,
  });
  page.y -= 26;
  page.text({
    x: MARGIN_X,
    y: page.y,
    text: v(values, "CAMPAIGN_NAME").toUpperCase(),
    font: "F2",
    size: 16,
    color: PURPLE,
  });
  page.y -= 28;

  const metaCols = [
    { label: "Agreement ID", x: MARGIN_X + 6, w: 130 },
    { label: "Status", x: MARGIN_X + 140, w: 130 },
    { label: "Generated", x: MARGIN_X + 280, w: 130 },
    { label: "Jurisdiction", x: MARGIN_X + 420, w: 100 },
  ];
  page.y = tableHeader(page, metaCols, page.y);
  page.y = tableRow(
    page,
    [
      { text: v(values, "AGREEMENT_ID"), x: metaCols[0].x, w: metaCols[0].w },
      { text: v(values, "AGREEMENT_STATUS_DISPLAY"), x: metaCols[1].x, w: metaCols[1].w },
      { text: v(values, "GENERATED_DATE_LONG"), x: metaCols[2].x, w: metaCols[2].w },
      { text: v(values, "JURISDICTION_DISPLAY"), x: metaCols[3].x, w: metaCols[3].w },
    ],
    page.y,
    false,
    18,
  );
  page.y -= 18;

  // Purpose box
  const purposeTitle = "Agreement purpose";
  const purposeBody =
    "This Collaboration Agreement sets out the campaign scope, commercial terms, milestone payments, content rights, approvals, obligations and signatures between the Business and the Influencer(s) identified below. Influrios provides the platform workflow and records associated with the collaboration.";
  const purposeLines = wrap(purposeBody, 92);
  const purposeH = 28 + purposeLines.length * 11;
  page.rect(MARGIN_X, page.y - purposeH, CONTENT_W, purposeH, PURPOSE_BG, RULE);
  page.text({ x: MARGIN_X + 10, y: page.y - 14, text: purposeTitle, font: "F2", size: 11, color: PURPLE });
  let py = page.y - 28;
  for (const line of purposeLines) {
    page.text({ x: MARGIN_X + 10, y: py, text: line, font: "F1", size: 9, color: BODY });
    py -= 11;
  }
  page.y -= purposeH + 18;

  page.text({ x: MARGIN_X, y: page.y, text: "Commercial Summary", font: "F2", size: 15, color: NAVY });
  page.y -= 18;
  page.y = tableHeader(page, [
    { label: "Item", x: MARGIN_X + 6, w: 220 },
    { label: "Agreed Terms", x: MARGIN_X + 230, w: 290 },
  ], page.y);

  const commercialRows: [string, string][] = [
    ["Campaign", v(values, "CAMPAIGN_NAME")],
    ["Business", v(values, "BUSINESS_LEGAL_NAME")],
    ["Service Level", v(values, "SERVICE_LEVEL_DISPLAY")],
    ["Currency", v(values, "CURRENCY_CODE")],
    ["Gross Contract Value", v(values, "GROSS_CONTRACT_VALUE_DISPLAY")],
    [
      "Influrios Platform Fee",
      (() => {
        const fee = v(values, "PLATFORM_FEE_DISPLAY");
        const rate = v(values, "PLATFORM_FEE_RATE_DISPLAY");
        if (!rate || rate === "-" || rate === "?" || rate === "—") return fee;
        return `${fee} (${rate})`;
      })(),
    ],
    ["Influencer Compensation Pool", v(values, "INFLUENCER_COMPENSATION_DISPLAY")],
    ["Funding Party", v(values, "FEE_PAYER_DISPLAY")],
    [
      "Campaign Period",
      `${v(values, "CAMPAIGN_START_DATE_DISPLAY")} to ${v(values, "CAMPAIGN_END_DATE_DISPLAY")}`,
    ],
  ];
  commercialRows.forEach((row, index) => {
    page.y = tableRow(
      page,
      [
        { text: row[0], x: MARGIN_X + 6, w: 220, bold: true },
        { text: row[1], x: MARGIN_X + 230, w: 290 },
      ],
      page.y,
      index % 2 === 1,
    );
  });
  pages.push(page);

  // —— Content pages ——
  const startContent = () => {
    const p = new PageBuilder();
    drawContinuationHeader(p, { drawW: logoSmDraw.w, drawH: logoSmDraw.h });
    return p;
  };
  page = startContent();

  const section = (title: string) => {
    page = ensureSpace(page, 40, pages, (p) => drawContinuationHeader(p, { drawW: logoSmDraw.w, drawH: logoSmDraw.h }));
    page.text({ x: MARGIN_X, y: page.y, text: title, font: "F2", size: 14, color: NAVY });
    page.y -= 18;
  };
  const para = (text: string, size = 9) => {
    for (const line of wrap(text, 98)) {
      page = ensureSpace(page, 14, pages, (p) => drawContinuationHeader(p, { drawW: logoSmDraw.w, drawH: logoSmDraw.h }));
      if (line) page.text({ x: MARGIN_X, y: page.y, text: line, font: "F1", size, color: BODY });
      page.y -= size + 3;
    }
    page.y -= 4;
  };
  const bullets = (items: string[]) => {
    for (const item of items) {
      const lines = wrap(item, 94);
      page = ensureSpace(page, 14 * lines.length + 4, pages, (p) =>
        drawContinuationHeader(p, { drawW: logoSmDraw.w, drawH: logoSmDraw.h }),
      );
      page.text({ x: MARGIN_X, y: page.y, text: "-", font: "F1", size: 9, color: BODY });
      lines.forEach((line, i) => {
        page.text({ x: MARGIN_X + 12, y: page.y, text: line, font: "F1", size: 9, color: BODY });
        page.y -= 12;
        if (i < lines.length - 1) {
          page = ensureSpace(page, 14, pages, (p) =>
            drawContinuationHeader(p, { drawW: logoSmDraw.w, drawH: logoSmDraw.h }),
          );
        }
      });
    }
    page.y -= 4;
  };
  const kvTable = (headers: [string, string], rows: [string, string][]) => {
    page = ensureSpace(page, 20 + rows.length * 15, pages, (p) =>
      drawContinuationHeader(p, { drawW: logoSmDraw.w, drawH: logoSmDraw.h }),
    );
    page.y = tableHeader(page, [
      { label: headers[0], x: MARGIN_X + 6, w: 200 },
      { label: headers[1], x: MARGIN_X + 210, w: 310 },
    ], page.y);
    rows.forEach((row, index) => {
      page = ensureSpace(page, 18, pages, (p) => {
        drawContinuationHeader(p, { drawW: logoSmDraw.w, drawH: logoSmDraw.h });
        p.y = tableHeader(p, [
          { label: headers[0], x: MARGIN_X + 6, w: 200 },
          { label: headers[1], x: MARGIN_X + 210, w: 310 },
        ], p.y);
      });
      page.y = tableRow(
        page,
        [
          { text: row[0], x: MARGIN_X + 6, w: 200, bold: true },
          { text: row[1], x: MARGIN_X + 210, w: 310 },
        ],
        page.y,
        index % 2 === 1,
      );
    });
    page.y -= 10;
  };

  section("1. Parties");
  para(
    'This Collaboration Agreement (the "Agreement") is entered into by and between the following parties for the campaign identified above.',
  );
  {
    const partyRows: string[][] = [
      ["Business", v(values, "BUSINESS_LEGAL_NAME"), v(values, "BUSINESS_EMAIL"), v(values, "BUSINESS_ACCOUNT_DISPLAY")],
      [
        "Influencer",
        v(values, "INFLUENCER_1_LEGAL_OR_DISPLAY_NAME"),
        v(values, "INFLUENCER_1_EMAIL"),
        v(values, "INFLUENCER_1_HANDLE"),
      ],
    ];
    if (hasInf2) {
      partyRows.push([
        "Influencer",
        v(values, "INFLUENCER_2_LEGAL_OR_DISPLAY_NAME_IF_ANY"),
        v(values, "INFLUENCER_2_EMAIL_IF_ANY"),
        v(values, "INFLUENCER_2_HANDLE_IF_ANY"),
      ]);
    }
    const cols = [
      { label: "Party Type", x: MARGIN_X + 6, w: 80 },
      { label: "Legal / Display Name", x: MARGIN_X + 90, w: 160 },
      { label: "Email", x: MARGIN_X + 260, w: 160 },
      { label: "Platform Account", x: MARGIN_X + 430, w: 90 },
    ];
    page.y = tableHeader(page, cols, page.y);
    partyRows.forEach((row, index) => {
      page.y = tableRow(
        page,
        row.map((text, i) => ({ text, x: cols[i].x, w: cols[i].w })),
        page.y,
        index % 2 === 1,
      );
    });
    page.y -= 8;
  }
  para(
    "Multiple Influencers. If more than one Influencer participates, each listed Influencer is a party to this Agreement only to the extent of that Influencer's assigned deliverables, compensation share, rights and obligations. The complete participant list generated by Influrios forms part of this Agreement.",
  );

  section("2. Campaign Scope and Deliverables");
  kvTable(
    ["Field", "Agreement Detail"],
    [
      ["Campaign Objective", v(values, "CAMPAIGN_OBJECTIVE")],
      ["Scope of Work", v(values, "CAMPAIGN_SCOPE")],
      ["Required Platforms / Channels", v(values, "REQUIRED_CHANNELS_DISPLAY")],
      ["Content / Deliverables", v(values, "DELIVERABLES_SUMMARY")],
      ["Required Hashtags / Mentions", v(values, "REQUIRED_DISCLOSURES_AND_TAGS")],
      ["Creative Requirements", v(values, "CREATIVE_REQUIREMENTS")],
      ["Usage / Licensing Package", v(values, "CONTENT_USAGE_RIGHTS_DISPLAY")],
      ["Exclusivity, if any", v(values, "EXCLUSIVITY_TERMS_OR_NONE")],
    ],
  );
  para(
    "The Influencer will create and submit the agreed deliverables in accordance with this Agreement, the campaign brief, applicable law, platform rules and any written brand requirements incorporated into the campaign record.",
  );

  section("3. Compensation and Platform Fee");
  para(
    "The Business agrees to fund the Gross Contract Value shown in the Commercial Summary. The Gross Contract Value consists of the Influencer compensation and the applicable Influrios platform fee allocated under the milestone schedule.",
  );
  kvTable(
    ["Commercial Item", "Amount / Rule"],
    [
      ["Gross Contract Value", v(values, "GROSS_CONTRACT_VALUE_DISPLAY")],
      ["Influrios Platform Fee", v(values, "PLATFORM_FEE_DISPLAY")],
      ["Platform Fee Rate", v(values, "PLATFORM_FEE_RATE_DISPLAY")],
      ["Influencer Compensation Pool", v(values, "INFLUENCER_COMPENSATION_DISPLAY")],
      ["Fee Rule Version", v(values, "FEE_RULE_DISPLAY")],
      [
        "Fee Earning Rule",
        "The applicable portion of the platform fee is earned only when the corresponding milestone is released or otherwise becomes earned under the campaign rules.",
      ],
    ],
  );
  para(
    "No retroactive fee change. The fee rule recorded when this Agreement becomes binding controls this collaboration. A later Admin or platform pricing change will not retroactively alter the fee terms of this Agreement unless all required parties agree to an amendment.",
  );

  section("4. Milestone Schedule");
  {
    const cols = [
      { label: "Milestone", x: MARGIN_X + 4, w: 110 },
      { label: "Share", x: MARGIN_X + 120, w: 50 },
      { label: "Gross Amount", x: MARGIN_X + 175, w: 80 },
      { label: "Platform Fee", x: MARGIN_X + 265, w: 80 },
      { label: "Influencer Amount", x: MARGIN_X + 355, w: 100 },
      { label: "Due / Target", x: MARGIN_X + 465, w: 70 },
    ];
    page.y = tableHeader(page, cols, page.y);
    const count = Math.max(1, Math.min(3, milestoneCount || 3));
    for (let i = 1; i <= count; i += 1) {
      const prefix = `MILESTONE_${i}`;
      const name = v(values, `${prefix}_NAME`);
      if (!name || name === "—") continue;
      page.y = tableRow(
        page,
        [
          { text: name, x: cols[0].x, w: cols[0].w },
          { text: v(values, `${prefix}_PERCENT`), x: cols[1].x, w: cols[1].w },
          { text: v(values, `${prefix}_GROSS_DISPLAY`), x: cols[2].x, w: cols[2].w },
          { text: v(values, `${prefix}_FEE_DISPLAY`), x: cols[3].x, w: cols[3].w },
          { text: v(values, `${prefix}_INFLUENCER_DISPLAY`), x: cols[4].x, w: cols[4].w },
          { text: v(values, `${prefix}_DUE_DATE`), x: cols[5].x, w: cols[5].w },
        ],
        page.y,
        i % 2 === 0,
        16,
      );
    }
    page.y -= 8;
  }
  para(
    "For collaborations with more or fewer milestones, Influrios will render the complete milestone schedule from the campaign record. The milestone percentages should total 100% unless the campaign explicitly uses a different approved structure.",
  );

  section("5. Influencer Share Allocation");
  {
    const rows: [string, string, string, string][] = [
      [
        v(values, "INFLUENCER_1_DISPLAY_NAME"),
        v(values, "INFLUENCER_1_HANDLE"),
        v(values, "INFLUENCER_1_SHARE_PERCENT"),
        v(values, "INFLUENCER_1_TOTAL_COMP_DISPLAY"),
      ],
    ];
    if (hasInf2) {
      rows.push([
        v(values, "INFLUENCER_2_DISPLAY_NAME_IF_ANY"),
        v(values, "INFLUENCER_2_HANDLE_IF_ANY"),
        v(values, "INFLUENCER_2_SHARE_PERCENT_IF_ANY"),
        v(values, "INFLUENCER_2_TOTAL_COMP_DISPLAY_IF_ANY"),
      ]);
    }
    const cols = [
      { label: "Influencer", x: MARGIN_X + 6, w: 140 },
      { label: "Platform Handle", x: MARGIN_X + 150, w: 120 },
      { label: "Share of Influencer Compensation", x: MARGIN_X + 280, w: 140 },
      { label: "Payment Allocation", x: MARGIN_X + 430, w: 90 },
    ];
    page.y = tableHeader(page, cols, page.y);
    rows.forEach((row, index) => {
      page.y = tableRow(
        page,
        row.map((text, i) => ({ text, x: cols[i].x, w: cols[i].w })),
        page.y,
        index % 2 === 1,
      );
    });
    page.y -= 8;
  }
  para(
    "If multiple Influencers participate, the compensation pool is allocated according to the percentages shown above. Influrios may generate a single funding instruction while maintaining separate ledger allocations for each Influencer.",
  );

  section("6. Funding, Release and Payout");
  bullets([
    "The Business must fund the collaboration through the payment method or provider made available by Influrios before any milestone that requires funded status may begin.",
    "Amounts designated for the collaboration remain separate from Influrios operating revenue until the applicable fee or other amount becomes earned under the campaign and platform rules.",
    "Influencer compensation associated with a milestone becomes payable only after the milestone is approved, auto-approved under the configured campaign rule, or otherwise released following the applicable dispute process.",
    "The corresponding allocated portion of the Influrios platform fee becomes earned when the milestone is released or otherwise satisfies the applicable earning rule.",
    "Payment-provider processing, payout, foreign exchange, tax, withholding or similar charges may apply where disclosed in the campaign or provider flow.",
    "A failed payout does not cancel an earned Influencer amount. The payable remains subject to verification, compliance review and successful payout processing.",
  ]);

  section("7. Submission, Review and Revisions");
  bullets([
    "The Influencer will submit each deliverable through the method specified in the campaign record.",
    `The Business will review submitted work within ${v(values, "APPROVAL_PERIOD_DISPLAY")}.`,
    `The Business may request revisions reasonably within the agreed campaign scope and revision allowance: ${v(values, "REVISION_ALLOWANCE_DISPLAY")}.`,
    "A request that materially expands scope, channels, usage rights or deliverables may require a written amendment and additional compensation.",
    "If the campaign uses auto-approval, the applicable timer and conditions will be displayed in the campaign record.",
  ]);

  section("8. Content Rights and Usage");
  para(
    "Unless the campaign expressly provides for a buyout or assignment, the Influencer retains ownership of the Influencer's original content. The Influencer grants the Business only the usage rights expressly selected for this campaign:",
  );
  kvTable(
    ["Usage Field", "Agreed Right"],
    [
      ["Organic Brand Use", v(values, "ORGANIC_USAGE_TERM")],
      ["Paid Advertising / Whitelisting", v(values, "PAID_USAGE_TERM")],
      ["Territory", v(values, "USAGE_TERRITORY")],
      ["Duration", v(values, "USAGE_DURATION")],
      ["Editing / Adaptation", v(values, "EDITING_RIGHTS")],
      ["Exclusivity", v(values, "EXCLUSIVITY_TERMS_OR_NONE")],
      ["Ownership / Buyout", v(values, "OWNERSHIP_BUYOUT_TERMS_OR_NONE")],
    ],
  );
  para(
    "No usage right not expressly stated in this Agreement is granted. Expanded use, extended term, new territory, paid-media use, sublicensing or ownership transfer outside the agreed rights requires a separate written agreement or amendment.",
  );

  section("9. Advertising Disclosure and Platform Compliance");
  para(
    "Each Influencer is responsible for making clear and conspicuous advertising, sponsorship or material-connection disclosures required by applicable law and the rules of the social platform on which content is published. The Business will not instruct an Influencer to conceal a required disclosure.",
  );
  bullets([
    "Influencers must use campaign-required disclosures, hashtags, labels or platform tools.",
    "Content must not contain unlawful, knowingly false, defamatory or infringing material.",
    "The Business is responsible for the accuracy and substantiation of factual claims or product information it supplies to the Influencer.",
    "The Influencer remains responsible for the Influencer's own statements, conduct and compliance with applicable platform rules.",
  ]);

  section("10. Confidentiality");
  para(
    "A party receiving non-public business, campaign, product, pricing, customer, technical or personal information from another party will use that information only for this collaboration and will not disclose it except to personnel or advisers who need it and are subject to appropriate confidentiality obligations, or where disclosure is required by law.",
  );

  section("11. Representations and Warranties");
  para("Each party represents that:");
  bullets([
    "it has authority to enter into this Agreement and perform its obligations;",
    "its performance will not knowingly violate another binding agreement;",
    "materials it supplies for the campaign are owned by it or properly licensed for the intended use; and",
    "information it supplies for payment, tax, verification and contracting purposes is materially accurate.",
  ]);
  para(
    "The Influencer additionally represents that original content supplied by the Influencer will not knowingly infringe third-party intellectual-property or publicity rights, except to the extent the allegedly infringing element was supplied or specifically required by the Business.",
  );

  section("12. Cancellation and Termination");
  para(
    "Cancellation and termination will be handled according to the campaign status, completed work, earned fees, approved milestones and applicable refund rules. Unless a campaign-specific term states otherwise:",
  );
  bullets([
    "unearned future milestone amounts should remain refundable to the funding party, subject to provider limitations and legitimate deductions;",
    "completed or approved work and earned platform fees remain payable and are not automatically reversed by cancellation;",
    `a material breach reasonably capable of cure should be given the applicable cure period: ${v(values, "CURE_PERIOD_DISPLAY")};`,
    "Influrios may suspend or restrict a collaboration where fraud, sanctions, prohibited activity, material security risk or payment abuse is reasonably suspected.",
  ]);

  section("13. Disputes");
  para(
    `A party disputing a milestone, deliverable, release or payment must use the collaboration dispute process within ${v(values, "DISPUTE_WINDOW_DISPLAY")}. The disputed amount may remain on hold while the dispute is reviewed. Undisputed amounts should continue through the normal release process where operationally possible.`,
  );
  para(
    "Influrios may provide administrative tools, records and workflow support for a dispute but does not guarantee a particular legal outcome unless a separate written service expressly states otherwise.",
  );

  section("14. Platform Role");
  para(
    "Influrios provides technology and operational workflow for discovery, collaboration administration, records, payment orchestration and related services. Unless Influrios is expressly named as a contracting service provider for a separate managed service, Influrios is not the employer, agent, partner or joint venturer of the Business or Influencer, and it does not control the manner and means by which the Influencer creates content.",
  );
  para(
    "Nothing in this Agreement should be interpreted as describing collaboration funds as bank deposits or regulated escrow unless the applicable licensed payment arrangement expressly provides that status.",
  );

  section("15. Indemnification and Liability");
  para(
    "Each party is responsible for losses arising from its own breach of this Agreement, unlawful conduct, fraud, willful misconduct or infringement caused by materials it supplied. Any broader indemnity, liability cap or exclusion of consequential damages should follow the governing Influrios Terms and any campaign-specific enterprise terms incorporated by reference.",
  );
  para(
    "Platform terms. The current Influrios Terms of Service, Privacy Policy and any applicable payment/provider terms are incorporated by reference to the extent they govern account use, payment processing, platform conduct, privacy or limitations not specifically addressed here.",
  );

  section("16. Governing Law and Venue");
  para(
    `This Agreement is governed by the law stated in the campaign record: ${v(values, "GOVERNING_LAW_DISPLAY")}. Any court venue, arbitration requirement or dispute forum applicable to this collaboration is: ${v(values, "DISPUTE_FORUM_DISPLAY")}.`,
  );

  section("17. Notices, Records and Electronic Communications");
  bullets([
    "Influrios will store the executed agreement and relevant audit record on the account of each party, subject to account access and retention rules.",
    "Campaign messages, notices and approvals recorded in Influrios may form part of the collaboration record.",
    "System timestamps should be shown in a human-readable format with the applicable timezone.",
    "A party should promptly update its contact information if the email or account information used for notices changes.",
  ]);

  section("18. Amendments, Assignment and Entire Agreement");
  para(
    "Material changes to the parties, compensation, milestone amounts, usage rights, service level or core scope require a written amendment or replacement agreement accepted by all affected parties. No party may assign this Agreement in a manner that materially increases another party's obligations without any consent required by applicable law or the governing terms. This Agreement, together with incorporated campaign records and applicable Influrios terms, constitutes the agreement of the parties regarding this collaboration and supersedes inconsistent prior campaign communications.",
  );

  section("19. Electronic Signature");
  para(
    `This Agreement becomes executed when all required signers complete the electronic-signature process through ${v(values, "ESIGN_PROVIDER_DISPLAY")} and the signature provider confirms completion. A button click, campaign approval or other action inside Influrios is not, by itself, a legal signature unless the applicable signing flow expressly identifies that action as the electronic signature method.`,
  );

  {
    const cols = [
      { label: "Party", x: MARGIN_X + 4, w: 70 },
      { label: "Signer", x: MARGIN_X + 80, w: 120 },
      { label: "Email", x: MARGIN_X + 210, w: 140 },
      { label: "Signature Status", x: MARGIN_X + 360, w: 90 },
      { label: "Signed At", x: MARGIN_X + 460, w: 80 },
    ];
    page = ensureSpace(page, 80, pages, (p) => drawContinuationHeader(p, { drawW: logoSmDraw.w, drawH: logoSmDraw.h }));
    page.y = tableHeader(page, cols, page.y);
    const sigRows: { role: string; name: string; email: string; status: string; when: string; ink?: string }[] = [
      {
        role: "Business",
        name: v(values, "BUSINESS_SIGNER_NAME"),
        email: v(values, "BUSINESS_SIGNER_EMAIL"),
        status: v(values, "BUSINESS_SIGNATURE_STATUS"),
        when: v(values, "BUSINESS_SIGNED_AT_DISPLAY"),
        ink: signatures.find((s) => s.role === "business")?.typedName,
      },
      {
        role: "Influencer",
        name: v(values, "INFLUENCER_1_SIGNER_NAME"),
        email: v(values, "INFLUENCER_1_SIGNER_EMAIL"),
        status: v(values, "INFLUENCER_1_SIGNATURE_STATUS"),
        when: v(values, "INFLUENCER_1_SIGNED_AT_DISPLAY"),
        ink: signatures.find((s) => s.partyIndex === 2 || s.role === "creator")?.typedName,
      },
    ];
    if (hasInf2) {
      sigRows.push({
        role: "Influencer",
        name: v(values, "INFLUENCER_2_SIGNER_NAME_IF_ANY"),
        email: v(values, "INFLUENCER_2_SIGNER_EMAIL_IF_ANY"),
        status: v(values, "INFLUENCER_2_SIGNATURE_STATUS_IF_ANY"),
        when: v(values, "INFLUENCER_2_SIGNED_AT_DISPLAY_IF_ANY"),
        ink: signatures.find((s) => s.partyIndex === 3)?.typedName,
      });
    }
    sigRows.forEach((row, index) => {
      page = ensureSpace(page, 50, pages, (p) => drawContinuationHeader(p, { drawW: logoSmDraw.w, drawH: logoSmDraw.h }));
      page.y = tableRow(
        page,
        [
          { text: row.role, x: cols[0].x, w: cols[0].w },
          { text: row.name, x: cols[1].x, w: cols[1].w },
          { text: row.email, x: cols[2].x, w: cols[2].w },
          { text: row.status, x: cols[3].x, w: cols[3].w },
          { text: row.when, x: cols[4].x, w: cols[4].w },
        ],
        page.y,
        index % 2 === 1,
        16,
      );
      if (row.ink) {
        page.ink(row.ink, MARGIN_X + 80, page.y - 22, 13);
        page.y -= 28;
      } else {
        page.RG(RULE);
        page.cmds.push("0.6 w");
        page.cmds.push(`${MARGIN_X + 80} ${page.y - 8} m ${MARGIN_X + 260} ${page.y - 8} l S`);
        page.y -= 18;
      }
    });
  }

  page.y -= 6;
  section("Signature Audit Record");
  kvTable(
    ["Field", "Recorded Value"],
    [
      ["E-sign Provider", v(values, "ESIGN_PROVIDER_DISPLAY")],
      ["Envelope / Transaction ID", v(values, "ESIGN_ENVELOPE_ID")],
      ["Completed At", v(values, "ESIGN_COMPLETED_AT_DISPLAY")],
      ["Agreement Hash / Version", v(values, "AGREEMENT_VERSION_OR_HASH")],
    ],
  );
  para("END OF COLLABORATION AGREEMENT", 10);

  pages.push(page);

  // Assemble PDF with embedded JPEG logos
  return assemblePdf(pages, logoLg.bytes, logoSm.bytes, {
    agreementId,
    signatures,
    pageEndorsements: options.pageEndorsements !== false,
  });
}

function assemblePdf(
  pages: PageBuilder[],
  logoLg: Buffer,
  logoSm: Buffer,
  meta: { agreementId: string; signatures: ContractPdfSignature[]; pageEndorsements: boolean },
): Buffer {
  // Add footers now that page count is known
  const pageCount = pages.length;
  pages.forEach((page, index) => {
    if (meta.pageEndorsements) {
      drawFooter(page, index, pageCount, meta.agreementId, meta.signatures);
    } else {
      page.text({
        x: MARGIN_X,
        y: 36,
        text: `Influrios collaboration agreement  -  page ${index + 1} of ${pageCount}`,
        font: "F3",
        size: 8,
        color: MUTED,
      });
    }
  });

  const fontRegularId = 3 + pages.length * 2;
  const fontBoldId = fontRegularId + 1;
  const fontObliqueId = fontRegularId + 2;
  const logoLgId = fontObliqueId + 1;
  const logoSmId = logoLgId + 1;

  const parts: { id: number; body: string | Buffer }[] = [];
  const kids: number[] = [];

  pages.forEach((page, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    kids.push(pageId);
    const stream = page.cmds.join("\n");
    parts.push({
      id: contentId,
      body: `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    });
    parts.push({
      id: pageId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontObliqueId} 0 R >> /XObject << /LogoLg ${logoLgId} 0 R /LogoSm ${logoSmId} 0 R >> >> >>`,
    });
  });

  const objects: { id: number; body: string | Buffer }[] = [
    { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    {
      id: 2,
      body: `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    },
    ...parts,
    { id: fontRegularId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>" },
    { id: fontBoldId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>" },
    { id: fontObliqueId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>" },
    {
      id: logoLgId,
      body: Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width 616 /Height 205 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoLg.length} >>\nstream\n`,
        ),
        logoLg,
        Buffer.from("\nendstream"),
      ]),
    },
    {
      id: logoSmId,
      body: Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width 353 /Height 118 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoSm.length} >>\nstream\n`,
        ),
        logoSm,
        Buffer.from("\nendstream"),
      ]),
    },
  ].sort((a, b) => a.id - b.id);

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const offsets: number[] = [];
  let offset = chunks[0].length;
  for (const object of objects) {
    offsets[object.id] = offset;
    const header = Buffer.from(`${object.id} 0 obj\n`);
    const body = typeof object.body === "string" ? Buffer.from(object.body) : object.body;
    const end = Buffer.from("\nendobj\n");
    chunks.push(header, body, end);
    offset += header.length + body.length + end.length;
  }
  const xrefAt = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= objects.length; id += 1) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  chunks.push(Buffer.from(xref));
  return Buffer.concat(chunks);
}
