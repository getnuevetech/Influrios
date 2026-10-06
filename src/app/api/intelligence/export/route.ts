import { NextRequest, NextResponse } from "next/server";
import { getAccountSession } from "@/lib/accounts";
import {
  buildIntelligenceExport,
  intelligenceExportToCsv,
} from "@/lib/intelligence";
import { getWorkspace } from "@/lib/business";
import { getBusinessEntitlements } from "@/lib/business-entitlements";

/**
 * Intelligence export. The viewer's owned workspace plan is the gate.
 */
export async function GET(req: NextRequest) {
  const account = await getAccountSession();
  if (!account) {
    return NextResponse.json(
      { error: "Sign in to export.", login: "/login?next=/business/intelligence&gate=export" },
      { status: 401 },
    );
  }
  const ws = await getWorkspace(account.id);
  const entitlements = getBusinessEntitlements(ws.plan);

  if (!entitlements.intelligence || !entitlements.exports) {
    return NextResponse.json(
      {
        error: "Intelligence exports require Business Pro or Agency.",
        upgrade: "/business#pricing",
      },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") ?? "json").toLowerCase();
  const slug = searchParams.get("slug") ?? undefined;
  const payload = await buildIntelligenceExport({ slug });

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
