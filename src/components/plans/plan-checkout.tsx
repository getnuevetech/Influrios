"use client";
/** @jsxRuntime automatic */
/** @jsxImportSource react */

import { useState } from "react";
import Link from "next/link";
import {
  actionChangeSubscriptionPrice,
  actionCountryRegions,
  actionPreviewSubscriptionTax,
  actionPreviewTierChange,
  actionScheduleIntervalChange,
  actionStartCheckout,
} from "@/app/billing/actions";
import { AccountDialog } from "@/components/account-dialog";
import { CHECKOUT_TAX_NOTE, displayedPriceBreakdown, formatOfferAmount, type BillingInterval } from "@/lib/billing-interval";
import { TAX_COPY, customerCheckoutNotice, regionRequired } from "@/lib/tax-configuration";

type Recovery = { typedCode: string; message: string; offerReviewAnnual: boolean; offerContinueMonthly: boolean } | null;

type Preview = {
  ok: boolean;
  kind: string;
  message: string;
  taxCents: number | null;
  totalCents: number | null;
  subtotalCents: number | null;
  ratePercent?: number | null;
  reason: string;
  typedDiscount?: string;
  discountCents?: number | null;
  discountReason?: string;
  renewalOn?: string;
  renewalPriceCents?: number | null;
  recovery?: Recovery;
};

function money(cents: number) {
  return formatOfferAmount(cents);
}

export function PlanCheckout({
  plan,
  audience,
  returnTo,
  label,
  emphasized,
  countries,
  interval = "month",
  mode = "checkout",
  annualAmountCents = null,
  renewalLabel = null,
  intervalTaxCents = null,
}: {
  plan: { code: string; sku: string; name: string; priceLabel: string; amountCents: number };
  audience: "creator" | "business";
  returnTo: string;
  label: string;
  emphasized: boolean;
  countries: { code: string; name: string }[];
  interval?: BillingInterval;
  mode?: "checkout" | "schedule" | "tier";
  annualAmountCents?: number | null;
  renewalLabel?: string | null;
  intervalTaxCents?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(interval);
  const [termsEpoch, setTermsEpoch] = useState(0);
  const [country, setCountry] = useState(countries.find((item) => item.code === "US")?.code ?? countries[0]?.code ?? "US");
  const [region, setRegion] = useState("");
  const [regions, setRegions] = useState<{ code: string; name: string }[]>([]);
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState(false);
  const [discountTyped, setDiscountTyped] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [recovery, setRecovery] = useState<Recovery>(null);
  const [tierDue, setTierDue] = useState<number | null>(null);
  const [tierMessage, setTierMessage] = useState("");
  const buttonClass = emphasized ? "btn-primary mt-6 w-full !py-2.5 text-sm" : "btn-secondary mt-6 w-full !py-2.5 text-sm";
  const chargeCents = billingInterval === "year" && annualAmountCents != null ? annualAmountCents : plan.amountCents;

  function bumpTerms() {
    setTermsEpoch((value) => value + 1);
  }

  async function loadRegions(nextCountry: string) {
    setCountry(nextCountry);
    setRegion("");
    const rows = await actionCountryRegions(nextCountry).catch(() => []);
    setRegions(rows);
  }

  async function runPreview(nextInterval = billingInterval, code = discountCode || discountTyped) {
    setPending(true);
    const data = new FormData();
    data.set("sku", plan.sku);
    data.set("interval", nextInterval);
    data.set("country", country);
    data.set("region", region);
    data.set("line1", line1);
    data.set("city", city);
    data.set("postalCode", postalCode);
    data.set("discountCode", code);
    const result = await actionPreviewSubscriptionTax(data);
    setPreview(result);
    const nextRecovery = "recovery" in result ? result.recovery ?? null : null;
    setRecovery(nextRecovery);
    const discountReason = "discountReason" in result ? result.discountReason : "";
    const applied = "discountCents" in result ? result.discountCents : null;
    if (nextRecovery?.typedCode) setDiscountTyped(nextRecovery.typedCode);
    if (!discountReason && !nextRecovery && applied != null && code.trim()) {
      setDiscountCode(code.trim());
    }
    if (discountReason) setDiscountCode("");
    bumpTerms();
    setPending(false);
  }

  async function reviewAnnual() {
    const code = recovery?.typedCode || discountTyped;
    setDiscountTyped(code);
    setDiscountCode(code);
    setBillingInterval("year");
    setRecovery(null);
    setPreview(null);
    bumpTerms();
    await runPreview("year", code);
  }

  function continueMonthly() {
    setDiscountTyped("");
    setDiscountCode("");
    setRecovery(null);
    setBillingInterval("month");
    setPreview(null);
    bumpTerms();
  }

  async function openTier() {
    setOpen(true);
    setPending(true);
    const data = new FormData();
    data.set("sku", plan.sku);
    data.set("interval", billingInterval);
    const result = await actionPreviewTierChange(data);
    setTierDue(result.ok ? result.amountDueCents : null);
    setTierMessage(result.ok ? "" : result.message);
    setPending(false);
  }

  const notice = customerCheckoutNotice(preview);
  const lines = preview && preview.taxCents != null && preview.subtotalCents != null
    ? displayedPriceBreakdown({
        locationKnown: true,
        baseCents: preview.subtotalCents,
        taxCents: preview.taxCents,
        ratePercent: preview.ratePercent,
        inclusive: false,
      })
    : null;
  const showBreakdown = lines && (lines.kind === "exclusive" || lines.kind === "inclusive");

  if (mode === "schedule") {
    return (
      <div className="mt-6">
        <button type="button" className={buttonClass} onClick={() => setOpen(true)}>{label}</button>
        {open ? (
          <AccountDialog title={`Switch ${plan.name} to annual`} subtitle="The current subscription stays in place until the next renewal." onClose={() => setOpen(false)}>
            <dl className="space-y-2 rounded-2xl bg-[#F6F7FB] px-4 py-3 text-sm">
              <div className="flex justify-between"><dt>Due today</dt><dd className="font-semibold">$0</dd></div>
              <div className="flex justify-between"><dt>Starts</dt><dd>{renewalLabel ?? "the end of the current paid period"}</dd></div>
              {intervalTaxCents != null ? (
                <div className="flex justify-between"><dt>Tax</dt><dd>{money(intervalTaxCents)}</dd></div>
              ) : null}
              <div className="flex justify-between">
                <dt>First annual charge</dt>
                <dd>{annualAmountCents != null ? money(intervalTaxCents != null ? annualAmountCents + intervalTaxCents : annualAmountCents) : "The saved annual price"}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">
              {intervalTaxCents == null ? `${CHECKOUT_TAX_NOTE} ` : ""}
              Nothing is charged today. Browsing annual does not change the subscription.
            </p>
            <form action={actionScheduleIntervalChange} className="mt-4">
              <input type="hidden" name="sku" value={plan.sku} />
              <input type="hidden" name="interval" value="year" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label key={termsEpoch} className="mb-3 flex items-start gap-2 text-xs text-indigo">
                <input type="checkbox" name="acceptSubscription" required className="mt-0.5 accent-violet" />
                <span>I agree to switch {plan.name} to annual at the next renewal. Nothing is charged today.</span>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-full border px-4 py-2 text-sm font-semibold" onClick={() => setOpen(false)}>Back</button>
                <button type="submit" className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white">Confirm switch</button>
              </div>
            </form>
          </AccountDialog>
        ) : null}
      </div>
    );
  }

  if (mode === "tier") {
    return (
      <div className="mt-6">
        <button type="button" className={buttonClass} onClick={() => void openTier()}>{label}</button>
        {open ? (
          <AccountDialog title={`Review ${plan.name}`} subtitle="This updates the current subscription. It does not start a second one." onClose={() => setOpen(false)}>
            {tierMessage ? <p className="text-sm text-amber-900">{tierMessage}</p> : null}
            {tierDue != null ? (
              <dl className="space-y-2 rounded-2xl bg-[#F6F7FB] px-4 py-3 text-sm">
                <div className="flex justify-between"><dt>Amount due from Stripe</dt><dd className="font-semibold">{money(tierDue)}</dd></div>
              </dl>
            ) : null}
            <p className="mt-3 text-xs text-muted">The plan changes when Stripe confirms the update. Nothing is marked paid here.</p>
            {tierDue != null ? (
              <form action={actionChangeSubscriptionPrice} className="mt-4">
                <input type="hidden" name="sku" value={plan.sku} />
                <input type="hidden" name="interval" value={billingInterval} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <label key={termsEpoch} className="mb-3 flex items-start gap-2 text-xs text-indigo">
                  <input type="checkbox" name="acceptSubscription" required className="mt-0.5 accent-violet" />
                  <span>I agree to this subscription change.</span>
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" className="rounded-full border px-4 py-2 text-sm font-semibold" onClick={() => setOpen(false)}>Back</button>
                  <button type="submit" className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white">Confirm change</button>
                </div>
              </form>
            ) : (
              <button type="button" className="mt-4 rounded-full border px-4 py-2 text-sm font-semibold" onClick={() => setOpen(false)}>Back</button>
            )}
          </AccountDialog>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-6">
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
        <AccountDialog
          title="Confirm your plan"
          subtitle={`${plan.name} · ${billingInterval === "year" ? "Annual" : "Monthly"} · ${money(chargeCents)}${billingInterval === "year" ? "/year" : "/month"}`}
          onClose={() => setOpen(false)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Country
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
              <input value={line1} onChange={(event) => setLine1(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="Street address" />
            </label>
            <label className="text-sm">City
              <input value={city} onChange={(event) => setCity(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
            </label>
            <label className="text-sm">Postal code
              <input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
            </label>
          </div>
          <div className="mt-4">
            {discountCode && !recovery ? (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span>Code</span>
                <span className="rounded-full bg-[#F4F0FF] px-2 py-1 font-semibold text-violet">{discountCode}</span>
                <button type="button" className="font-semibold text-violet" onClick={() => { setDiscountCode(""); setDiscountTyped(""); setPreview(null); bumpTerms(); }}>Remove</button>
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input value={discountTyped} onChange={(event) => setDiscountTyped(event.target.value)} className="h-11 min-w-40 flex-1 rounded-xl border px-3 text-sm" aria-label="Discount code" />
                <button type="button" disabled={pending} onClick={() => void runPreview(billingInterval, discountTyped)} className="h-11 rounded-full bg-violet px-4 text-sm font-semibold text-white">{pending ? "Checking" : "Apply"}</button>
              </div>
            )}
            {recovery ? <p className="mt-2 text-sm font-semibold text-violet">{recovery.message}</p> : null}
            {!recovery && preview?.discountReason ? <p className="mt-2 text-sm font-semibold text-amber-800">{preview.discountReason}</p> : null}
            {recovery?.offerReviewAnnual || recovery?.offerContinueMonthly ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {recovery.offerReviewAnnual ? (
                  <button type="button" className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white" onClick={() => void reviewAnnual()}>
                    Review {plan.name} annual
                  </button>
                ) : null}
                {recovery.offerContinueMonthly ? (
                  <button type="button" className="rounded-full border px-4 py-2 text-sm font-semibold" onClick={continueMonthly}>
                    Continue monthly without code
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {notice === "address" ? <p className="mt-4 text-sm text-red-800">{TAX_COPY.address}</p> : null}
          {notice === "provider" ? (
            <p className="mt-4 text-sm text-amber-950">{TAX_COPY.provider} <button type="button" className="font-semibold underline" onClick={() => void runPreview()}>Retry</button></p>
          ) : null}
          {notice === "unavailable" ? <p className="mt-4 text-sm text-amber-900">{TAX_COPY.unavailable}</p> : null}
          {showBreakdown && lines && !recovery ? (
            <dl className="mt-4 space-y-1 rounded-2xl bg-[#F6F7FB] px-4 py-3 text-sm">
              <div className="flex justify-between"><dt>{billingInterval === "year" ? "Annual price" : "Subtotal"}</dt><dd>{money(discountCode && preview?.discountCents ? chargeCents : lines.baseCents)}</dd></div>
              {preview?.discountCents ? <div className="flex justify-between text-emerald-700"><dt>Code {discountCode}</dt><dd>−{money(preview.discountCents)}</dd></div> : null}
              <div className="flex justify-between"><dt>Tax{lines.ratePercent != null ? ` (${lines.ratePercent}%)` : ""}</dt><dd>{money(lines.taxCents)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Amount due</dt><dd>{money(lines.totalCents)}</dd></div>
              {billingInterval === "year" ? (
                <p className="pt-1 text-xs text-muted">
                  {preview?.renewalOn && preview.renewalPriceCents != null
                    ? `Renews ${preview.renewalOn} at ${money(preview.renewalPriceCents)}/year plus applicable tax.`
                    : `${money(chargeCents)}/year plus applicable tax after the first invoice.`}
                </p>
              ) : preview?.renewalOn && preview.renewalPriceCents != null ? (
                <p className="pt-1 text-xs text-muted">Renews {preview.renewalOn} at {money(preview.renewalPriceCents)}/month.</p>
              ) : null}
            </dl>
          ) : notice === "pending" && intervalTaxCents != null ? (
            <dl className="mt-4 space-y-1 rounded-2xl bg-[#F6F7FB] px-4 py-3 text-sm">
              <div className="flex justify-between"><dt>{billingInterval === "year" ? "Annual price" : "Subtotal"}</dt><dd>{money(chargeCents)}</dd></div>
              <div className="flex justify-between"><dt>Tax</dt><dd>{money(intervalTaxCents)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Amount due</dt><dd>{money(chargeCents + intervalTaxCents)}</dd></div>
              <p className="pt-1 text-xs text-muted">Nothing is charged until the payment provider confirms it.</p>
            </dl>
          ) : notice === "pending" ? (
            <p className="mt-4 text-xs text-muted">{CHECKOUT_TAX_NOTE} Nothing is charged until the payment provider confirms it.</p>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className="rounded-full border px-4 py-2 text-sm font-semibold" onClick={() => setOpen(false)}>Back</button>
            {(notice === "calculated" || notice === "zero") && !recovery ? (
              <form action={actionStartCheckout}>
                <input type="hidden" name="sku" value={plan.sku} />
                <input type="hidden" name="interval" value={billingInterval} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="country" value={country} />
                <input type="hidden" name="region" value={region} />
                <input type="hidden" name="line1" value={line1} />
                <input type="hidden" name="city" value={city} />
                <input type="hidden" name="postalCode" value={postalCode} />
                {discountCode ? <input type="hidden" name="discountCode" value={discountCode} /> : null}
                <label key={termsEpoch} className="mb-3 flex items-start gap-2 text-xs text-indigo">
                  <input type="checkbox" name="acceptSubscription" required className="mt-0.5 accent-violet" />
                  <span>I agree to the <Link href="/legal/subscription-terms" className="font-semibold underline" target="_blank">subscription terms</Link>. {plan.name} {billingInterval === "year" ? "bills annually" : "renews monthly"} until cancelled.</span>
                </label>
                <button type="submit" className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white">Continue to payment</button>
              </form>
            ) : (
              <button type="button" disabled={pending || Boolean(recovery)} onClick={() => void runPreview()} className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white">
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
