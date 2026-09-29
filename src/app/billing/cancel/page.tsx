import Link from "next/link";
import { cancelCheckout } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout canceled" };

type Props = {
  searchParams: Promise<{ local?: string }>;
};

export default async function BillingCancelPage({ searchParams }: Props) {
  const params = await searchParams;
  if (params.local) {
    await cancelCheckout(params.local);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="card-surface p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Checkout</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Checkout canceled</h1>
        <p className="mt-3 text-sm text-muted">
          No charge was made. You can restart anytime from the plans page.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/billing" className="btn-primary">
            View plans →
          </Link>
          <Link href="/" className="btn-secondary">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
