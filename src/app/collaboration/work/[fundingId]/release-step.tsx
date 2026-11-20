import Link from "next/link";
import { actionApproveAndRelease } from "@/app/payments/standard-actions";
import { RecordDialog } from "@/components/payment-journey/record-dialog";
import { MoneyAmount } from "@/components/payment-journey/status";
import { approvalCopy } from "@/lib/payment-standard-v4";

export function ReleaseStep({
  fundingId,
  milestoneId,
  milestoneName,
  version,
  currency,
  grossCents,
  businessFeeCents,
  closeHref,
  changesHref,
  tab = "milestones",
  linkUrl = null,
  files = [],
  note = null,
}: {
  fundingId: string;
  milestoneId: string;
  milestoneName: string;
  version: number;
  currency: string;
  grossCents: number;
  businessFeeCents: number;
  closeHref: string;
  changesHref: string;
  tab?: string;
  linkUrl?: string | null;
  files?: { id: string; fileName: string }[];
  note?: string | null;
}) {
  const copy = approvalCopy({
    amountCents: grossCents + businessFeeCents,
    currency,
    versionLabel: `v${version}`,
    milestoneName,
  });
  return (
    <RecordDialog title={`Approve version ${version}?`} closeHref={closeHref} wide={false}>
      <form data-screen="W02" action={actionApproveAndRelease} className="space-y-4">
        <input type="hidden" name="dealId" value={fundingId} />
        <input type="hidden" name="milestoneId" value={milestoneId} />
        <input type="hidden" name="versionNumber" value={version} />
        <input type="hidden" name="tab" value={tab} />
        <p className="text-sm text-muted">Confirm this version · payment remains separate</p>
        <div className="rounded-2xl border border-[#E4E9F5] bg-[#FAFBFF] px-3 py-3 text-sm text-[#344054]">
          <p>
            <span className="font-semibold text-[#1B1464]">Version</span> · {version}
            {note ? ` · ${note}` : ""}
          </p>
          <p className="mt-2">
            <span className="font-semibold text-[#1B1464]">Files / link</span>
            {files.length === 0 && !linkUrl ? " · None attached" : null}
          </p>
          {linkUrl ? <p className="mt-1 font-semibold text-[#087B5A]">Saved as {linkUrl}</p> : null}
          {files.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {files.map((file) => (
                <li key={file.id}>
                  <a href={`/api/deliverables/${file.id}`} className="font-semibold text-[#6D4AFF] hover:underline">
                    {file.fileName}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2">
            <span className="font-semibold text-[#1B1464]">Consequences</span> · Marks delivery approved for this milestone.
            Does not pay the influencer or release bank funds by itself until you confirm release below.
          </p>
        </div>
        <p className="text-sm text-muted">{copy.note}</p>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3"><dt>Milestone</dt><dd className="font-semibold">{milestoneName}</dd></div>
          <div className="flex justify-between gap-3"><dt>Version</dt><dd className="font-semibold">v{version}</dd></div>
          <div className="flex justify-between gap-3"><dt>Gross</dt><dd><MoneyAmount cents={grossCents} currency={currency} /></dd></div>
          <div className="flex justify-between gap-3"><dt>Business fee allocation</dt><dd><MoneyAmount cents={businessFeeCents} currency={currency} /></dd></div>
        </dl>
        <p className="text-sm">This uses money already funded. It does not charge the business again, and it does not mark the payout paid.</p>
        <label className="flex min-h-11 items-start gap-2 text-sm">
          <input type="checkbox" name="acknowledge" required className="mt-1" />
          <span>{copy.acknowledgement}</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <Link
            href={changesHref}
            className="inline-flex h-11 items-center rounded-full border border-[#E4E9F5] px-4 text-sm font-semibold text-[#1B1464]"
          >
            Need changes instead
          </Link>
          <button type="submit" className="inline-flex h-11 items-center rounded-full bg-violet px-4 text-sm font-semibold text-white">
            Approve version {version}
          </button>
        </div>
        <p>
          <Link href={closeHref} className="text-sm font-semibold text-violet">
            Cancel
          </Link>
        </p>
      </form>
    </RecordDialog>
  );
}
