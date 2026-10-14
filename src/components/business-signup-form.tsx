"use client";

import Link from "next/link";
import { useState } from "react";
import { actionRegisterBusiness } from "@/app/business/signup-actions";
import { IconArrowRight } from "@/components/icons";
import { PlaceFields } from "@/components/place-fields";

export function BusinessSignupForm({
  title,
  subtitle,
  checkboxLabel,
  submitLabel,
  error,
}: {
  title: string;
  subtitle: string;
  checkboxLabel: string;
  submitLabel: string;
  error?: string;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <form
      action={actionRegisterBusiness}
      className="rounded-2xl border border-[#E4E9F5] bg-white p-6 shadow-sm"
    >
      <h2 className="font-display text-2xl font-bold text-indigo">{title}</h2>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      {error ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold text-indigo sm:col-span-2">
          Business Name
          <input
            name="businessName"
            required
            placeholder="Your brand or company"
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="block text-xs font-bold text-indigo sm:col-span-2">
          Business Email
          <input
            name="email"
            type="email"
            required
            placeholder="Used to sign in to this business account"
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="block text-xs font-bold text-indigo">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="block text-xs font-bold text-indigo">
          Confirm password
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
          />
          {mismatch ? <span className="mt-1 block text-[11px] font-semibold text-rose-600">Passwords do not match.</span> : null}
        </label>
        <PlaceFields
          className="sm:col-span-2 grid gap-3 sm:grid-cols-3"
          countryName="country"
          stateName="state"
          cityName="city"
          countryLabel="Country"
          stateLabel="State / region"
          cityLabel="City"
        />
        <label className="block text-xs font-bold text-indigo">
          Business Type
          <select
            name="businessType"
            defaultValue="Brand"
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
          >
            <option>Brand</option>
            <option>Agency</option>
            <option>Marketplace</option>
            <option>Other</option>
          </select>
        </label>
        <label className="block text-xs font-bold text-indigo">
          Website (optional)
          <input
            name="website"
            placeholder="https://"
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
          />
        </label>
      </div>

      <div className="mt-6 border-t border-[#E4E9F5] pt-5">
        <p className="text-sm font-bold text-indigo">Contact person</p>
        <p className="mt-1 text-xs text-muted">
          Saved on the company profile for reference only. Not used to sign in to this business account.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-indigo sm:col-span-2">
            Full name
            <input
              name="contactName"
              required
              placeholder="Who should we talk to?"
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="block text-xs font-bold text-indigo">
            Mobile
            <input
              name="contactPhone"
              type="tel"
              required
              placeholder="+1 555 000 0000"
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="block text-xs font-bold text-indigo">
            Email address
            <input
              name="contactEmail"
              type="email"
              required
              placeholder="contact@example.com"
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
            />
          </label>
        </div>
      </div>

      <label className="mt-4 flex items-start gap-2 text-sm text-muted">
        <input type="checkbox" name="consent" required className="mt-1 accent-[#633CFF]" />
        {checkboxLabel}
      </label>
      <button type="submit" className="btn-primary mt-5 flex w-full justify-center" disabled={mismatch}>
        {submitLabel} <IconArrowRight size={14} />
      </button>
      <p className="mt-3 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login?next=%2Fcollaboration%2Fbusiness&gate=business" className="font-semibold text-violet">
          Log in
        </Link>
      </p>
    </form>
  );
}
