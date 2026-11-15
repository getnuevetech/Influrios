import { BillingActivity } from "@/app/admin/billing/billing-activity";
import { SubscriptionsShell } from "@/app/admin/subscriptions/shell";
import { requireAdminPage } from "@/app/admin/guard";
import { canAccessModule, hasPermission } from "@/lib/admin-auth";
import { presentCheckoutSession } from "@/lib/admin-subscription-view";
import { BILLING_CATALOG, getBillingStore, getProduct, listBillingPriceIds } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { listPlanCatalog } from "@/lib/entitlements-db";
import { productSwitch } from "@/lib/product-switches";
import { stripeBillingMode } from "@/lib/stripe-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing activity · Admin" };

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminBillingPage({ searchParams }: Props) {
  const session = await requireAdminPage("billing");
  const canEdit = hasPermission(session, "gateways.edit");
  const showPlans = canAccessModule(session, "plans");
  const params = await searchParams;
  const store = await getBillingStore();
  const [portalOn, paidMentoringOn, prices, stripeMode, plans] = await Promise.all([
    productSwitch("customer_portal"),
    productSwitch("paid_mentoring"),
    listBillingPriceIds(),
    stripeBillingMode(),
    listPlanCatalog().catch(() => []),
  ]);
  const planName = new Map(plans.map((plan) => [plan.code, plan.name]));
  const userIds = [...new Set(store.sessions.map((item) => item.userId).filter((id): id is string => Boolean(id)))];
  const slugs = [...new Set(store.sessions.map((item) => item.creatorSlug).filter((id): id is string => Boolean(id)))];
  const [users, creators] = await Promise.all([
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }).catch(() => [])
      : [],
    slugs.length
      ? prisma.creator.findMany({ where: { slug: { in: slugs } }, select: { slug: true, displayName: true } }).catch(() => [])
      : [],
  ]);
  const userById = new Map(users.map((user) => [user.id, user]));
  const creatorBySlug = new Map(creators.map((creator) => [creator.slug, creator]));
  const sessions = store.sessions.map((item) => {
    const user = item.userId ? userById.get(item.userId) : undefined;
    const creator = item.creatorSlug ? creatorBySlug.get(item.creatorSlug) : undefined;
    const product = getProduct(item.sku);
    return presentCheckoutSession({
      ...item,
      accountName: creator?.displayName || user?.name || "",
      planName: product?.name ?? planName.get(item.sku) ?? item.sku,
      stripeMode,
    });
  });

  return (
    <SubscriptionsShell active="billing" showPlans={showPlans} showBilling>
      {params.saved ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Saved.</p>
      ) : null}
      {params.error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{params.error}</p>
      ) : null}
      <BillingActivity
        canEdit={canEdit}
        stripeMode={stripeMode}
        portalOn={portalOn}
        paidMentoringOn={paidMentoringOn}
        prices={prices}
        catalog={BILLING_CATALOG.map((product) => ({
          sku: product.sku,
          name: product.name,
          audience: product.audience,
          priceLabel: product.priceLabel,
          mapsTo: product.creatorPlan ?? product.businessPlan ?? "",
        }))}
        sessions={sessions}
        overrides={store.creatorOverrides}
        webhookSecretSet={Boolean(process.env.STRIPE_WEBHOOK_SECRET)}
        stripeSecretSet={Boolean(process.env.STRIPE_SECRET_KEY)}
        lastWebhookAt={store.lastWebhookAt}
      />
    </SubscriptionsShell>
  );
}
