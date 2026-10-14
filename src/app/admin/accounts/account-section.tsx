import Link from "next/link";
import type { ReactNode } from "react";
import {
  actionSaveAccountPolicy,
  actionSaveMember,
  actionSendPasswordReset,
} from "@/app/admin/accounts/actions";
import { DEFAULT_SITE_CONFIG } from "@/lib/site-config";

export type AdminAccountRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  planTier: string;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  suspendedAt: Date | null;
  createdAt: Date;
  consentVersion: string | null;
  locationLabel: string;
  /** Influencer handle or business company name */
  secondaryLabel: string | null;
};

function flash(params: { saved?: string; error?: string; reset?: string }) {
  return (
    <>
      {params.saved === "policy" ? <p className="mt-4 text-sm font-semibold text-emerald-700">Account policy saved.</p> : null}
      {params.saved === "member" ? <p className="mt-4 text-sm font-semibold text-emerald-700">Account updated.</p> : null}
      {params.reset === "sent" ? (
        <p className="mt-4 text-sm font-semibold text-emerald-700">Password reset email queued for that member.</p>
      ) : null}
      {params.reset === "failed" ? (
        <p className="mt-4 text-sm font-semibold text-amber-800">
          Password reset could not be sent. Check SMTP and that the account has an email address.
        </p>
      ) : null}
      {params.error ? <p className="mt-4 text-sm font-semibold text-amber-800">That change could not be saved.</p> : null}
    </>
  );
}

export function AccountPolicyForm({
  canEdit,
  consentVersion,
  consentCopy,
  passwordMinLength,
  section,
}: {
  canEdit: boolean;
  consentVersion: string;
  consentCopy: string;
  passwordMinLength: number;
  section: "influencer" | "business";
}) {
  return (
    <form action={actionSaveAccountPolicy} className="mt-6 space-y-3 rounded-2xl border border-[#E4EBFF] bg-white p-5">
      <input type="hidden" name="section" value={section} />
      <h2 className="font-display text-lg font-bold text-indigo">Registration policy</h2>
      <p className="text-sm text-muted">
        Shared for influencer and business sign-ups. New accounts record this consent version. Existing consents stay on
        the version they accepted.
      </p>
      <label className="block text-sm font-semibold text-indigo">
        Consent version
        <input
          name="consentVersion"
          defaultValue={consentVersion || DEFAULT_SITE_CONFIG.consentVersion}
          disabled={!canEdit}
          className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
        />
      </label>
      <label className="block text-sm font-semibold text-indigo">
        Consent text
        <textarea
          name="consentCopy"
          defaultValue={consentCopy || DEFAULT_SITE_CONFIG.consentCopy}
          disabled={!canEdit}
          rows={3}
          className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
        />
      </label>
      <label className="block text-sm font-semibold text-indigo">
        Minimum password length
        <input
          name="passwordMinLength"
          type="number"
          min={8}
          max={64}
          defaultValue={passwordMinLength}
          disabled={!canEdit}
          className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
        />
      </label>
      {canEdit ? (
        <button type="submit" className="btn-primary">
          Save policy
        </button>
      ) : null}
    </form>
  );
}

export function AdminAccountSection({
  kind,
  title,
  blurb,
  otherHref,
  otherLabel,
  users,
  roleOptions,
  planOptions,
  canEdit,
  params,
  policy,
}: {
  kind: "influencer" | "business";
  title: string;
  blurb: ReactNode;
  otherHref: string;
  otherLabel: string;
  users: AdminAccountRow[];
  roleOptions: string[];
  planOptions: string[];
  canEdit: boolean;
  params: { saved?: string; error?: string; reset?: string };
  policy: { consentVersion: string; consentCopy: string; passwordMinLength: number };
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-indigo">{title}</h1>
        <Link href={otherHref} className="text-sm font-semibold text-violet hover:underline">
          {otherLabel} →
        </Link>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-muted">{blurb}</p>
      {flash(params)}

      <AccountPolicyForm
        canEdit={canEdit}
        consentVersion={policy.consentVersion}
        consentCopy={policy.consentCopy}
        passwordMinLength={policy.passwordMinLength}
        section={kind}
      />

      <h2 className="mt-10 font-display text-lg font-bold text-indigo">
        {kind === "influencer" ? "Influencer accounts" : "Business accounts"}
        <span className="ml-2 text-sm font-semibold text-muted">({users.length})</span>
      </h2>
      {users.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No {kind === "influencer" ? "influencer" : "business"} accounts yet, or the database is unavailable.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {users.map((user) => {
            const verified = Boolean(user.emailVerifiedAt);
            return (
              <div key={user.id} className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
                <form action={actionSaveMember}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="section" value={kind} />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-indigo">
                        {kind === "business"
                          ? user.secondaryLabel || user.name || "Unnamed business"
                          : user.name || user.secondaryLabel || "Unnamed"}
                      </p>
                      <p className="text-sm text-muted">{user.email}</p>
                      <p className="mt-1 text-xs text-muted">
                        Joined {user.createdAt.toISOString().slice(0, 10)} · consent {user.consentVersion || "none"}
                        {kind === "influencer" && user.secondaryLabel ? ` · ${user.secondaryLabel}` : ""}
                        {kind === "business" && user.name ? ` · contact ${user.name}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted">Location: {user.locationLabel}</p>
                      <p className="mt-1 text-xs text-muted">Password: {user.passwordHash ? "Set" : "Not set yet"}</p>
                    </div>
                    {canEdit ? (
                      <button
                        type="submit"
                        className="rounded-xl border border-[#E4EBFF] px-3 py-2 text-sm font-semibold text-indigo"
                      >
                        Save
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
                      Role
                      <select
                        name="role"
                        defaultValue={user.role}
                        disabled={!canEdit}
                        className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo"
                      >
                        {[...new Set([user.role, ...roleOptions])].map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
                      Plan
                      <select
                        name="planTier"
                        defaultValue={user.planTier}
                        disabled={!canEdit}
                        className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo"
                      >
                        {[...new Set([user.planTier, ...planOptions])].map((plan) => (
                          <option key={plan} value={plan}>
                            {plan}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="self-end pb-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Email status</p>
                      <p className={`mt-1 text-sm font-semibold ${verified ? "text-emerald-700" : "text-amber-800"}`}>
                        {verified ? `Verified ${user.emailVerifiedAt?.toISOString().slice(0, 10)}` : "Not verified"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">Set by the member verification code. Not editable here.</p>
                    </div>
                    <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-indigo">
                      <input
                        type="checkbox"
                        name="suspended"
                        value="1"
                        defaultChecked={Boolean(user.suspendedAt)}
                        disabled={!canEdit}
                      />
                      Suspended
                    </label>
                  </div>
                </form>
                {canEdit ? (
                  <form action={actionSendPasswordReset} className="mt-3 border-t border-[#EEF2FF] pt-3">
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="section" value={kind} />
                    <button
                      type="submit"
                      className="rounded-xl bg-[#F1ECFF] px-3 py-2 text-sm font-semibold text-violet hover:bg-[#E8E0FF]"
                    >
                      Email password reset link
                    </button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
