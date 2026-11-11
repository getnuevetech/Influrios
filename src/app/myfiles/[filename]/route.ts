import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { myFileContentType, resolveMyFile } from "@/lib/myfiles";

export const dynamic = "force-dynamic";

/** https://influrios.com/myfiles/tik.pdf reads src/app/myfiles/tik.pdf */
export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  const full = resolveMyFile(filename);
  if (!full) return new NextResponse("Not found", { status: 404 });
  try {
    const info = await stat(full);
    if (!info.isFile()) return new NextResponse("Not found", { status: 404 });
    const bytes = await readFile(full);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": myFileContentType(full),
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "public, max-age=300",
        "Content-Disposition": `inline; filename="${path.basename(full)}"`,
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
