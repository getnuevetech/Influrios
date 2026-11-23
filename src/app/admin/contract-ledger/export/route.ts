import { NextResponse } from "next/server";
import { canAccessModule, getAdminSession } from "@/lib/admin-auth";
import { ledgerCsv, loadContractLedger } from "@/lib/contract-ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** CSV of money movements: one contract with ?id=, otherwise every contract in the filter. */
export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session || !canAccessModule(session, "marketplace")) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim() ?? "";
  const currency = (url.searchParams.get("currency") ?? "").trim().toUpperCase();
  const { rows } = await loadContractLedger({
    q: url.searchParams.get("q") ?? "",
    currency,
    days: Number(url.searchParams.get("days")) || 0,
  });
  const chosen = id ? rows.filter((row) => row.id === id) : rows;
  if (id && chosen.length === 0) return NextResponse.json({ error: "Contract not found." }, { status: 404 });
  const name = id ? `contract-ledger-${chosen[0]!.code}` : `contract-ledger-${currency || "all"}`;
  return new NextResponse(ledgerCsv(chosen), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}.csv"`,
      "cache-control": "no-store",
    },
  });
}
