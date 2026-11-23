import { startSweepClock, sweepClockEnabled } from "@/lib/sweep-runner";

if (sweepClockEnabled()) startSweepClock();
