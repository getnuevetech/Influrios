/**
 * Phase M E1 — collect sweep-clock evidence on the host.
 *
 * Usage (on Lightsail, from /var/www/influrios with DATABASE_URL pointing at 127.0.0.1):
 *   npx tsx scripts/staging-e1-sweep-evidence.ts
 *   CRON_SECRET=... APP_URL=https://influrios.com npx tsx scripts/staging-e1-sweep-evidence.ts --tick
 *
 * Prints latest succeeded job ids for milestone_auto_approval and recurring_cycle_sweep.
 * Does not mark Phase M complete.
 */

import { PrismaClient } from "@prisma/client";

const REQUIRED = ["milestone_auto_approval", "recurring_cycle_sweep"] as const;

async function maybeTick() {
  if (!process.argv.includes("--tick")) return null;
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  const app = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
  if (!secret) {
    console.error("--tick requires CRON_SECRET");
    process.exitCode = 1;
    return null;
  }
  const res = await fetch(`${app}/api/cron/sweeps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  console.log(`Tick POST ${app}/api/cron/sweeps → ${res.status}`);
  console.log(body.slice(0, 400));
  if (res.status !== 200) {
    process.exitCode = 1;
    return null;
  }
  return true;
}

async function main() {
  console.log("Influrios Phase M E1 sweep evidence\n");
  console.log(`When: ${new Date().toISOString()}\n`);

  await maybeTick();

  const prisma = new PrismaClient();
  try {
    console.log("| Kind | Succeeded job id | Succeeded at | Latest status |");
    console.log("|------|------------------|--------------|---------------|");
    let missing = 0;
    for (const kind of REQUIRED) {
      const succeeded = await prisma.job.findFirst({
        where: { kind, status: "succeeded" },
        orderBy: { updatedAt: "desc" },
        select: { id: true, updatedAt: true },
      });
      const latest = await prisma.job.findFirst({
        where: { kind },
        orderBy: { createdAt: "desc" },
        select: { status: true },
      });
      if (!succeeded) missing += 1;
      console.log(
        `| ${kind} | ${succeeded?.id ?? "—"} | ${succeeded?.updatedAt.toISOString() ?? "—"} | ${latest?.status ?? "never"} |`,
      );
    }
    console.log("");
    if (missing) {
      console.log("Missing succeeded rows. On the host confirm:");
      console.log("  crontab -l | grep sweep-cron");
      console.log("  */5 * * * * CRON_SECRET=… APP_URL=https://influrios.com /var/www/influrios/deploy/scripts/sweep-cron.sh");
      console.log("Then wait one interval or re-run with --tick.");
      process.exitCode = 1;
    } else {
      console.log("E1 job ids present. Paste them into docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md.");
      console.log("Crontab install is still an operator checkbox if not verified.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
