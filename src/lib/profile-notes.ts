import { prisma } from "@/lib/db";
import { formatFollowers } from "@/lib/seed-data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type ProfileNote = { summary: string; details: string };

/** The text that was entered. A missing value is blank. */
export function storedProfileNote(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** A detail needs a summary. A blank pair stays blank. */
export function profileNotePair(summary: unknown, details: unknown, emptySummaryError: string): ProfileNote {
  const summaryText = storedProfileNote(summary);
  const detailsText = storedProfileNote(details);
  if (!summaryText && detailsText) throw new Error(emptySummaryError);
  return { summary: summaryText, details: detailsText };
}

export function profileOfferLines(creator: {
  offers?: ProfileNote[];
  offer?: string;
  offerDetails?: string;
}): ProfileNote[] {
  if (creator.offers) return creator.offers.flatMap(storedLine);
  return storedLine({ summary: creator.offer ?? "", details: creator.offerDetails ?? "" });
}

export function profileNeedLines(creator: {
  needs?: ProfileNote[];
  need?: string;
  needDetails?: string;
}): ProfileNote[] {
  if (creator.needs) return creator.needs.flatMap(storedLine);
  return storedLine({ summary: creator.need ?? "", details: creator.needDetails ?? "" });
}

function storedLine(row: ProfileNote): ProfileNote[] {
  const summary = row.summary.trim();
  if (!summary) return [];
  return [{ summary, details: row.details.trim() }];
}

/** A stored sync time. A missing time stays blank. */
export function metricFreshnessLabel(social: { source?: string | null; refreshedAt?: string | null }): string {
  const at = (social.refreshedAt ?? "").trim();
  if (!at) return "";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  const source = (social.source ?? "").trim();
  if (source === "PROVIDER_SYNCED") return `Synced ${formatted}`;
  if (source === "PLATFORM_VERIFIED") return `Verified ${formatted}`;
  if (source === "CREATOR_CLAIMED") return `Entered ${formatted}`;
  return formatted;
}

/** The stored count. A missing count stays hidden. A synced zero stays zero. */
export function visibleFollowerCount(social: { followers: number; refreshedAt?: string | null }): string | null {
  if (social.followers > 0) return formatFollowers(social.followers);
  if (social.followers === 0 && (social.refreshedAt ?? "").trim()) return formatFollowers(0);
  return null;
}

/** A side is written only after that side has been saved on the draft. */
export function offerNeedPatch(draft: {
  offer?: string;
  offerDetails?: string;
  need?: string;
  needDetails?: string;
}): { offer?: ProfileNote; need?: ProfileNote } {
  const offerKnown = draft.offer !== undefined || draft.offerDetails !== undefined;
  const needKnown = draft.need !== undefined || draft.needDetails !== undefined;
  return {
    ...(offerKnown ? { offer: { summary: draft.offer ?? "", details: draft.offerDetails ?? "" } } : {}),
    ...(needKnown ? { need: { summary: draft.need ?? "", details: draft.needDetails ?? "" } } : {}),
  };
}

/** Replace a side only when that side was entered. An omitted side stays stored. */
export async function replaceCreatorOfferAndNeed(
  creatorId: string,
  input: { offer?: ProfileNote; need?: ProfileNote },
) {
  if (input.offer) {
    const offer = profileNotePair(input.offer.summary, input.offer.details, "Enter what you offer.");
    await prisma.collaborationOffer.deleteMany({ where: { creatorId } });
    if (offer.summary) {
      await prisma.collaborationOffer.create({
        data: { creatorId, summary: offer.summary, details: offer.details || null },
      });
    }
  }
  if (input.need) {
    const need = profileNotePair(input.need.summary, input.need.details, "Enter what you need.");
    await prisma.collaborationNeed.deleteMany({ where: { creatorId } });
    if (need.summary) {
      await prisma.collaborationNeed.create({
        data: { creatorId, summary: need.summary, details: need.details || null },
      });
    }
  }
}
