import { NextResponse } from "next/server";
import { getAccountSession } from "@/lib/accounts";
import { getAdminSession } from "@/lib/admin-auth";
import {
  renderContractPdf,
  resolveContractBodyForChrome,
  resolveContractPartyForAccount,
} from "@/lib/contract-document";
import { endorsementSlotsFromParties, signaturesFromParties } from "@/lib/contract-pdf";
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
            name: true,
            status: true,
            attestation: true,
            signedAt: true,
            creatorSlug: true,
            shareBps: true,
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

  // Upgrade legacy bodies to the approved chrome template, then always re-render.
  const { body, upgraded } = resolveContractBodyForChrome({
    id: document.id,
    title: document.title,
    status: document.status,
    renderedBody: document.renderedBody || "Collaboration agreement",
    signingChannel: document.signingChannel,
    createdAt: document.createdAt,
    parties: document.parties,
  });
  const pdf = renderContractPdf(body, {
    title: document.title,
    agreementId: document.id,
    signatures: signaturesFromParties(document.parties),
    endorsementSlots: endorsementSlotsFromParties(document.parties),
    pageEndorsements: true,
  });

  if (upgraded || !document.pdfBytes?.length) {
    await prisma.contractDocument
      .update({
        where: { id: document.id },
        data: {
          renderedBody: body,
          pdfBytes: new Uint8Array(pdf),
        },
      })
      .catch(() => undefined);
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="contract-${document.id}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
