import Link from "next/link";
import {
  completeCheckout,
  getProduct,
} from "@/lib/billing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout success" };

type Props = {
  searchParams: Promise<{
    local?: string;
    session_id?: string;
    demo?: string;
    sku?: string;
    creator?: string;
  }>;
};

export default async function BillingSuccessPage({ searchParams }: Props) {
  const params = await searchParams;
  const localId = params.local;

  let productName = params.sku ? getProduct(params.sku)?.name : undefined;
  let error: string | null = null;

  if (params.demo === "1") {
    error = "Checkout was not confirmed by Stripe. Nothing was changed.";
  } else if (localId) {
    const result = await completeCheckout(localId, {
      creatorSlug: params.creator || undefined,
    });
    if (result.ok) {
      productName = result.product.name;
    } else {
      error = result.error;
    }
  } else if (!params.session_id) {
    error = "Missing checkout session.";
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="card-surface p-8 text-center">
        {error ? (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Checkout</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Couldn’t confirm</h1>
            <p className="mt-2 text-sm text-muted">{error}</p>
          </>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
              Payment received
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-indigo">
              You’re on {productName ?? "your plan"}
            </h1>
            <p className="mt-3 text-sm text-muted">
              Stripe confirmed this checkout. The plan is active on your workspace.
            </p>
          </>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/business" className="btn-primary">
            Business workspace →
          </Link>
          <Link href="/billing" className="btn-secondary">
            Back to plans
          </Link>
        </div>
      </div>
    </div>
  );
}
