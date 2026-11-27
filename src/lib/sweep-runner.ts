import { prisma } from "@/lib/db";

/** Any fixed number; Postgres uses it to let only one sweep run at a time across processes. */
const SWEEP_LOCK_KEY = 74_201_123;
const TICK_MS = 5 * 60_000;

export type SweepTickResult = { ran: boolean; enqueued?: unknown; processed?: unknown };

/**
 * Enqueue due sweeps and process due jobs, holding a Postgres transaction lock so the in-process
 * clock and an optional host cron never run at the same time. Returns ran=false when another run holds it.
 */
export async function runSweepTick(): Promise<SweepTickResult> {
  const { enqueueDueSweeps, processDueJobs } = await import("@/lib/jobs");
  return prisma.$transaction(
    async (tx) => {
      const [row] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${SWEEP_LOCK_KEY}) AS locked`;
      if (!row?.locked) return { ran: false };
      const enqueued = await enqueueDueSweeps();
      const processed = await processDueJobs(32);
      // Pick up Stripe's identity and payout decisions for influencers still in review.
      const { refreshPendingConnectAccounts } = await import("@/lib/stripe-connect-status");
      const connect = await refreshPendingConnectAccounts().catch(() => null);
      return { ran: true, enqueued, processed, connect };
    },
    { timeout: 4 * 60_000, maxWait: 10_000 },
  );
}

let started = false;

/** Start the in-process sweep clock once per server process. */
export function startSweepClock(log: Pick<Console, "error"> = console) {
  if (started) return false;
  started = true;
  const tick = () => {
    runSweepTick().catch((error) => log.error("sweep clock", error));
  };
  setTimeout(tick, 60_000).unref?.();
  // Plan prices are Influrios amounts; make sure Stripe has a matching price for each (no admin step).
  setTimeout(() => {
    import("@/lib/stripe-plan-prices")
      .then((mod) => mod.ensurePlanStripePrices())
      .catch((error) => log.error("plan price sync", error));
  }, 30_000).unref?.();
  setInterval(tick, TICK_MS).unref?.();
  return true;
}

/** The clock runs in production unless IN_PROCESS_SWEEPS=0 turns it off. */
export function sweepClockEnabled(env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV === "production" && env.IN_PROCESS_SWEEPS !== "0" && env.NEXT_PHASE !== "phase-production-build";
}
