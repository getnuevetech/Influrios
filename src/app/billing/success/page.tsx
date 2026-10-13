import Link from "next/link";
import {
  completeCheckout,
  getCheckoutAttempt,
  getProduct,
  type BillingAudience,
} from "@/lib/billing";
import { prisma } from "@/lib/db";

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

async function resolveAudience(sku: string | undefined): Promise<BillingAudience> {
  if (!sku) return "creator";
  const product = getProduct(sku);
  if (product) return product.audience;
  const plan = await prisma.entitlementPlan.findUnique({ where: { code: sku }, select: { audience: true } }).catch(() => null);
  return plan?.audience === "business" ? "business" : "creator";
}

export default async function BillingSuccessPage({ searchParams }: Props) {
  const params = await searchParams;
  const localId = params.local;

  let productName = params.sku ? getProduct(params.sku)?.name : undefined;
  let sku = params.sku;
  let error: string | null = null;

  if (params.demo === "1") {
    error = "Checkout was not confirmed by Stripe. Nothing was changed.";
  } else if (localId) {
    const result = await completeCheckout(localId, {
      creatorSlug: params.creator || undefined,
    });
    if (result.ok) {
      productName = result.product.name;
      sku = result.product.sku;
    } else {
      error = result.error;
      const attempt = await getCheckoutAttempt(localId).catch(() => null);
      if (attempt?.sku) sku = attempt.sku;
    }
  } else if (!params.session_id) {
    error = "Missing checkout session.";
  }

  if (!productName && sku) {
    productName = getProduct(sku)?.name;
  }

  const audience = await resolveAudience(sku);
  const homeHref = audience === "business" ? "/business/home" : "/creator";
  const homeLabel = audience === "business" ? "Business dashboard →" : "Creator dashboard →";
  const activeCopy =
    audience === "business"
      ? "Stripe confirmed this checkout. The plan is active on your workspace."
      : "Stripe confirmed this checkout. Your influencer plan is active.";

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
            <p className="mt-3 text-sm text-muted">{activeCopy}</p>
          </>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={homeHref} className="btn-primary">
            {homeLabel}
          </Link>
          <Link href="/billing" className="btn-secondary">
            Back to plans
          </Link>
        </div>
      </div>
    </div>
  );
}
