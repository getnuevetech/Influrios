import { NextResponse } from "next/server";
import { getAccountSession } from "@/lib/accounts";
import { getAdminSession } from "@/lib/admin-auth";
import { renderContractPdf, resolveContractPartyForAccount } from "@/lib/contract-document";
import { signaturesFromParties } from "@/lib/contract-pdf";
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
      include: {
        parties: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            userId: true,
            email: true,
            role: true,
            status: true,
            attestation: true,
            signedAt: true,
          },
        },
      },
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
  if (!isParty && !adminAllowed) {
    return NextResponse.json({ error: "Sign in as a party to download this PDF." }, { status: 401 });
  }

  // Always render from the stored agreement text so layout fixes apply to older contracts too.
  const pdf = renderContractPdf(document.renderedBody || "Collaboration agreement", {
    title: document.title,
    agreementId: document.id,
    signatures: signaturesFromParties(document.parties),
    pageEndorsements: true,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="contract-${document.id}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
