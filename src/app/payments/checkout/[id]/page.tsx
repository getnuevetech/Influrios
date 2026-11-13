import { notFound, redirect } from "next/navigation";
import { CheckoutPanel } from "@/app/payments/checkout/[id]/checkout-panel";
import { isBusinessRole } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { assertFundingAccess } from "@/lib/funding-access";
import { syncOpenGatewayDeposits } from "@/lib/funding-checkout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fund collaboration" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; recorded?: string; returned?: string; cancelled?: string }>;
};

export default async function FundingCheckoutPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent(`/payments/checkout/${id}`)}&gate=payments`);
  const access = await assertFundingAccess(account, id);
  if (!access.ok) notFound();
  const businessViewer = isBusinessRole(account.role);
  if (businessViewer) await syncOpenGatewayDeposits(access.funding.id).catch(() => false);
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: access.funding.id },
    include: { deposits: { orderBy: { createdAt: "desc" } } },
  });
  if (!funding) notFound();
  return (
    <CheckoutPanel
      fundingId={funding.id}
      title={funding.title}
      currency={funding.currency}
      status={funding.status}
      grossCents={funding.grossCents}
      feeSnapshot={funding.feeSnapshotJson}
      deposits={funding.deposits}
      businessViewer={businessViewer}
      error={query.error}
      recorded={query.recorded}
      returned={query.returned}
      cancelled={query.cancelled}
    />
  );
}
