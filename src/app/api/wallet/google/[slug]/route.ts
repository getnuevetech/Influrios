import { NextResponse } from "next/server";
import { googleSaveLinkFor } from "@/lib/wallet";

export const dynamic = "force-dynamic";

/** Send the visitor to Google's "Save to Google Wallet" page for this Influrios Card. */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const link = await googleSaveLinkFor(slug);
  if (!link.ok) return NextResponse.json({ error: link.error }, { status: link.status });
  return NextResponse.redirect(link.url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
