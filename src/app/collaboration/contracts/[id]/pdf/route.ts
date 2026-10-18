import { NextResponse } from "next/server";
import { getAccountSession } from "@/lib/accounts";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveContractPartyForAccount } from "@/lib/contract-document";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const [account, admin, document] = await Promise.all([
    getAccountSession().catch(() => null),
    getAdminSession().catch(() => null),
    prisma.contractDocument.findUnique({
      where: { id },
      include: { parties: { select: { id: true, userId: true, email: true } } },
    }),
  ]);
  if (!document) return NextResponse.json({ error: "Contract not found." }, { status: 404 });
  const party = account ? resolveContractPartyForAccount(document.parties, account) : null;
  if (party && account && party.userId !== account.id) {
    await prisma.contractParty.update({ where: { id: party.id }, data: { userId: account.id } }).catch(() => undefined);
  }
  const isParty = Boolean(party);
  const adminAllowed = Boolean(
    admin &&
      (admin.roleId === "role_super" ||
        admin.permissions.some((permission) => permission.startsWith("contracts."))),
  );
  if (!isParty && !adminAllowed) return NextResponse.json({ error: "Sign in as a party to download this PDF." }, { status: 401 });
  const body = Buffer.from(document.pdfBytes);
  return new NextResponse(body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="contract-${document.id}.pdf"`,
    },
  });
}
