import { NextResponse } from "next/server";
import { requireAdminPage } from "@/app/admin/guard";
import { prisma } from "@/lib/db";
import { readKycFile } from "@/lib/kyc-document";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ documentId: string }> };

export async function GET(_request: Request, { params }: Params) {
  await requireAdminPage("collab_finance");
  const { documentId } = await params;
  const document = await prisma.creatorKycDocument.findUnique({ where: { id: documentId } });
  if (!document) return new NextResponse("Not found", { status: 404 });
  try {
    const file = await readKycFile(document.storagePath);
    return new NextResponse(file.bytes, {
      headers: {
        "Content-Type": file.type,
        "Content-Disposition": `attachment; filename="${document.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
