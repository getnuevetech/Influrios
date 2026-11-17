import { NextResponse } from "next/server";
import { getAccountSession } from "@/lib/accounts";
import { getAdminSession } from "@/lib/admin-auth";
import {
  adoptUnboundContractParty,
  agreementForParty,
  buildContractChromePdf,
  resolveContractPartyForAccount,
} from "@/lib/contract-document";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

function pdfDownloadHeaders(documentId: string, agreementRef: string | null | undefined, chrome: string) {
  const safeRef = (agreementRef || documentId).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 48);
  const filename = `influrios-contract-${safeRef}.pdf`;
  return {
    "content-type": "application/pdf",
    // Force download instead of opening the PDF in the browser tab.
    "content-disposition": `attachment; filename="${filename}"`,
    "cache-control": "private, no-store, no-cache, must-revalidate",
    pragma: "no-cache",
    "x-influrios-contract-chrome": chrome,
  };
}

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

  const renderedBody = party
    ? await agreementForParty({
        body: document.renderedBody || "Collaboration agreement",
        role: party.role,
        termsSnapshotJson: document.termsSnapshotJson,
      })
    : document.renderedBody || "Collaboration agreement";

  const { body, upgraded, pdf } = buildContractChromePdf({
    id: document.id,
    title: document.title,
    status: document.status,
    renderedBody,
    signingChannel: document.signingChannel,
    createdAt: document.createdAt,
    agreementRef: document.agreementRef,
    versionLabel: document.versionLabel,
    parties: document.parties,
  });

  // Persist chrome upgrades only while the agreement is still editable.
  if (!party && (document.status === "draft" || document.status === "sent") && upgraded) {
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
      ...pdfDownloadHeaders(document.id, document.agreementRef, party ? "party" : upgraded ? "upgraded" : "formal"),
      "x-influrios-contract-template": "influrios-collab-v1",
    },
  });
}
