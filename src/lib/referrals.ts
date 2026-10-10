import { prisma } from "@/lib/db";
import { referralId } from "@/lib/referral-cookie";

export type ReferralReward =
  | { kind: "points"; points: number }
  | { kind: "money"; amountCents: number; currency: string }
  | { kind: "" };

export function referralRewardLabel(row: {
  rewardKind: string;
  points: number;
  amountCents: number;
  currency: string;
}): string {
  if (row.rewardKind === "points") return `${row.points} points`;
  if (row.rewardKind === "money") {
    const amount = (row.amountCents / 100).toFixed(2);
    return row.currency ? `${amount} ${row.currency}` : amount;
  }
  return "";
}

function parsePoints(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const points = Number(text);
  if (points > 1_000_000) return null;
  return points;
}

function parseMoneyCents(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, frac = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isInteger(cents) || cents > 100_000_000) return null;
  return cents;
}

/** The reward that was entered. Enabling the program requires that reward. */
export function referralProgramDraft(input: {
  enabled: boolean;
  rewardKind: string;
  points: string;
  amount: string;
  currency: string;
}): { ok: true; enabled: boolean; reward: ReferralReward } | { ok: false; error: string } {
  const kind = input.rewardKind.trim();
  const pointsText = input.points.trim();
  const amountText = input.amount.trim();
  const currencyText = input.currency.trim();
  if (!input.enabled && !kind && !pointsText && !amountText && !currencyText) {
    return { ok: true, enabled: false, reward: { kind: "" } };
  }
  if (kind !== "points" && kind !== "money") {
    return { ok: false, error: "Choose points or a money amount." };
  }
  if (kind === "points") {
    const points = parsePoints(pointsText);
    if (points == null) return { ok: false, error: "Enter the points for a referral." };
    return { ok: true, enabled: input.enabled, reward: { kind: "points", points } };
  }
  const amountCents = parseMoneyCents(amountText);
  if (amountCents == null) return { ok: false, error: "Enter the money amount for a referral." };
  const currency = currencyText.toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: "Enter a 3-letter currency." };
  return { ok: true, enabled: input.enabled, reward: { kind: "money", amountCents, currency } };
}

export function referralCreditDecision(input: {
  enabled: boolean;
  reward: ReferralReward;
  linkActive: boolean;
  referrerCreatorId: string | null;
  referrerUserId: string | null;
  referrerEmail: string | null;
  referredUserId: string;
  referredEmail: string;
  alreadyRegistered: boolean;
}): { ok: true; reward: Exclude<ReferralReward, { kind: "" }> } | { ok: false; reason: string } {
  if (!input.enabled) return { ok: false, reason: "disabled" };
  if (input.reward.kind !== "points" && input.reward.kind !== "money") {
    return { ok: false, reason: "no-reward" };
  }
  if (!input.linkActive || !input.referrerCreatorId) return { ok: false, reason: "inactive-link" };
  if (input.alreadyRegistered) return { ok: false, reason: "already" };
  const referredEmail = input.referredEmail.trim().toLowerCase();
  const referrerEmail = input.referrerEmail?.trim().toLowerCase() ?? "";
  if (
    (input.referrerUserId && input.referrerUserId === input.referredUserId) ||
    (referrerEmail && referrerEmail === referredEmail)
  ) {
    return { ok: false, reason: "self" };
  }
  return { ok: true, reward: input.reward };
}

function rewardFields(reward: ReferralReward) {
  if (reward.kind === "points") {
    return { rewardKind: "points", points: reward.points, amountCents: 0, currency: "" };
  }
  if (reward.kind === "money") {
    return { rewardKind: "money", points: 0, amountCents: reward.amountCents, currency: reward.currency };
  }
  return { rewardKind: "", points: 0, amountCents: 0, currency: "" };
}

export async function getReferralProgram() {
  const row = await prisma.referralProgram.findUnique({ where: { id: "default" } });
  if (!row) {
    return { enabled: false, rewardKind: "", points: 0, amountCents: 0, currency: "" };
  }
  return {
    enabled: row.enabled,
    rewardKind: row.rewardKind,
    points: row.points,
    amountCents: row.amountCents,
    currency: row.currency,
  };
}

export async function saveReferralProgram(input: {
  enabled: boolean;
  rewardKind: string;
  points: string;
  amount: string;
  currency: string;
}) {
  const draft = referralProgramDraft(input);
  if (!draft.ok) throw new Error(draft.error);
  const fields = rewardFields(draft.reward);
  await prisma.referralProgram.upsert({
    where: { id: "default" },
    create: { id: "default", enabled: draft.enabled, ...fields },
    update: { enabled: draft.enabled, ...fields },
  });
}

export async function listReferralRegistrations(limit = 100) {
  return prisma.referralRegistration.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      referrer: { select: { displayName: true, slug: true } },
      shortLink: { select: { slug: true } },
    },
  });
}

export async function listReferralsForCreator(slug: string) {
  const creator = await prisma.creator.findUnique({ where: { slug }, select: { id: true } });
  if (!creator) return [];
  return prisma.referralRegistration.findMany({
    where: { referrerCreatorId: creator.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { shortLink: { select: { slug: true } } },
  });
}

export async function recordReferralRegistration(input: {
  userId: string;
  email: string;
  shortLinkId: string;
}) {
  const shortLinkId = referralId(input.shortLinkId);
  if (!shortLinkId) return { ok: false as const, reason: "inactive-link" };
  const [program, link, existing] = await Promise.all([
    getReferralProgram(),
    prisma.shortLink.findUnique({
      where: { id: shortLinkId },
      include: { creator: { include: { user: { select: { id: true, email: true } } } } },
    }),
    prisma.referralRegistration.findUnique({ where: { referredUserId: input.userId }, select: { id: true } }),
  ]);
  const reward: ReferralReward =
    program.rewardKind === "points"
      ? { kind: "points", points: program.points }
      : program.rewardKind === "money"
        ? { kind: "money", amountCents: program.amountCents, currency: program.currency }
        : { kind: "" };
  const decision = referralCreditDecision({
    enabled: program.enabled,
    reward,
    linkActive: Boolean(link && link.status === "active" && link.creator),
    referrerCreatorId: link?.creator?.id ?? null,
    referrerUserId: link?.creator?.user?.id ?? null,
    referrerEmail: link?.creator?.user?.email ?? null,
    referredUserId: input.userId,
    referredEmail: input.email,
    alreadyRegistered: Boolean(existing),
  });
  if (!decision.ok || !link?.creator) return decision;
  const fields = rewardFields(decision.reward);
  try {
    await prisma.referralRegistration.create({
      data: {
        referrerCreatorId: link.creator.id,
        shortLinkId: link.id,
        referredUserId: input.userId,
        referredEmail: input.email.trim().toLowerCase(),
        ...fields,
      },
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "P2002") return { ok: false as const, reason: "already" };
    throw error;
  }
  return decision;
}
