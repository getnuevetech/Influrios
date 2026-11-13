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
}: {
  fundingId: string;
  milestoneId: string;
  milestoneName: string;
  version: number;
  currency: string;
  grossCents: number;
  businessFeeCents: number;
  closeHref: string;
}) {
  const copy = approvalCopy({
    amountCents: grossCents + businessFeeCents,
    currency,
    versionLabel: `v${version}`,
    milestoneName,
  });
  return (
    <RecordDialog title="Approve and release" closeHref={closeHref} wide={false}>
      <form data-screen="W02" action={actionApproveAndRelease} className="space-y-4">
        <input type="hidden" name="dealId" value={fundingId} />
        <input type="hidden" name="milestoneId" value={milestoneId} />
        <input type="hidden" name="versionNumber" value={version} />
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
        <button type="submit" className="inline-flex h-11 items-center rounded-full bg-violet px-4 text-sm font-semibold text-white">{copy.button}</button>
        <p><Link href={closeHref} className="text-sm font-semibold text-violet">Back</Link></p>
      </form>
    </RecordDialog>
  );
}
