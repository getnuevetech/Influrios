import { NextResponse } from "next/server";
import { applePassFor } from "@/lib/wallet";

export const dynamic = "force-dynamic";

/** Download the Influrios Card as an Apple Wallet pass (.pkpass). Safari on iPhone opens "Add to Apple Wallet". */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const pass = await applePassFor(slug);
  if (!pass.ok) return NextResponse.json({ error: pass.error }, { status: pass.status });
  return new NextResponse(new Uint8Array(pass.bytes), {
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="${pass.card.slug}.pkpass"`,
      "Cache-Control": "no-store",
      "Last-Modified": pass.card.updatedAt.toUTCString(),
    },
  });
}
