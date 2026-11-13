import { NextResponse } from "next/server";
import { authSecretConfigured } from "@/lib/app-secret";
import { prisma } from "@/lib/db";
import { readDeploymentRevision } from "@/lib/deployment-revision";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public liveness/readiness. Does not expose secrets or provider details.
 * 200 when web + DB are ok; 503 when DB is unreachable.
 * revision is the git SHA baked into the image, or null when the image has none.
 */
export async function GET() {
  const ts = new Date().toISOString();
  const started = Date.now();
  let dbOk = false;
  let latencyMs: number | undefined;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
    latencyMs = Date.now() - started;
  } catch {
    dbOk = false;
  }

  const ok = dbOk;
  const body = {
    ok,
    status: ok ? ("ok" as const) : ("degraded" as const),
    checks: {
      web: { ok: true },
      db: dbOk ? { ok: true, latencyMs } : { ok: false },
    },
    secrets: { authConfigured: authSecretConfigured() },
    revision: readDeploymentRevision(process.env["INFLURIOS_REVISION"]),
    ts,
  };

  return NextResponse.json(body, { status: ok ? 200 : 503 });
}
