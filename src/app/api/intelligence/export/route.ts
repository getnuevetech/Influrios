import { NextRequest, NextResponse } from "next/server";
import { isBusinessRole } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";
import {
  AUTH_LOCKOUT_GENERIC_MESSAGE,
  lockoutMessage,
  recordAuthFailure,
} from "@/lib/auth-lockout";
import {
  buildIntelligenceExport,
  intelligenceExportToCsv,
} from "@/lib/intelligence";
import { getWorkspace } from "@/lib/business";
import { businessEntitlementsForPlan } from "@/lib/entitlements-db";

/**
 * Intelligence export. Business plan entitlements + per-account rate limit.
 */
export async function GET(req: NextRequest) {
  const account = await getAccountSession();
  if (!account) {
    return NextResponse.json(
      { error: "Sign in to export.", login: "/login?next=/business/intelligence&gate=export" },
      { status: 401 },
    );
  }
  if (!isBusinessRole(account.role)) {
    return NextResponse.json({ error: "Intelligence exports are for business accounts." }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const locked = await lockoutMessage("intelligence-export", ip, account.id);
  if (locked) {
    return NextResponse.json({ error: AUTH_LOCKOUT_GENERIC_MESSAGE }, { status: 429 });
  }

  const ws = await getWorkspace(account.id);
  const entitlements = await businessEntitlementsForPlan(ws.plan);

  if (!entitlements.intelligence || !entitlements.exports) {
    return NextResponse.json(
      {
        error: "Intelligence exports require Business Pro or Agency.",
        upgrade: "/business#pricing",
      },
      { status: 403 },
    );
  }

  await recordAuthFailure("intelligence-export", ip, account.id);

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
