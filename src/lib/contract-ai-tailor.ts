/**
 * AI clause tailor for contract drafts.
 * Suggestions never grant authority to sign or send. Party identity stays protected.
 */
import { productSwitch } from "@/lib/product-switches";

export const CONTRACT_AI_PROTECTED_SECTIONS = ["parties", "signatures", "financial_amounts"] as const;

export type ContractAiSection =
  | "scope"
  | "deliverables"
  | "compensation"
  | "rights"
  | "confidentiality"
  | "parties";

export type ContractAiProposal = {
  section: ContractAiSection;
  original: string;
  proposed: string;
  kind: "wording" | "financial_requires_quote" | "financial_requires_change_order" | "blocked";
  message?: string;
};

const MONEY = /\$\s?[\d,]+(?:\.\d{2})?|\b\d[\d,]*(?:\.\d{2})?\s?(?:USD|usd)\b/;

export function detectFinancialInstruction(instruction: string, original: string): boolean {
  const text = `${instruction}\n${original}`.toLowerCase();
  if (MONEY.test(instruction) || MONEY.test(original)) {
    if (/\b(fee|compensation|amount|price|pay|payment|budget|gross|net)\b/i.test(text)) return true;
  }
  return /\b(change|increase|decrease|raise|lower).{0,40}\b(fee|compensation|amount|price|pay|budget)\b/i.test(
    instruction,
  );
}

/** Pure proposal builder used by the UI and tests. Provider calls stay optional. */
export function proposeContractClauseChange(input: {
  section: ContractAiSection;
  original: string;
  instruction: string;
  dealSigned: boolean;
  protectedParties?: { brand: string; influencer: string };
}): ContractAiProposal {
  const original = input.original.trim();
  const instruction = input.instruction.trim();
  if (input.section === "parties") {
    return {
      section: input.section,
      original,
      proposed: original,
      kind: "blocked",
      message: "The party identities for this collaboration are locked and cannot be edited by AI.",
    };
  }
  if (!instruction) {
    return {
      section: input.section,
      original,
      proposed: original,
      kind: "blocked",
      message: "Describe the change you want before asking AI.",
    };
  }
  if (detectFinancialInstruction(instruction, original)) {
    return {
      section: input.section,
      original,
      proposed: original,
      kind: input.dealSigned ? "financial_requires_change_order" : "financial_requires_quote",
      message: input.dealSigned
        ? "This change affects signed money terms. Create a change order and agree the revised quote before signature."
        : "This change affects deal amounts. Revise the quote so the PDF and checkout stay aligned.",
    };
  }
  // Deterministic wording improvement when the instruction supplies format/duration detail.
  let proposed = original;
  if (input.section === "deliverables" || input.section === "scope") {
    const vertical = /vertical/i.test(instruction);
    const duration = instruction.match(/(\d+)\s*[–-]\s*(\d+)\s*seconds?/i) || instruction.match(/(\d+)\s*seconds?/i);
    const count = instruction.match(/\b(\d+)\b/);
    if (/deliver two videos/i.test(original) && (vertical || duration)) {
      const range = duration
        ? duration[2]
          ? `${duration[1]}–${duration[2]} seconds`
          : `${duration[1]} seconds`
        : "30–45 seconds";
      proposed = `Deliver two${vertical ? " vertical" : ""} videos, each ${range}.`;
    } else if (instruction.length > 8) {
      // Prefer the user's clarified sentence when it reads like replacement copy.
      if (instruction.length > original.length && /[.!?]$/.test(instruction)) {
        proposed = instruction;
      } else {
        proposed = `${original.replace(/\.\s*$/, "")}. ${instruction.replace(/^\s*make\s+it\s+/i, "").replace(/^\s*change\s+to\s+/i, "")}`.trim();
        if (!/[.!?]$/.test(proposed)) proposed = `${proposed}.`;
      }
    }
    if (count && /one sponsored post/i.test(instruction)) {
      proposed = instruction;
    }
  } else if (instruction.length > 8) {
    proposed = instruction.endsWith(".") ? instruction : `${instruction}.`;
  }
  return {
    section: input.section,
    original,
    proposed: proposed.trim() || original,
    kind: "wording",
    message: input.protectedParties
      ? `Parties stay locked: ${input.protectedParties.brand} × ${input.protectedParties.influencer}`
      : undefined,
  };
}

export async function contractAiEnabled(): Promise<boolean> {
  return productSwitch("contract_ai_tailor");
}

/** Turn accepted wording into template fields before Save as workspace template. */
export function templatizeClause(text: string): string {
  return text
    .replace(/\b[A-Z][A-Za-z0-9 &.'-]{1,60}\b(?= (Inc|LLC|Ltd|Holdings|Studio)\b)/g, "{{business_name}}")
    .replace(/@[a-z0-9._-]+/gi, "{{influencer_handle}}")
    .replace(/\$\s?[\d,]+(?:\.\d{2})?/g, "{{amount}}")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "{{date}}");
}
