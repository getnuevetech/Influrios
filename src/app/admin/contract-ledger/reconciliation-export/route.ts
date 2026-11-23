import { NextResponse } from "next/server";
import { canAccessModule, getAdminSession } from "@/lib/admin-auth";
import { loadContractLedger } from "@/lib/contract-ledger";
import { loadStripeSnapshot, reconcile } from "@/lib/reconciliation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const money = (cents: number | null) => (cents == null ? "" : (cents / 100).toFixed(2));

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session || !canAccessModule(session, "marketplace")) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  const currency = (new URL(request.url).searchParams.get("currency") ?? "USD").trim().toUpperCase() || "USD";
  const { rows } = await loadContractLedger({ currency });
  const snapshot = await loadStripeSnapshot(currency);
  const result = reconcile(rows, snapshot);
  const lines = [
    ["As of", snapshot.fetchedAt.toISOString()],
    ["Currency", currency],
    [],
    ["Location", "Ledger balance", "Provider or bank balance", "Difference", "Status"],
    ...result.lines.map((line) => [
      line.location,
      money(line.ledgerCents),
      money(line.providerCents),
      money(line.differenceCents),
      line.matched == null ? "Not read" : line.matched ? "Matched" : "Difference",
    ]),
    [],
    ["Collected", money(result.collectedCents)],
    ["Paid to influencers", money(result.paidCents)],
    ["Processing costs", money(result.costsCents)],
    ["Refunded", money(result.refundedCents)],
    ["Platform top-ups", money(result.topupsCents)],
    ["Ledger cash", money(result.ledgerCashCents)],
    ["Combined cash (provider + bank)", money(result.combinedCents)],
    ["Unexplained difference", money(result.unexplainedCents)],
    ["Contract funds", money(result.heldCents + result.awaitingPayoutCents)],
    ["Tax payable", money(result.taxPayableCents)],
    ["Platform net", money(result.platformNetCents)],
    ...(snapshot.ok ? [] : [["Provider error", snapshot.error]]),
  ];
  const csv = lines.map((line) => line.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell)).join(",")).join("\n");
  return new NextResponse(`${csv}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="reconciliation-${currency}.csv"`,
      "cache-control": "no-store",
    },
  });
}
