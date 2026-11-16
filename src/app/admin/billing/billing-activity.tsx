"use client";

import { useState } from "react";
import Link from "next/link";
import { actionCheckStripeSandbox, actionPauseAnnualCode, actionSaveBillingPrices, actionSaveBillingSwitches } from "@/app/admin/billing/actions";
import { SubscriptionsDialog } from "@/app/admin/subscriptions/dialog";
import { IconCalendar, IconCheck, IconCopy, IconSearch, IconSettings, IconX } from "@/components/icons";
import {
  CHECKOUT_STATUS_LABEL,
  filterCheckoutActivity,
  type CheckoutActivityRow,
  type CheckoutDisplayStatus,
} from "@/lib/admin-subscription-view";

const fieldClass = "mt-1 w-full rounded-xl border border-[#E4EBFF] px-3 py-2 text-sm font-normal text-indigo";

type CatalogRow = {
  sku: string;
  name: string;
  audience: string;
  priceLabel: string;
  mapsTo: string;
};

type OverrideRow = {
  creatorSlug: string;
  plan: string;
  source: string;
  updatedAt: string;
};

export function BillingActivity({
  canEdit,
  stripeMode,
  portalOn,
  paidMentoringOn,
  prices,
  annual = {},
  unpricedAnnualCodes = [],
  catalog,
  sessions,
  overrides,
  webhookSecretSet,
  stripeSecretSet,
  lastWebhookAt,
}: {
  canEdit: boolean;
  stripeMode: "sandbox" | "live" | "demo" | "rejected";
  portalOn: boolean;
  paidMentoringOn: boolean;
  prices: Record<string, string>;
  annual?: Record<string, { amount: string; priceId: string }>;
  unpricedAnnualCodes?: { id: string; code: string; planName: string }[];
  catalog: CatalogRow[];
  sessions: CheckoutActivityRow[];
  overrides: OverrideRow[];
  webhookSecretSet: boolean;
  stripeSecretSet: boolean;
  lastWebhookAt?: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | CheckoutDisplayStatus>("all");
  const [range, setRange] = useState<"all" | "7" | "30" | "90">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [showOverrides, setShowOverrides] = useState(false);
  const [copied, setCopied] = useState(false);
  const rows = filterCheckoutActivity(sessions, { query, status, range, now: Date.now() });
  const open = sessions.find((session) => session.id === openId) ?? null;
  const stripeLabel =
    stripeMode === "sandbox" ? "Sandbox" : stripeMode === "live" ? "Live" : stripeMode === "rejected" ? "Key unreadable" : "Not configured";

  async function copyReference(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-indigo">Billing activity</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#E4EBFF] bg-white px-3 py-1 text-sm font-semibold text-indigo">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-violet text-[11px] font-bold text-white">S</span>
              Stripe
              <span className="text-muted">·</span>
              {stripeLabel}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#E4EBFF] bg-white px-3 py-1 text-sm font-semibold text-indigo">
              <span className={`h-2.5 w-2.5 rounded-full ${portalOn ? "bg-emerald-500" : "bg-slate-300"}`} />
              Customer portal
              <span className="text-muted">·</span>
              {portalOn ? "On" : "Off"}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button type="button" className="btn-primary !py-2 text-sm" onClick={() => setSettings(true)}>
            <IconSettings size={16} />
            Billing settings
          </button>
          <button type="button" className="text-sm font-semibold text-violet hover:underline" onClick={() => setShowOverrides(true)}>
            Manage account overrides
          </button>
        </div>
      </div>

      <section className="card-surface mt-6 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Checkout sessions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by account or reference..."
              className="w-full rounded-full border border-[#E4EBFF] py-2 pl-9 pr-3 text-sm text-indigo"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "all" | CheckoutDisplayStatus)}
            aria-label="Status"
            className="rounded-full border border-[#E4EBFF] bg-white px-3 py-2 text-sm text-indigo"
          >
            <option value="all">Status: All</option>
            <option value="completed">Status: Completed</option>
            <option value="open">Status: Open</option>
            <option value="expired">Status: Expired</option>
          </select>
          <label className="relative">
            <span className="sr-only">Date range</span>
            <IconCalendar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <select
              value={range}
              onChange={(event) => setRange(event.target.value as "all" | "7" | "30" | "90")}
              className="rounded-full border border-[#E4EBFF] bg-white py-2 pl-9 pr-3 text-sm text-indigo"
            >
              <option value="all">Date range: All time</option>
              <option value="7">Date range: Last 7 days</option>
              <option value="30">Date range: Last 30 days</option>
              <option value="90">Date range: Last 90 days</option>
            </select>
          </label>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="bg-[#F3EEFF] text-xs font-semibold text-indigo">
                <th className="rounded-l-xl px-4 py-3">Date</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Checkout status</th>
                <th className="rounded-r-xl px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-muted">
                    {sessions.length === 0 ? "No sessions yet. A plan changes after Stripe confirms checkout." : "No sessions match these filters."}
                  </td>
                </tr>
              ) : (
                rows.map((session) => (
                  <tr
                    key={session.id}
                    className={`cursor-pointer border-t border-[#F0F3FA] ${openId === session.id ? "bg-[#F7F4FF]" : "hover:bg-[#F7F4FF]"}`}
                    onClick={() => {
                      setCopied(false);
                      setOpenId(session.id);
                    }}
                  >
                    <td className="px-4 py-3 text-indigo">{session.dateLabel}</td>
                    <td className="px-4 py-3 font-semibold text-indigo">{session.account}</td>
                    <td className="px-4 py-3 text-indigo">{session.plan}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={session.displayStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-semibold text-violet hover:underline"
                        onClick={() => {
                          setCopied(false);
                          setOpenId(session.id);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {open ? (
        <SubscriptionsDialog
          title="Checkout details"
          onClose={() => {
            setOpenId(null);
            setCopied(false);
          }}
        >
          <StatusBadge status={open.displayStatus} />
          <dl className="mt-4 divide-y divide-[#F0F3FA] text-sm">
            <Detail label="Account" value={open.account} />
            <Detail label="Plan" value={open.plan} />
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-muted">Environment</dt>
              <dd>
                <span className="rounded-full bg-[#EEE8FF] px-2.5 py-0.5 text-xs font-semibold text-violet">{open.environment}</span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-muted">Provider reference</dt>
              <dd className="flex min-w-0 items-center gap-2">
                <code className="truncate rounded-lg bg-[#F4F6FB] px-2 py-1 text-xs text-indigo">{open.reference}</code>
                <button type="button" aria-label="Copy provider reference" className="text-indigo hover:text-violet" onClick={() => copyReference(open.reference)}>
                  <IconCopy size={16} />
                </button>
              </dd>
            </div>
          </dl>
          {copied ? <p className="text-xs font-semibold text-emerald-700">Copied.</p> : null}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="btn-primary !py-2 text-sm"
              onClick={() => {
                setOpenId(null);
                setCopied(false);
              }}
            >
              Close
            </button>
          </div>
        </SubscriptionsDialog>
      ) : null}

      {settings ? (
        <SubscriptionsDialog title="Billing settings" onClose={() => setSettings(false)} wide>
          <p className="text-sm text-muted">
            Stripe status: {stripeMode === "sandbox" ? "sandbox key ready" : stripeMode === "live" ? "live key ready" : stripeMode === "rejected" ? "saved key invalid or unreadable" : "no Stripe key"}.
            {" "}
            {stripeSecretSet ? "A Stripe secret is set in the environment." : "Save a Stripe secret on Payment gateways."}
            {" "}
            Webhook secret: {webhookSecretSet ? "set" : "missing"}. Endpoint: /api/billing/webhook.
            {lastWebhookAt ? ` Last webhook: ${new Date(lastWebhookAt).toLocaleString()}.` : ""}
          </p>
          {canEdit ? (
            <>
              <form action={actionSaveBillingSwitches} className="mt-4 space-y-3">
                <label className="flex items-center gap-2 text-sm text-indigo">
                  <input type="checkbox" name="customer_portal" defaultChecked={portalOn} className="accent-violet" />
                  Allow the Stripe billing portal
                </label>
                <label className="flex items-center gap-2 text-sm text-indigo">
                  <input type="checkbox" name="paid_mentoring" defaultChecked={paidMentoringOn} className="accent-violet" />
                  Allow paid mentorship sessions
                </label>
                <p className="text-xs text-muted">
                  Paid mentorship stays off until this is checked. Checkout uses the Stripe gateway, then Airwallex when Stripe is not saved. The session stays unpaid until the payment webhook.
                </p>
                <button type="submit" className="btn-primary !py-2 text-sm">
                  Save switches
                </button>
              </form>
              <form action={actionCheckStripeSandbox} className="mt-4">
                <button type="submit" className="btn-secondary !py-2 text-sm">
                  Check Stripe sandbox
                </button>
              </form>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">Saving these needs the gateways edit permission.</p>
          )}
          <form action={canEdit ? actionSaveBillingPrices : undefined} className="mt-6 grid gap-3 sm:grid-cols-2">
            <p className="text-sm font-normal text-muted sm:col-span-2">
              Existing subscriptions stay on the price they already use. A blank monthly field keeps the current mapping. An annual amount can be saved before the annual price id. Public pricing can show that amount, and checkout stays unpublished until the annual price id is saved. Leave both annual fields blank to keep annual unpublished. The annual price id has to differ from the monthly price id.
            </p>
            {unpricedAnnualCodes.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-normal text-amber-950 sm:col-span-2">
                <p className="font-semibold">Annual codes without a saved annual price</p>
                <ul className="mt-2 space-y-2">
                  {unpricedAnnualCodes.map((code) => (
                    <li key={code.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{code.code} is active for {code.planName} annual, and that price is not saved.</span>
                      {canEdit ? (
                        <button type="submit" formAction={actionPauseAnnualCode} name="offerId" value={code.id} className="rounded-full border border-amber-400 px-3 py-1 text-xs font-semibold">
                          Pause code
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {catalog.map((product) => (
              <div key={product.sku} className="text-xs font-semibold text-muted">
                <label>
                  {product.name} monthly price id
                  <input name={product.sku} defaultValue={prices[product.sku] ?? ""} disabled={!canEdit} className={fieldClass} />
                </label>
                <label className="mt-2 block">
                  Annual amount (USD)
                  <input name={`${product.sku}_annual_amount`} defaultValue={annual[product.sku]?.amount ?? ""} disabled={!canEdit} placeholder="0.00" className={fieldClass} />
                </label>
                <label className="mt-2 block">
                  Annual price id
                  <input name={`${product.sku}_annual_price`} defaultValue={annual[product.sku]?.priceId ?? ""} disabled={!canEdit} placeholder="price_..." className={fieldClass} />
                </label>
              </div>
            ))}
            {canEdit ? (
              <button type="submit" className="btn-secondary w-fit !py-2 text-sm sm:col-span-2">
                Save price ids
              </button>
            ) : null}
          </form>
          <ul className="mt-4 space-y-1 text-sm text-muted">
            {catalog.map((product) => (
              <li key={product.sku}>
                {product.name} · {product.audience} · {product.priceLabel} · {product.mapsTo}
              </li>
            ))}
          </ul>
          <Link href="/billing" className="mt-4 inline-flex text-sm font-semibold text-violet hover:underline">
            Open the public billing page
          </Link>
        </SubscriptionsDialog>
      ) : null}

      {showOverrides ? (
        <SubscriptionsDialog title="Account overrides" onClose={() => setShowOverrides(false)}>
          {overrides.length === 0 ? (
            <p className="text-sm text-muted">None yet</p>
          ) : (
            <ul className="divide-y divide-[#F0F3FA] text-sm">
              {overrides.map((override) => (
                <li key={override.creatorSlug} className="flex justify-between gap-3 py-2.5">
                  <span className="font-semibold text-indigo">{override.creatorSlug}</span>
                  <span className="text-right text-muted">
                    {override.plan} · {override.source}
                    <span className="mt-0.5 block">{new Date(override.updatedAt).toLocaleString()}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-end">
            <button type="button" className="btn-primary !py-2 text-sm" onClick={() => setShowOverrides(false)}>
              Close
            </button>
          </div>
        </SubscriptionsDialog>
      ) : null}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-indigo">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: CheckoutDisplayStatus }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <IconCheck size={12} />
        {CHECKOUT_STATUS_LABEL.completed}
      </span>
    );
  }
  if (status === "open") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-blue-500" />
        {CHECKOUT_STATUS_LABEL.open}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
      <IconX size={12} />
      {CHECKOUT_STATUS_LABEL.expired}
    </span>
  );
}
