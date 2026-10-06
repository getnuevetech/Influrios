import Link from "next/link";
import { actionCheckStripeSandbox, actionSaveBillingPrices, actionSaveBillingSwitches } from "@/app/admin/billing/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import {
  BILLING_CATALOG,
  getBillingStore,
  listBillingPriceIds,
} from "@/lib/billing";
import { stripeBillingMode } from "@/lib/stripe-admin";
import { productSwitch } from "@/lib/product-switches";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Billing" };

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminBillingPage({ searchParams }: Props) {
  const session = await requireAdminPage("billing");
  const canEdit = hasPermission(session, "gateways.edit");
  const params = await searchParams;
  const store = await getBillingStore();
  const [demoOn, portalOn, prices, stripeMode] = await Promise.all([
    productSwitch("demo_checkout"),
    productSwitch("customer_portal"),
    listBillingPriceIds(),
    stripeBillingMode(),
  ]);
  const completed = store.sessions.filter((s) => s.status === "completed").length;
  const open = store.sessions.filter((s) => s.status === "open").length;

  return (
    <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Billing</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Demo checkout stays on until you turn it off. A Stripe sandbox key (sk_test_ or rkcs_test_) can be saved
          on the Stripe gateway. Checkout opens Stripe and leaves the plan unpaid until Stripe confirms the session.
          A live key saved on the gateway is refused.
        </p>
      </div>

      {params.saved ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Saved.
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </div>
      ) : null}

      <section className="card-surface p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Checkout switches</h2>
        <p className="mt-1 text-sm text-muted">
          Demo checkout is {demoOn ? "on" : "off"}. Billing portal is {portalOn ? "on" : "off"}.
          {!canEdit ? " Saving these needs the gateways edit permission." : ""}
        </p>
        {canEdit ? (
          <>
          <form action={actionSaveBillingSwitches} className="mt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="demo_checkout" defaultChecked={demoOn} className="accent-violet" />
              Allow checkout to finish without Stripe
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="customer_portal" defaultChecked={portalOn} className="accent-violet" />
              Allow the Stripe billing portal
            </label>
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save switches
            </button>
          </form>
          <form action={actionCheckStripeSandbox} className="mt-4">
            <p className="text-sm text-muted">
              Sandbox status: {stripeMode === "sandbox" ? "key ready to check" : stripeMode === "live" ? "server live key" : stripeMode === "rejected" ? "saved key is not a sandbox key" : "no Stripe key"}.
            </p>
            <button type="submit" className="btn-secondary mt-2 !py-2 text-sm">
              Check Stripe sandbox
            </button>
          </form>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Sandbox status: {stripeMode === "sandbox" ? "key saved" : stripeMode === "live" ? "server live key" : stripeMode === "rejected" ? "saved key is not a sandbox key" : "no Stripe key"}.
          </p>
        )}
        <form action={canEdit ? actionSaveBillingPrices : undefined} className="mt-6 grid gap-3 sm:grid-cols-2">
          {BILLING_CATALOG.map((product) => (
            <label key={product.sku} className="text-xs font-semibold text-muted">
              {product.name} price id
              <input
                name={product.sku}
                defaultValue={prices[product.sku] ?? ""}
                placeholder={product.stripePriceEnv}
                disabled={!canEdit}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
          ))}
          {canEdit ? (
            <button type="submit" className="btn-secondary sm:col-span-2 w-fit !py-2 text-sm">
              Save price ids
            </button>
          ) : null}
        </form>
      </section>

      <div className="flex flex-wrap gap-3 text-center text-xs">
        <div className="rounded-xl bg-lavender px-4 py-2">
          <p className="font-display text-lg font-bold text-violet">{BILLING_CATALOG.length}</p>
          <p className="text-muted">SKUs</p>
        </div>
        <div className="rounded-xl bg-[#D9E8FF] px-4 py-2">
          <p className="font-display text-lg font-bold text-blue">{completed}</p>
          <p className="text-muted">Completed</p>
        </div>
        <div className="rounded-xl bg-amber-100 px-4 py-2">
          <p className="font-display text-lg font-bold text-amber-800">{open}</p>
          <p className="text-muted">Open</p>
        </div>
        <div className="rounded-xl bg-emerald-100 px-4 py-2">
          <p className="font-display text-lg font-bold text-emerald-700">
            {stripeMode === "sandbox" ? "Sandbox" : stripeMode === "live" ? "Live" : stripeMode === "rejected" ? "Key" : "Demo"}
          </p>
          <p className="text-muted">Mode</p>
        </div>
      </div>

      <section className="card-surface p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Environment</h2>
        <ul className="mt-3 space-y-1 text-sm text-muted">
          <li>STRIPE_SECRET_KEY: {process.env.STRIPE_SECRET_KEY ? "set" : "missing (demo mode)"}</li>
          <li>
            STRIPE_WEBHOOK_SECRET: {process.env.STRIPE_WEBHOOK_SECRET ? "set" : "missing"}
          </li>
          <li>
            Price envs:{" "}
            {BILLING_CATALOG.map((p) => p.stripePriceEnv).join(", ")}
          </li>
          <li>
            Webhook endpoint: <code className="text-indigo">/api/billing/webhook</code>
          </li>
          <li>
            Member plans change when Stripe confirms checkout. This console does not read a shared demo workspace.
          </li>
          {store.lastWebhookAt ? (
            <li>Last webhook: {new Date(store.lastWebhookAt).toLocaleString()}</li>
          ) : null}
        </ul>
        <Link href="/billing" className="btn-primary mt-4 inline-flex !py-2 text-sm">
          Open public billing page →
        </Link>
      </section>

      <section className="card-surface overflow-x-auto p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Catalog</h2>
        <table className="mt-4 w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="pb-2 pr-3 font-semibold">SKU</th>
              <th className="pb-2 pr-3 font-semibold">Name</th>
              <th className="pb-2 pr-3 font-semibold">Audience</th>
              <th className="pb-2 pr-3 font-semibold">Price</th>
              <th className="pb-2 font-semibold">Maps to</th>
            </tr>
          </thead>
          <tbody>
            {BILLING_CATALOG.map((p) => (
              <tr key={p.sku} className="border-t border-border">
                <td className="py-2.5 pr-3 font-mono text-xs text-indigo">{p.sku}</td>
                <td className="py-2.5 pr-3 font-semibold text-indigo">{p.name}</td>
                <td className="py-2.5 pr-3 capitalize">{p.audience}</td>
                <td className="py-2.5 pr-3">{p.priceLabel}</td>
                <td className="py-2.5 text-muted">
                  {p.creatorPlan ?? p.businessPlan}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Influencer plan overrides</h2>
        <ul className="mt-3 divide-y divide-border text-sm">
          {store.creatorOverrides.length === 0 ? (
            <li className="py-2 text-muted">None yet</li>
          ) : (
            store.creatorOverrides.map((o) => (
              <li key={o.creatorSlug} className="flex justify-between gap-3 py-2.5">
                <span className="font-semibold text-indigo">{o.creatorSlug}</span>
                <span className="text-muted">
                  {o.plan} · {o.source} · {new Date(o.updatedAt).toLocaleString()}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="card-surface overflow-x-auto p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Checkout sessions</h2>
        <table className="mt-4 w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="pb-2 pr-3 font-semibold">ID</th>
              <th className="pb-2 pr-3 font-semibold">SKU</th>
              <th className="pb-2 pr-3 font-semibold">Mode</th>
              <th className="pb-2 pr-3 font-semibold">Status</th>
              <th className="pb-2 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {store.sessions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-muted">
                  No sessions yet — run a demo checkout from /billing.
                </td>
              </tr>
            ) : (
              store.sessions.slice(0, 20).map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2.5 pr-3 font-mono text-[11px] text-indigo">{s.id}</td>
                  <td className="py-2.5 pr-3">{s.sku}</td>
                  <td className="py-2.5 pr-3">{s.mode}</td>
                  <td className="py-2.5 pr-3 capitalize">{s.status}</td>
                  <td className="py-2.5 text-muted">
                    {new Date(s.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
