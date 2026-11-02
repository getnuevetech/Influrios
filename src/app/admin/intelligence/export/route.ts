import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, hasPermission } from "@/lib/admin-auth";
import {
  buildIntelligenceExport,
  intelligenceExportToCsv,
} from "@/lib/intelligence";

export const dynamic = "force-dynamic";

/**
 * Admin-authenticated intelligence export (JSON/CSV).
 * Separate from /api/intelligence/export which requires a business entitlement session.
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }
  if (!hasPermission(session, "intelligence.export") && !hasPermission(session, "intelligence.view")) {
    return NextResponse.json({ error: "Export intelligence permission required." }, { status: 403 });
  }
  // Prefer export permission; view-only admins still blocked for download
  if (!hasPermission(session, "intelligence.export")) {
    return NextResponse.json({ error: "Export intelligence permission required." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") ?? "json").toLowerCase();
  const slug = searchParams.get("slug") ?? undefined;
  let payload;
  try {
    // Admin catalog export — all intros + ops notes (not workspace-scoped).
    payload = await buildIntelligenceExport({ slug, includeNotes: true });
  } catch (err) {
    if (err instanceof Error && (err as Error & { code?: string }).code === "slug_not_found") {
      return NextResponse.json({ error: "Creator not found." }, { status: 404 });
    }
    throw err;
  }

  if (format === "csv") {
    const csv = intelligenceExportToCsv(payload);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="influrios-intelligence${slug ? `-${slug}` : ""}.csv"`,
      },
    });
  }

  return NextResponse.json(payload);
}
