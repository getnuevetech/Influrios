/** Private invitations and a public listing are different distributions of one brief. */

export type RequestVisibility = "private" | "public";

export function requestVisibility(value: string | null | undefined, hasRecipients: boolean): RequestVisibility {
  if (value === "private" || value === "public") return value;
  return hasRecipients ? "private" : "public";
}

export function composerStep(value: string | null | undefined): 0 | 1 | 2 | 3 {
  const step = Number(value);
  if (step === 1 || step === 2 || step === 3) return step;
  return 0;
}

export function draftRecipientSlugs(value: string | null | undefined): string[] {
  return [...new Set((value ?? "").split(",").map((slug) => slug.trim()).filter(Boolean))];
}

export function joinDraftRecipients(slugs: string[]): string {
  return draftRecipientSlugs(slugs.join(",")).join(",");
}

export function composerSubmit(input: {
  intent: string;
  visibility: RequestVisibility;
  recipientCount: number;
}): { ok: true; action: "draft" | "invite" | "publish" } | { ok: false; error: string } {
  const intent = input.intent.trim();
  if (intent === "" || intent === "draft") return { ok: true, action: "draft" };
  if (intent === "invite") {
    // Public listings may also send direct invitations; visibility stays Public.
    if (input.recipientCount < 1) {
      return { ok: false, error: "Choose at least one influencer before sending invitations." };
    }
    return { ok: true, action: "invite" };
  }
  if (intent === "publish") {
    if (input.visibility !== "public") {
      return { ok: false, error: "Choose a public opportunity before publishing this listing." };
    }
    return { ok: true, action: "publish" };
  }
  return { ok: false, error: "Save the draft, send invitations, or publish the request." };
}

export type RequestMarket = { code: string; name: string };

/**
 * The request's Market must be one of the markets enabled in the system (admin Country list).
 * Empty means "not set". A value already saved on this request before the picker existed is kept as is.
 */
export function requestMarketChoice(
  value: string | null | undefined,
  markets: RequestMarket[],
  savedValue = "",
): { ok: true; name: string } | { ok: false; error: string } {
  const raw = (value ?? "").trim();
  if (!raw) return { ok: true, name: "" };
  const match = markets.find((market) => market.name.toLowerCase() === raw.toLowerCase() || market.code.toLowerCase() === raw.toLowerCase());
  if (match) return { ok: true, name: match.name };
  if (savedValue.trim() && raw.toLowerCase() === savedValue.trim().toLowerCase()) return { ok: true, name: savedValue.trim() };
  return { ok: false, error: "Choose a market from the list." };
}
