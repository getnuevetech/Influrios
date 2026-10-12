import { prisma } from "@/lib/db";

export const AGENCY_CSV_ROW_LIMIT = 200;

export type AcquisitionFields = {
  firstSource: string;
  firstAt: string;
  lastSource: string;
  lastAt: string;
};

export type AgencyImportRowInput = {
  name: string;
  email: string;
  handle: string;
  platform: string;
  source: string;
};

export type FunnelCounts = {
  source: string;
  invited: number;
  previewed: number;
  claimed: number;
  verified: number;
  published: number;
};

const CLAIMED_STATES = new Set(["CLAIMED", "EMAIL_VERIFIED", "PUBLISHED"]);

/** A blank source is not a touch. The first stored source stays first. A later source becomes last. */
export function applyTouch(current: AcquisitionFields, source: string, at: string): AcquisitionFields {
  const stored = source.trim();
  if (!stored) return current;
  if (!current.firstSource.trim()) {
    return { firstSource: stored, firstAt: at, lastSource: stored, lastAt: at };
  }
  return { ...current, lastSource: stored, lastAt: at };
}

/** The source on the link. A blank query stays blank. */
export function acquisitionSource(input: {
  source?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
}): string {
  const source = String(input.source || input.utmSource || "").trim();
  if (!source) return "";
  const campaign = String(input.utmCampaign || "").trim();
  return campaign ? `${source} / ${campaign}` : source;
}

/** A row source wins. The batch source is used only when that row left source blank. */
export function agencyRowSource(rowSource: string, batchSource: string): string {
  return rowSource.trim() || batchSource.trim();
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i] ?? "";
    if (quoted && char === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

/** Rows the CSV actually contains. A missing handle is reported. A blank platform stays blank. */
export function parseAgencyCsv(text: string): { rows: AgencyImportRowInput[]; errors: string[] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { rows: [], errors: ["Paste a CSV with a handle column."] };
  const header = splitCsvLine(lines[0] ?? "").map((cell) => cell.toLowerCase());
  const index = (name: string) => header.indexOf(name);
  if (index("handle") < 0) return { rows: [], errors: ["The CSV needs a handle column."] };
  const data = lines.slice(1);
  if (data.length > AGENCY_CSV_ROW_LIMIT) {
    return { rows: [], errors: [`This CSV has more than ${AGENCY_CSV_ROW_LIMIT} rows.`] };
  }
  const rows: AgencyImportRowInput[] = [];
  const errors: string[] = [];
  data.forEach((line, offset) => {
    const cells = splitCsvLine(line);
    const cell = (name: string) => {
      const at = index(name);
      return at < 0 ? "" : (cells[at] ?? "").trim();
    };
    const handle = cell("handle");
    if (!handle) {
      errors.push(`Row ${offset + 2} needs a handle.`);
      return;
    }
    rows.push({
      name: cell("name"),
      email: cell("email"),
      handle,
      platform: cell("platform"),
      source: cell("source"),
    });
  });
  return { rows, errors };
}

/** Counts stored invitations and drafts. A blank source stays blank. */
export function acquisitionFunnel(input: {
  sessions: { source: string; state: string; verified: boolean; published: boolean }[];
  invitations: { source: string }[];
}): FunnelCounts[] {
  const bySource = new Map<string, FunnelCounts>();
  const row = (source: string) => {
    const key = source.trim();
    const existing = bySource.get(key);
    if (existing) return existing;
    const created: FunnelCounts = {
      source: key,
      invited: 0,
      previewed: 0,
      claimed: 0,
      verified: 0,
      published: 0,
    };
    bySource.set(key, created);
    return created;
  };
  for (const invitation of input.invitations) {
    row(invitation.source).invited += 1;
  }
  for (const session of input.sessions) {
    const counts = row(session.source);
    counts.previewed += 1;
    const state = session.state.trim().toUpperCase();
    if (CLAIMED_STATES.has(state)) counts.claimed += 1;
    if (session.verified || state === "EMAIL_VERIFIED" || state === "PUBLISHED") counts.verified += 1;
    if (session.published || state === "PUBLISHED") counts.published += 1;
  }
  return [...bySource.values()].sort((a, b) => {
    if (!a.source) return 1;
    if (!b.source) return -1;
    return a.source.localeCompare(b.source);
  });
}

export async function loadAcquisitionReport() {
  const [sessions, invitations, imports] = await Promise.all([
    prisma.onboardingSession.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: {
        firstTouchSource: true,
        state: true,
        emailVerifiedAt: true,
        socialVerifiedAt: true,
        publishedAt: true,
      },
    }),
    prisma.creatorInvitation.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: { campaign: { select: { name: true } } },
    }),
    prisma.agencyImportRow.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, name: true, email: true, handle: true, platform: true, source: true, error: true, sessionId: true },
    }),
  ]);
  return {
    capped: sessions.length === 5000 || invitations.length === 5000,
    funnel: acquisitionFunnel({
      sessions: sessions.map((session) => ({
        source: session.firstTouchSource,
        state: session.state,
        verified: Boolean(session.emailVerifiedAt || session.socialVerifiedAt),
        published: Boolean(session.publishedAt),
      })),
      invitations: invitations.map((invitation) => ({ source: invitation.campaign?.name ?? "" })),
    }),
    imports,
  };
}

/** Stores each CSV row and starts a private draft when the handle and platform can be read. */
export async function importAgencyCsv(text: string, batchSource: string) {
  const { claimDraftProfile, createDraftFromHandle, updateDraftProfile } = await import("@/lib/claim");
  const parsed = parseAgencyCsv(text);
  let created = 0;
  for (const row of parsed.rows) {
    const source = agencyRowSource(row.source, batchSource);
    const profile = claimDraftProfile(row.handle, row.platform || undefined);
    if (!profile.ok) {
      await prisma.agencyImportRow.create({
        data: {
          name: row.name,
          email: row.email,
          handle: row.handle,
          platform: row.platform,
          source,
          error: profile.error,
        },
      });
      parsed.errors.push(`${row.handle}: ${profile.error}`);
      continue;
    }
    try {
      const draft = await createDraftFromHandle(row.handle, source || "ORGANIC_SIGNUP", row.platform || undefined, source);
      if (row.name) await updateDraftProfile(draft.id, { displayName: row.name });
      await prisma.agencyImportRow.create({
        data: {
          name: row.name,
          email: row.email,
          handle: row.handle,
          platform: profile.platform,
          source,
          sessionId: draft.id,
        },
      });
      created += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The draft could not be started.";
      await prisma.agencyImportRow.create({
        data: {
          name: row.name,
          email: row.email,
          handle: row.handle,
          platform: row.platform,
          source,
          error: message,
        },
      });
      parsed.errors.push(`${row.handle}: ${message}`);
    }
  }
  return { created, errors: parsed.errors };
}
