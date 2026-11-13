import Link from "next/link";
import { redirect } from "next/navigation";
import { actionRecheckVerification } from "@/app/admin/payment-standard/actions";
import { isBusinessRole } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { verificationTasks } from "@/lib/payment-standard-v4";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verification" };

export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ returned?: string; rechecked?: string; error?: string }>;
}) {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/account/verification");
  const query = await searchParams;
  const business = isBusinessRole(account.role);
  const creator = await prisma.creator.findUnique({
    where: { userId: account.id },
    select: {
      identityVerified: true,
      payoutProfile: { select: { primaryStatus: true, stripeConnectAccountId: true } },
    },
  }).catch(() => null);
  const stored = await prisma.paymentVerificationTask.findMany({ where: { userId: account.id } }).catch(() => []);
  const tasks = verificationTasks({
    role: business ? "paying_business" : "receiving_influencer",
    emailVerified: Boolean(account.emailVerifiedAt),
    individualVerified: creator?.identityVerified === "VERIFIED",
    entityStatus: "in_review",
    authorityStatus: business ? "not_started" : "verified",
    taxStatus: "not_started",
    connectStatus: creator?.payoutProfile?.stripeConnectAccountId ? "in_progress" : "not_started",
    bankStatus: creator?.payoutProfile?.primaryStatus === "VERIFIED" ? "verified" : "not_started",
    connectReturnSeen: query.returned === "1",
  });
  for (const row of stored) {
    const task = tasks.find((item) => item.key === row.checkKey);
    if (task && row.status === "in_review") task.status = "in_review";
  }
  return (
    <div data-screen="V01" className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <h1 className="font-display text-3xl font-bold text-indigo">Verification</h1>
      <p className="text-sm text-muted">Each check stays separate. A return from hosted onboarding does not mark you verified.</p>
      {query.returned ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm">We are rechecking payout setup. This page did not mark it complete.</p> : null}
      {query.rechecked ? <p className="rounded-2xl bg-white px-4 py-3 text-sm">The task is in Influrios review. It is not Stripe verified.</p> : null}
      {query.error ? <p className="text-sm text-rose-800">{query.error}</p> : null}
      <ul className="space-y-3">
        {tasks.map((task) => (
          <li key={task.key} className="rounded-2xl border border-border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-indigo">{task.label}</p>
              <span className="text-xs font-semibold uppercase">{task.status.replaceAll("_", " ")}</span>
            </div>
            <p className="text-sm text-muted">Owner: {task.owner}</p>
            {task.status !== "verified" ? (
              <form action={actionRecheckVerification} className="mt-3">
                <input type="hidden" name="checkKey" value={task.key} />
                <input type="hidden" name="role" value={business ? "paying_business" : "receiving_influencer"} />
                <button type="submit" className="h-11 rounded-full bg-violet px-4 text-sm font-semibold text-white">
                  {task.key === "connect" ? "Resume payout setup" : "Continue"}
                </button>
              </form>
            ) : (
              <p className="mt-2 text-sm text-emerald-800">Payout setup complete does not move money.</p>
            )}
          </li>
        ))}
      </ul>
      <Link href={business ? "/business/home" : "/creator"} className="text-sm font-semibold text-violet">Back</Link>
    </div>
  );
}
