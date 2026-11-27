import Link from "next/link";
import { actionRetryJob } from "@/app/admin/jobs/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { jobLabel, jobWhen, JOB_STATUS_LABEL } from "@/lib/job-labels";
import { listJobs, listSweepStatus } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobs · Admin" };

type Props = { searchParams: Promise<{ retried?: string }> };

export default async function AdminJobsPage({ searchParams }: Props) {
  const session = await requireAdminPage("jobs");
  const canRetry = hasPermission(session, "jobs.retry");
  const params = await searchParams;
  const [jobs, sweeps] = await Promise.all([
    listJobs().catch(() => null),
    listSweepStatus().catch(() => null),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Jobs</h1>
      <p className="mt-2 text-sm text-muted">
        Background work: emails, milestone auto-approval, payout sends and reminders. The server runs the scheduled
        checks every few minutes. A failed email can be sent again. Auto-approval skips milestones with an open dispute.
      </p>
      {sweeps ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {sweeps.map((sweep) => (
            <li key={sweep.kind} className="rounded-xl border border-[#E4EBFF] bg-white px-3 py-2 text-xs text-indigo">
              <span className="font-semibold">{jobLabel(sweep.kind)}</span>
              <span className="mt-1 block text-muted">
                Last run: {JOB_STATUS_LABEL[sweep.status] ?? sweep.status}
                {sweep.at ? ` · ${jobWhen(sweep.at)}` : ""}
                {sweep.lastError ? ` · ${sweep.lastError}` : ""}
              </span>
              {sweep.succeededId ? (
                <span className="mt-1 block text-[11px] text-emerald-800">
                  Last success{sweep.succeededAt ? `: ${jobWhen(sweep.succeededAt)}` : ""}
                </span>
              ) : (
                <span className="mt-1 block text-amber-800">Has not succeeded yet. It runs a few minutes after the server starts.</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {params.retried ? <p className="mt-4 text-sm font-semibold text-emerald-700">Retry queued.</p> : null}
      {!jobs ? <p className="mt-4 text-sm text-amber-800">The job list is unavailable.</p> : null}
      {jobs && jobs.length === 0 ? <p className="mt-4 text-sm text-muted">No jobs yet.</p> : null}
      <div className="mt-6 space-y-3">
        {jobs?.map((job) => (
          <article key={job.id} className="card-surface flex flex-wrap items-start justify-between gap-3 p-4">
            <div>
              <p className="font-semibold text-indigo">{jobLabel(job.kind)}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-violet">
                {JOB_STATUS_LABEL[job.status] ?? job.status} · {job.attempts} {job.attempts === 1 ? "attempt" : "attempts"}
              </p>
              {job.lastError ? <p className="mt-2 text-sm text-amber-800">{job.lastError}</p> : null}
              <p className="mt-1 text-xs text-muted">{jobWhen(job.createdAt)}</p>
            </div>
            {job.status === "failed" && canRetry ? (
              <form action={actionRetryJob}>
                <input type="hidden" name="id" value={job.id} />
                <button type="submit" className="btn-secondary !py-1.5 text-xs">
                  Retry
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
