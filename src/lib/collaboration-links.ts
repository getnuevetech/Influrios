/**
 * Classify lifecycle links without writing.
 * A title match is never treated as a link. Ambiguous rows stay unmerged.
 */

export type FundingLinkInput = {
  id: string;
  collaborationId?: string | null;
  title: string;
  creatorSlug: string;
};

export type CollaborationLinkInput = {
  id: string;
  title: string;
  recipientSlug: string;
};

export type LinkFinding = {
  id: string;
  state: "linked" | "unlinked" | "review" | "ambiguous";
  candidateIds: string[];
};

export function classifyFundingLinks(
  fundings: FundingLinkInput[],
  collaborations: CollaborationLinkInput[],
): LinkFinding[] {
  const known = new Set(collaborations.map((row) => row.id));
  return fundings.map((funding) => {
    const explicit = (funding.collaborationId ?? "").trim();
    if (explicit && known.has(explicit)) {
      return { id: funding.id, state: "linked", candidateIds: [explicit] };
    }
    if (explicit && !known.has(explicit)) {
      return { id: funding.id, state: "review", candidateIds: [explicit] };
    }
    const title = funding.title.trim().toLowerCase();
    const slug = funding.creatorSlug.trim();
    const candidates = collaborations
      .filter((row) => row.recipientSlug === slug && row.title.trim().toLowerCase() === title)
      .map((row) => row.id);
    if (candidates.length > 1) return { id: funding.id, state: "ambiguous", candidateIds: candidates };
    if (candidates.length === 1) return { id: funding.id, state: "review", candidateIds: candidates };
    return { id: funding.id, state: "unlinked", candidateIds: [] };
  });
}

export type ApplicationLinkInput = {
  id: string;
  status: string;
  collaborationId?: string | null;
  fromSlug?: string | null;
  toSlug?: string | null;
};

/** Accepted work with both slugs can receive a collaboration id. One slug stays unlinked. */
export function applicationLinkPlan(row: ApplicationLinkInput): "keep" | "create" | "unlinked" {
  const accepted = row.status === "ACCEPTED" || row.status === "COLLABORATION_DRAFTED";
  if (!accepted) return "keep";
  if ((row.collaborationId ?? "").trim()) return "keep";
  const from = (row.fromSlug ?? "").trim();
  const to = (row.toSlug ?? "").trim();
  if (from && to && from !== to) return "create";
  return "unlinked";
}
