import { prisma } from "@/lib/db";

/** Card claim links and agency seat links are the invite returns login can open. */
export function inviteTokenFromReturn(path: string): { kind: "card" | "agency"; token: string } | null {
  const pathname = path.split("?")[0]?.split("#")[0] ?? "";
  const card = pathname.match(/^\/invite\/([^/]+)$/);
  if (card?.[1]) return { kind: "card", token: decodeURIComponent(card[1]) };
  const agency = pathname.match(/^\/agency\/invite\/([^/]+)$/);
  if (agency?.[1]) return { kind: "agency", token: decodeURIComponent(agency[1]) };
  return null;
}

/** Send the account to an invite only when that account is the named recipient. */
export function loginDestination(input: {
  next: string;
  accountEmail: string;
  recipientEmail: string | null | undefined;
  fallback: string;
}): string {
  if (!inviteTokenFromReturn(input.next)) return input.next;
  const account = input.accountEmail.trim().toLowerCase();
  const recipient = (input.recipientEmail ?? "").trim().toLowerCase();
  if (account && recipient && account === recipient) return input.next;
  return input.fallback;
}

export async function recipientEmailForReturn(path: string): Promise<string | null> {
  const invite = inviteTokenFromReturn(path);
  if (!invite) return null;
  if (invite.kind === "card") {
    const row = await prisma.creatorInvitation.findUnique({
      where: { token: invite.token },
      select: { email: true },
    });
    return row?.email ?? null;
  }
  const seat = await prisma.agencySeat.findUnique({
    where: { inviteToken: invite.token },
    select: { email: true },
  });
  return seat?.email ?? null;
}
