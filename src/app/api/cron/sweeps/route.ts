import { NextResponse } from "next/server";
import { runSweepTick } from "@/lib/sweep-runner";
import { cronAuthorized } from "@/lib/sweep-clock";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!cronAuthorized(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await runSweepTick();
  return NextResponse.json({ ok: true, ...result });
}
