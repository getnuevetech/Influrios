import { NextResponse } from "next/server";
import { getAccountSession } from "@/lib/accounts";
import { getAdminSession } from "@/lib/admin-auth";
import {
  adoptUnboundContractParty,
  buildContractChromePdf,
  contractTermsAreFrozen,
  resolveContractPartyForAccount,
} from "@/lib/contract-document";
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
  const matched = account ? resolveContractPartyForAccount(document.parties, account) : undefined;
  const party = matched && account ? await adoptUnboundContractParty(matched, account) : null;
  const isParty = Boolean(party);
  const adminAllowed = Boolean(
    admin &&
      (admin.roleId === "role_super" ||
        admin.permissions.some((permission) => permission.startsWith("contracts."))),
  );
  if (!isParty && !adminAllowed) {
    return NextResponse.json({ error: "Sign in as a party to download this PDF." }, { status: 401 });
  }

  const frozen = contractTermsAreFrozen(document);
  const storedPdf = document.pdfBytes ? Buffer.from(document.pdfBytes) : Buffer.alloc(0);
  if (frozen && storedPdf.length > 0) {
    return new NextResponse(new Uint8Array(storedPdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="influrios-contract-${document.id}.pdf"`,
        "cache-control": "private, no-store, no-cache, must-revalidate",
        pragma: "no-cache",
        "x-influrios-contract-chrome": "stored",
      },
    });
  }

  const { body, upgraded, pdf } = buildContractChromePdf({
    id: document.id,
    title: document.title,
    status: document.status,
    renderedBody: document.renderedBody || "Collaboration agreement",
    signingChannel: document.signingChannel,
    createdAt: document.createdAt,
    parties: document.parties,
  });

  if (!frozen) {
    await prisma.contractDocument
      .update({
        where: { id: document.id, status: { in: ["draft", "sent"] } },
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
      "content-disposition": `inline; filename="influrios-contract-${document.id}.pdf"`,
      "cache-control": "private, no-store, no-cache, must-revalidate",
      pragma: "no-cache",
      "x-influrios-contract-chrome": upgraded ? "upgraded" : "current",
      "x-influrios-contract-template": "influrios-collab-v1",
    },
  });
}
