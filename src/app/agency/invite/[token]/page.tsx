import Link from "next/link";
import { notFound } from "next/navigation";
import { actionAcceptAgencySeatInvite } from "@/app/agency/invite/actions";
import { getAccountSession } from "@/lib/accounts";
import {
  agencySeatAccessGate,
  getAgencySeatByInviteToken,
} from "@/lib/agency-seats";
import { productSwitch } from "@/lib/product-switches";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accept agency seat" };

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AgencySeatInvitePage({ params, searchParams }: Props) {
  const { token } = await params;
  const query = await searchParams;
  const [seat, seatsOn, account] = await Promise.all([
    getAgencySeatByInviteToken(token),
    productSwitch("agency_seats"),
    getAccountSession(),
  ]);
  if (!seat) notFound();

  const gate = agencySeatAccessGate({
    seatsEnabled: seatsOn,
    inviteStatus: seat.inviteStatus,
    active: true,
    expiresAt: seat.expiresAt,
  });
  const accepted = seat.inviteStatus === "accepted";
  const canAccept = seatsOn && seat.inviteStatus === "pending" && gate.ok;

  return (
    <div className="min-h-[70vh] bg-[radial-gradient(ellipse_at_top,_#EAE4FF,_#F7FAFF_55%,_#D9E8FF)] px-4 py-12">
      <div className="mx-auto max-w-md card-surface space-y-4 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Agency seat</p>
        <h1 className="font-display text-2xl font-bold text-indigo">Join the agency workspace</h1>
        <p className="text-sm text-muted">
          Invite for <span className="font-semibold text-indigo">{seat.email}</span> as{" "}
          <span className="font-semibold text-indigo">{seat.role}</span>.
        </p>

        {query.error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {query.error}
          </div>
        ) : null}

        {!seatsOn ? (
          <p className="text-sm text-muted">Agency seats are turned off. Ask an admin to enable the switch.</p>
        ) : accepted ? (
          <p className="text-sm text-emerald-800">
            This seat is already accepted
            {account && account.email.toLowerCase() === seat.email.toLowerCase()
              ? ". Open the workspace to continue."
              : "."}
          </p>
        ) : !gate.ok ? (
          <p className="text-sm text-amber-900">{gate.error}</p>
        ) : !account ? (
          <div className="space-y-3 text-sm text-muted">
            <p>Sign in with {seat.email} to accept this invite.</p>
            <Link
              href={`/login?next=${encodeURIComponent(`/agency/invite/${token}`)}`}
              className="btn-primary inline-flex !py-2 text-sm"
            >
              Sign in to accept
            </Link>
          </div>
        ) : account.email.toLowerCase() !== seat.email.toLowerCase() ? (
          <p className="text-sm text-amber-900">
            Signed in as {account.email}. Sign in as {seat.email} to accept.
          </p>
        ) : canAccept ? (
          <form action={actionAcceptAgencySeatInvite}>
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="btn-primary !py-2 text-sm">
              Accept seat invite
            </button>
          </form>
        ) : null}

        <Link href="/agency" className="inline-block text-sm font-semibold text-violet hover:underline">
          ← Agency workspace
        </Link>
      </div>
    </div>
  );
}
