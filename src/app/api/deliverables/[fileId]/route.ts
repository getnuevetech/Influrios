import { NextResponse } from "next/server";
import { getAccountSession } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { readDeliverableFile } from "@/lib/deliverable-files";
import { assertFundingAccess } from "@/lib/funding-access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ fileId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const account = await getAccountSession().catch(() => null);
  if (!account) return new NextResponse("Sign in to open this file.", { status: 401 });
  const { fileId } = await params;
  const file = await prisma.milestoneFile.findUnique({ where: { id: fileId } });
  if (!file) return new NextResponse("Not found", { status: 404 });
  const access = await assertFundingAccess(account, file.fundingId);
  if (!access.ok) return new NextResponse("Not found", { status: 404 });
  try {
    const stored = await readDeliverableFile(file.storagePath);
    const inline = file.kind === "media" || file.contentType === "application/pdf";
    return new NextResponse(stored.bytes, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
