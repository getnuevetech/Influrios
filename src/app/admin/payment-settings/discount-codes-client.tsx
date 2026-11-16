"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountDialog } from "@/components/account-dialog";
import { actionPauseDiscountCode, actionPreviewDiscountSample, actionSaveDiscountCode } from "@/app/admin/payment-settings/discount-actions";
import type { DiscountOffer, DiscountStatus } from "@/lib/discount-codes";

type AuditRow = { id: string; actorId: string; action: string; createdAt: string };

const CHARGE_LABEL = {
  subscription: "Subscription",
  business_collaboration_fee: "Business collaboration fee",
  influencer_collaboration_fee: "Influencer collaboration fee",
} as const;

const LAUNCH_APPLIES_TO = "First invoice only";

const STATUS_LABEL: Record<DiscountStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Active",
  paused: "Paused",
  expired: "Expired",
  exhausted: "Exhausted",
};

function money(cents: number, currency: string) {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : "USD";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

export function DiscountCodesClient({
  offers,
  plans,
  countries,
  canIssue,
  canViewRedemptions,
  audits,
  databaseError,
  serviceLevels,
}: {
  offers: DiscountOffer[];
  plans: { code: string; name: string; amountCents: number }[];
  countries: { code: string; name: string }[];
  canIssue: boolean;
  canViewRedemptions: boolean;
  audits: Record<string, AuditRow[]>;
  databaseError: string;
  serviceLevels: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DiscountStatus | "all">("all");
  const [open, setOpen] = useState<DiscountOffer | "new" | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  const now = new Date().toISOString();

  const rows = useMemo(() => {
    const needle = query.trim().toUpperCase();
    return offers.filter((offer) => {
      const label = STATUS_LABEL[offer.lifecycle === "draft" ? "draft" : offer.lifecycle === "paused" ? "paused" : offer.reservedCount + offer.redeemedCount >= offer.totalUses ? "exhausted" : now < offer.startsAt ? "scheduled" : now > offer.endsAt ? "expired" : "active"];
      if (status !== "all" && label.toLowerCase() !== status) return false;
      if (!needle) return true;
      return offer.normalizedCode.includes(needle) || CHARGE_LABEL[offer.productCharge].toUpperCase().includes(needle);
    });
  }, [offers, query, status, now]);

  function statusOf(offer: DiscountOffer): DiscountStatus {
    if (offer.lifecycle === "draft") return "draft";
    if (offer.lifecycle === "paused") return "paused";
    if (now < offer.startsAt) return "scheduled";
    if (now > offer.endsAt) return "expired";
    if (offer.reservedCount + offer.redeemedCount >= offer.totalUses) return "exhausted";
    return "active";
  }

  async function previewSample(form: FormData, baseCents: number) {
    form.set("baseCents", String(baseCents));
    const result = await actionPreviewDiscountSample(form);
    if (!result.ok) {
      setPreview(result.error);
      return;
    }
    const currency = String(form.get("currency") ?? "USD");
    const tax = result.taxCents == null ? "Tax is calculated on the discounted amount when the customer checks out." : `Tax ${money(result.taxCents, currency)}${result.taxReason ? ` · ${result.taxReason}` : ""}`;
    setPreview(`${money(baseCents, currency)} – ${money(result.discountCents, currency)} = ${money(result.netCents, currency)} before the tax result. ${tax}`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold text-indigo">Discount codes</h2>
        <p className="mt-1 text-sm text-muted">Create and manage discount codes for subscriptions and collaboration fees. A code changes one charge. It does not move money.</p>
      </div>
      {databaseError ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{databaseError}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        {canIssue ? (
          <button type="button" className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white" onClick={() => { setError(""); setPreview(""); setOpen("new"); }}>
            + Create code
          </button>
        ) : (
          <p className="text-sm text-muted">You can view codes. Issuing or pausing them is a separate permission.</p>
        )}
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search codes..." className="h-11 min-w-56 flex-1 rounded-full border border-border px-4 text-sm" />
        <label className="text-sm text-muted">
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as DiscountStatus | "all")} className="ml-2 h-11 rounded-full border border-border bg-white px-3">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="paused">Paused</option>
            <option value="expired">Expired</option>
            <option value="exhausted">Exhausted</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-3xl border border-[#E4E9F5] bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Product charge</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Uses</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-muted">No discount codes match this search.</td></tr>
            ) : rows.map((offer) => {
              const current = statusOf(offer);
              return (
                <tr key={offer.id} className="cursor-pointer border-t border-[#EEF2F7] hover:bg-[#F7F8FC]" onClick={() => { setError(""); setPreview(""); setOpen(offer); }}>
                  <td className="px-4 py-3 font-semibold text-indigo">{offer.displayCode}</td>
                  <td className="px-4 py-3">{CHARGE_LABEL[offer.productCharge]}</td>
                  <td className="px-4 py-3">{offer.kind === "percentage" ? `${(offer.percentBps ?? 0) / 100}%` : money(offer.fixedCents ?? 0, offer.currency)}</td>
                  <td className="px-4 py-3">{canViewRedemptions ? `${offer.redeemedCount} of ${offer.totalUses}` : "Hidden"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${current === "active" ? "bg-emerald-100 text-emerald-800" : current === "draft" ? "bg-[#EEF2F7] text-muted" : "bg-amber-100 text-amber-900"}`}>
                      {STATUS_LABEL[current]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open ? (
        <DiscountDialog
          offer={open === "new" ? null : open}
          plans={plans}
          countries={countries}
          serviceLevels={serviceLevels}
          canIssue={canIssue}
          canViewRedemptions={canViewRedemptions}
          audits={open === "new" ? [] : audits[open.id] ?? []}
          error={error}
          preview={preview}
          onClose={() => setOpen(null)}
          onPreview={previewSample}
          onSaved={() => { setOpen(null); router.refresh(); }}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

function DiscountDialog({
  offer,
  plans,
  countries,
  serviceLevels,
  canIssue,
  canViewRedemptions,
  audits,
  error,
  preview,
  onClose,
  onPreview,
  onSaved,
  onError,
}: {
  offer: DiscountOffer | null;
  plans: { code: string; name: string; amountCents: number }[];
  countries: { code: string; name: string }[];
  serviceLevels: { id: string; label: string }[];
  canIssue: boolean;
  canViewRedemptions: boolean;
  audits: AuditRow[];
  error: string;
  preview: string;
  onClose: () => void;
  onPreview: (form: FormData, baseCents: number) => Promise<void>;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [charge, setCharge] = useState(offer?.productCharge ?? "subscription");
  const [planCode, setPlanCode] = useState(offer?.planCode || plans[0]?.code || "");
  const [pending, setPending] = useState(false);
  const plan = plans.find((item) => item.code === planCode);

  async function submit(formData: FormData) {
    setPending(true);
    const planName = plans.find((item) => item.code === String(formData.get("planCode") ?? ""))?.name ?? "";
    formData.set("planName", planName);
    const saved = await actionSaveDiscountCode(formData);
    setPending(false);
    if (!saved.ok) {
      onError(saved.error);
      return;
    }
    onSaved();
  }

  return (
    <AccountDialog title={offer ? "Edit discount code" : "Create discount code"} onClose={onClose} wide>
      <form action={submit} className="grid gap-3 sm:grid-cols-2">
        {offer ? <input type="hidden" name="offerId" value={offer.id} /> : null}
        <label className="text-sm font-semibold text-indigo">Code
          <input name="code" required defaultValue={offer?.displayCode ?? ""} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-semibold text-indigo">Product charge
          <select name="productCharge" value={charge} onChange={(event) => setCharge(event.target.value as DiscountOffer["productCharge"])} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal">
            <option value="subscription">Subscription</option>
            <option value="business_collaboration_fee">Business collaboration fee</option>
            <option value="influencer_collaboration_fee">Influencer collaboration fee</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-indigo">Discount type
          <select name="kind" defaultValue={offer?.kind ?? "percentage"} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal">
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-indigo">Value
          <input name="value" required defaultValue={offer ? (offer.kind === "percentage" ? String((offer.percentBps ?? 0) / 100) : String((offer.fixedCents ?? 0) / 100)) : ""} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" />
        </label>
        {charge === "subscription" ? (
          <>
            <label className="text-sm font-semibold text-indigo">Eligible plan
              <select name="planCode" value={planCode} onChange={(event) => setPlanCode(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal">
                {plans.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-indigo">Billing interval
              <select name="billingInterval" defaultValue={offer?.billingInterval || "month"} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal">
                <option value="month">Monthly</option>
                <option value="year">Annual</option>
              </select>
            </label>
            <div className="text-sm font-semibold text-indigo sm:col-span-2">Applies to
              <p className="mt-1 rounded-xl bg-[#F6F7FB] px-3 py-2 font-normal">{LAUNCH_APPLIES_TO}</p>
            </div>
          </>
        ) : (
          <label className="text-sm font-semibold text-indigo sm:col-span-2">Eligible service level
            <select name="serviceLevel" defaultValue={offer?.serviceLevel || "contracted"} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal">
              {serviceLevels.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}
            </select>
          </label>
        )}
        <label className="text-sm font-semibold text-indigo">Country
          <select name="countryCode" defaultValue={offer?.countryCode || "US"} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal">
            {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-indigo">Currency
          <input name="currency" defaultValue={offer?.currency || "USD"} maxLength={3} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal uppercase" />
        </label>
        <label className="text-sm font-semibold text-indigo">Starts
          <input type="date" name="startsAt" required defaultValue={offer?.startsAt.slice(0, 10) ?? ""} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-semibold text-indigo">Ends
          <input type="date" name="endsAt" required defaultValue={offer?.endsAt.slice(0, 10) ?? ""} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-semibold text-indigo">Total uses
          <input name="totalUses" required defaultValue={offer?.totalUses ?? 100} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-semibold text-indigo">Uses per customer
          <input name="usesPerCustomer" required defaultValue={offer?.usesPerCustomer ?? 1} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" />
        </label>
        {preview ? <p className="rounded-2xl bg-[#F4F0FF] px-3 py-2 text-sm text-indigo sm:col-span-2">{preview}</p> : null}
        {error ? <p className="text-sm font-semibold text-amber-800 sm:col-span-2">{error}</p> : null}
        {canViewRedemptions && offer ? (
          <div className="sm:col-span-2 text-sm text-muted">
            <p>{offer.redeemedCount} redeemed · {offer.reservedCount} reserved · {offer.refundedCount} refunded. Pausing stops new reservations and keeps signed agreements.</p>
            {audits.length ? (
              <ul className="mt-2 space-y-1">
                {audits.map((audit) => <li key={audit.id}>{audit.createdAt.slice(0, 16)} · {audit.action} · {audit.actorId || "admin"}</li>)}
              </ul>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
          {canIssue && charge !== "subscription" ? (
            <button type="button" className="rounded-full border px-4 py-2 text-sm font-semibold" onClick={(event) => void onPreview(new FormData(event.currentTarget.form!), 0)}>
              Preview rate
            </button>
          ) : null}
          {canIssue && charge === "subscription" && plan ? (
            <button type="button" className="rounded-full border px-4 py-2 text-sm font-semibold" onClick={(event) => void onPreview(new FormData(event.currentTarget.form!), plan.amountCents)}>
              Preview
            </button>
          ) : null}
          {canIssue && offer && offer.lifecycle === "active" ? (
            <button
              type="button"
              className="rounded-full border px-4 py-2 text-sm font-semibold"
              onClick={() => {
                const data = new FormData();
                data.set("offerId", offer.id);
                void actionPauseDiscountCode(data).then((result) => {
                  if (!result.ok) onError(result.error);
                  else onSaved();
                });
              }}
            >
              Pause
            </button>
          ) : null}
          {canIssue ? (
            <>
              <button type="submit" name="intent" value="draft" disabled={pending} className="rounded-full border px-4 py-2 text-sm font-semibold">Save draft</button>
              <button type="submit" name="intent" value="activate" disabled={pending} className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white">Activate code</button>
            </>
          ) : null}
        </div>
      </form>
    </AccountDialog>
  );
}
