"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { actionCountryRegions, actionPreviewSubscriptionTax, actionStartCheckout } from "@/app/billing/actions";
import { AccountDialog } from "@/components/account-dialog";
import { TAX_COPY, customerCheckoutNotice, regionRequired } from "@/lib/tax-configuration";

type Preview = {
  ok: boolean;
  kind: string;
  message: string;
  taxCents: number | null;
  totalCents: number | null;
  subtotalCents: number | null;
  reason: string;
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function PlanCheckout({
  plan,
  audience,
  returnTo,
  label,
  emphasized,
  countries,
}: {
  plan: { code: string; sku: string; name: string; priceLabel: string; amountCents: number };
  audience: "creator" | "business";
  returnTo: string;
  label: string;
  emphasized: boolean;
  countries: { code: string; name: string }[];
}) {
  const lineRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState(countries.find((item) => item.code === "US")?.code ?? countries[0]?.code ?? "US");
  const [region, setRegion] = useState("");
  const [regions, setRegions] = useState<{ code: string; name: string }[]>([]);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState(false);
  const buttonClass = emphasized ? "btn-primary mt-2 w-full !py-2.5 text-sm" : "btn-secondary mt-2 w-full !py-2.5 text-sm";

  async function loadRegions(nextCountry: string) {
    setCountry(nextCountry);
    setRegion("");
    const rows = await actionCountryRegions(nextCountry).catch(() => []);
    setRegions(rows);
  }

  async function runPreview() {
    setPending(true);
    const data = new FormData();
    data.set("sku", plan.sku);
    data.set("country", country);
    data.set("region", region);
    data.set("line1", line1);
    data.set("city", city);
    data.set("postalCode", postalCode);
    const result = await actionPreviewSubscriptionTax(data);
    setPreview(result);
    setPending(false);
  }

  const notice = customerCheckoutNotice(preview);

  return (
    <div className="mt-6">
      <p className="text-xs font-semibold text-muted">Tax calculated at checkout</p>
      <button
        type="button"
        className={buttonClass}
        onClick={() => {
          setOpen(true);
          if (regions.length === 0) void loadRegions(country);
        }}
      >
        {label}
      </button>
      {open ? (
        <AccountDialog title="Confirm your plan" subtitle={`${plan.name} · ${plan.priceLabel || money(plan.amountCents)}/month`} onClose={() => setOpen(false)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-1">Country
              <select value={country} onChange={(event) => void loadRegions(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
                {countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              </select>
            </label>
            {regionRequired(country) ? (
              <label className="text-sm">State
                <select value={region} onChange={(event) => setRegion(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
                  <option value="">Select state</option>
                  {regions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                </select>
              </label>
            ) : <span />}
            <label className="text-sm sm:col-span-2">Address line 1
              <input ref={lineRef} value={line1} onChange={(event) => setLine1(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="Street address" />
            </label>
            <label className="text-sm sm:col-span-2">Address line 2 (optional)
              <input value={line2} onChange={(event) => setLine2(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="Apartment, suite, etc." />
            </label>
            <label className="text-sm">City
              <input value={city} onChange={(event) => setCity(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
            </label>
            <label className="text-sm">Postal code
              <input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
            </label>
          </div>
          {notice === "address" ? (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              Address needed — {TAX_COPY.address}{" "}
              <button type="button" className="font-semibold underline" onClick={() => lineRef.current?.focus()}>Add address</button>
            </p>
          ) : null}
          {notice === "provider" ? (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {TAX_COPY.provider}{" "}
              <button type="button" className="font-semibold underline" onClick={() => void runPreview()}>Retry</button>
            </p>
          ) : null}
          {notice === "unavailable" ? (
            <p className="mt-4 text-sm text-amber-900">{TAX_COPY.unavailable}</p>
          ) : null}
          {notice === "free" ? (
            <p className="mt-4 text-sm text-muted">This plan has no charge.</p>
          ) : null}
          {notice === "zero" || notice === "calculated" ? (
            <dl className="mt-4 space-y-1 rounded-2xl bg-[#F6F7FB] px-4 py-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(preview?.subtotalCents ?? 0)}</dd></div>
              <div className="flex justify-between"><dt>Tax</dt><dd>{money(preview?.taxCents ?? 0)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{money(preview?.totalCents ?? 0)}</dd></div>
              {notice === "zero" ? <p className="pt-1 text-xs text-muted">{preview?.reason}</p> : null}
            </dl>
          ) : null}
          {notice === "pending" ? (
            <p className="mt-4 text-xs text-muted">{TAX_COPY.atCheckout}. Nothing is charged until the payment provider confirms it.</p>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className="rounded-full border px-4 py-2 text-sm font-semibold" onClick={() => setOpen(false)}>Back</button>
            {notice === "calculated" || notice === "zero" ? (
              <form action={actionStartCheckout}>
                <input type="hidden" name="sku" value={plan.sku} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="country" value={country} />
                <input type="hidden" name="region" value={region} />
                <input type="hidden" name="line1" value={line1} />
                <input type="hidden" name="city" value={city} />
                <input type="hidden" name="postalCode" value={postalCode} />
                <label className="mb-3 flex items-start gap-2 text-xs text-indigo">
                  <input type="checkbox" name="acceptSubscription" required className="mt-0.5 accent-violet" />
                  <span>I agree to the <Link href="/legal/subscription-terms" className="font-semibold underline" target="_blank">subscription terms</Link>. {plan.priceLabel || "This plan"} renews until cancelled.</span>
                </label>
                <button type="submit" className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white">Continue to payment</button>
              </form>
            ) : (
              <button type="button" disabled={pending} onClick={() => void runPreview()} className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white">
                {pending ? "Calculating" : "Continue to tax preview"}
              </button>
            )}
          </div>
          <p className="mt-3 text-[11px] text-muted">{audience === "business" ? "Collaboration funding is not part of this subscription." : "Payouts are not part of this subscription."}</p>
        </AccountDialog>
      ) : null}
    </div>
  );
}
