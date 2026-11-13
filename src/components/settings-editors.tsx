"use client";

import { useState, type ReactNode } from "react";

type Editor = "details" | "email" | "country";

export function SettingsEditors({
  name,
  displayName,
  email,
  emailVerified,
  country,
  identityVerified,
  pendingCountry,
  saveDetails,
  saveCountry,
}: {
  name: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  country: string;
  identityVerified: boolean;
  pendingCountry: string | null;
  saveDetails: (formData: FormData) => Promise<void>;
  saveCountry: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState<Editor | null>(null);
  return (
    <>
      <SettingsRow
        title="Personal details"
        body={
          <>
            <p>{name || "Name not set"}</p>
            {displayName ? <p className="text-muted">{displayName}</p> : null}
          </>
        }
        onEdit={() => setOpen("details")}
      />
      <SettingsRow
        title="Contact email"
        body={
          <p className="flex flex-wrap items-center gap-2">
            <span>{email}</span>
            {emailVerified ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Verified</span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Not verified</span>
            )}
          </p>
        }
        onEdit={() => setOpen("email")}
      />
      <SettingsRow
        title="Country"
        body={
          <>
            <p>{country || "Not set"}</p>
            {pendingCountry ? (
              <p className="text-xs text-amber-800">Change to {pendingCountry} is awaiting review. The verified country stays in place.</p>
            ) : null}
          </>
        }
        onEdit={() => setOpen("country")}
      />
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            {open === "details" ? (
              <form action={saveDetails} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-xl font-bold text-indigo">Edit personal details</h2>
                  <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="text-lg leading-none text-muted">
                    ×
                  </button>
                </div>
                <label className="block text-sm font-semibold text-indigo">
                  Name
                  <input name="name" defaultValue={name} required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
                </label>
                <label className="block text-sm font-semibold text-indigo">
                  Display name
                  <input name="displayName" defaultValue={displayName} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setOpen(null)} className="btn-secondary !py-2 text-sm">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary !py-2 text-sm">
                    Save changes
                  </button>
                </div>
              </form>
            ) : null}
            {open === "email" ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-xl font-bold text-indigo">Contact email</h2>
                  <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="text-lg leading-none text-muted">
                    ×
                  </button>
                </div>
                <p className="text-sm text-indigo">{email}</p>
                <p className="text-sm text-muted">
                  {emailVerified
                    ? "This verified address is the login for the account. It is not replaced from this form."
                    : "Verify this address before brands rely on it. The login address is not replaced from this form."}
                </p>
                <div className="flex justify-end">
                  <button type="button" onClick={() => setOpen(null)} className="btn-primary !py-2 text-sm">
                    Close
                  </button>
                </div>
              </div>
            ) : null}
            {open === "country" ? (
              <form action={saveCountry} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-xl font-bold text-indigo">
                    {identityVerified ? "Request a country change" : "Edit country"}
                  </h2>
                  <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="text-lg leading-none text-muted">
                    ×
                  </button>
                </div>
                <p className="text-sm text-muted">
                  {identityVerified
                    ? "A verified country stays on the profile until Influrios reviews the change."
                    : "This country is saved on your profile. After verification, a later change goes to review."}
                </p>
                <label className="block text-sm font-semibold text-indigo">
                  Country
                  <input name="country" defaultValue={country} required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setOpen(null)} className="btn-secondary !py-2 text-sm">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary !py-2 text-sm">
                    {identityVerified ? "Submit for review" : "Save changes"}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function SettingsRow({
  title,
  body,
  onEdit,
}: {
  title: string;
  body: ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#EEF2F7] py-4">
      <div className="min-w-0 text-sm text-indigo">
        <p className="font-semibold">{title}</p>
        <div className="mt-1">{body}</div>
      </div>
      <button type="button" onClick={onEdit} className="rounded-full border border-[#E6ECF7] px-3 py-1.5 text-xs font-semibold text-violet">
        Edit
      </button>
    </div>
  );
}
