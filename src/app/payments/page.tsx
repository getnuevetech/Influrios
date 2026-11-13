import Link from "next/link";
import { actionRequestChangeOrder } from "@/app/payments/actions";
import { PaymentsScreen } from "@/app/payments/payments-panel";
import { isBusinessRole } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { prisma } from "@/lib/db";
import { listFundingsForBusiness, listFundingsForCreator } from "@/lib/marketplace-ledger";
import { collectionCheckoutFields } from "@/lib/provider-collection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Collaboration Payments" };

type Props = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    currency?: string;
    page?: string;
    deal?: string;
    tab?: string;
    case?: string;
    error?: string;
    approved?: string;
    returned?: string;
    from?: string;
    to?: string;
  }>;
};

export default function PaymentsPage({ searchParams }: Props) {
  return (
    <>
      <p className="mx-auto max-w-6xl px-5 pt-6 text-sm text-muted">
        Start funding from a signed collaboration contract.
      </p>
      <PaymentsScreen searchParams={searchParams} />
      <ChangeOrderSlot searchParams={searchParams} />
    </>
  );
}

async function ChangeOrderSlot({ searchParams }: Props) {
  const params = await searchParams;
  if (!params.deal) return null;
  const account = await getAccountSession().catch(() => null);
  if (!account || !isBusinessRole(account.role)) return null;
  const workspace = await getWorkspace(account.id).catch(() => null);
  const creator = await prisma.creator.findUnique({ where: { userId: account.id }, select: { slug: true } }).catch(() => null);
  const fundings =
    workspace?.businessId && workspace.businessId !== "public"
      ? await listFundingsForBusiness(workspace.businessId).catch(() => [])
      : creator?.slug
        ? await listFundingsForCreator(creator.slug).catch(() => [])
        : [];
  const deal = fundings.find((row) => row.id === params.deal);
  if (!deal || deal.status !== "awaiting_provider") return null;
  const checkoutFields = collectionCheckoutFields(deal.providerCode);
  return (
    <section className="mx-auto max-w-3xl px-5 pb-10">
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-ink">Change order</summary>
        <form action={actionRequestChangeOrder} className="mt-3 space-y-3">
          <input type="hidden" name="dealId" value={deal.id} />
          <label className="block text-sm">
            New gross
            <input name="grossUsd" type="number" min={1} step="0.01" required className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
          </label>
          <label className="block text-sm">
            What changed
            <input name="note" required minLength={8} className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
          </label>
          <button type="submit" className="btn-secondary text-sm">Record change order</button>
        </form>
      </details>
      <p className="mt-3 text-sm text-muted">
        {checkoutFields.canOpen
          ? "Checkout opens with the provider. A manual deposit stays unfunded until finance confirms it."
          : "A manual deposit stays unfunded until finance confirms it."}
      </p>
      <Link href={`/payments/checkout/${deal.id}`} className="text-sm text-violet hover:underline">
        Continue checkout
      </Link>
      <Link href={`/collaboration/work/${deal.id}`} className="ml-4 text-sm text-violet hover:underline">
        Open delivery
      </Link>
    </section>
  );
}
