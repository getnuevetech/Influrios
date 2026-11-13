import Link from "next/link";
import { actionReplacePassword, actionSaveCountry, actionSavePersonalDetails, actionSaveCommPreference, actionSaveEmailPreference } from "@/app/account/actions";
import { SettingsEditors } from "@/components/settings-editors";
import type { AccountAudience } from "@/lib/account-audience";
import { planLabel } from "@/lib/entitlements";

const CREATOR_TABS = ["account", "security", "notifications", "verification", "connections", "billing"] as const;
const BUSINESS_TABS = ["account", "security", "notifications", "billing"] as const;

const TAB_LABEL: Record<string, string> = {
  account: "Account",
  security: "Security",
  notifications: "Notifications",
  verification: "Verification",
  connections: "Connections",
  billing: "Billing & Plan",
};

export function AccountSettings({
  audience,
  tab,
  saved,
  error,
  countryReview,
  name,
  displayName,
  email,
  emailVerified,
  hasPassword,
  phone,
  country,
  identityVerified,
  pendingCountry,
  planCode,
  emailPrefs,
}: {
  audience: AccountAudience;
  tab: string;
  saved?: string;
  error?: string;
  countryReview?: string;
  name: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  phone: string;
  country: string;
  identityVerified: boolean;
  pendingCountry: string | null;
  planCode: string;
  emailPrefs: { collaborations: boolean; billing: boolean; outreach: boolean; productNews: boolean };
}) {
  const tabs: string[] = audience === "business" ? [...BUSINESS_TABS] : [...CREATOR_TABS];
  const current = tabs.includes(tab) ? tab : "account";
  const billingHref = audience === "business" ? "/business/billing" : "/billing";
  const plan = planLabel(planCode) || planCode || "Starter";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold text-indigo">Account settings</h1>
      <p className="mt-1 text-sm text-muted">Manage your account and preferences.</p>
      {saved ? <p className="mt-3 text-sm font-semibold text-emerald-700">Saved.</p> : null}
      {error ? <p className="mt-3 text-sm font-semibold text-amber-800">{error}</p> : null}
      {countryReview ? (
        <p className="mt-3 text-sm font-semibold text-amber-800">
          Country change submitted for review. The verified country on the profile was not changed.
        </p>
      ) : null}
      <nav className="mt-6 flex gap-5 overflow-x-auto border-b border-[#E6ECF7]" aria-label="Settings">
        {tabs.map((item) => (
          <Link
            key={item}
            href={`/account?tab=${item}`}
            className={`relative whitespace-nowrap pb-3 text-sm font-semibold ${
              current === item ? "text-violet" : "text-muted hover:text-indigo"
            }`}
          >
            {TAB_LABEL[item]}
            {current === item ? <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-violet" /> : null}
          </Link>
        ))}
      </nav>

      {current === "account" ? (
        <section className="mt-2">
          {audience === "creator" ? (
            <SettingsEditors
              name={name}
              displayName={displayName}
              email={email}
              emailVerified={emailVerified}
              country={country}
              identityVerified={identityVerified}
              pendingCountry={pendingCountry}
              saveDetails={actionSavePersonalDetails}
              saveCountry={actionSaveCountry}
            />
          ) : (
            <div className="space-y-3 py-4 text-sm text-indigo">
              <p className="font-semibold">{name || email}</p>
              <p>{email}</p>
            </div>
          )}
          {audience === "creator" ? (
            <p className="pt-4 text-sm text-muted">
              Public profile details are managed in <Link href="/dashboard" className="font-semibold text-violet">My profile</Link>.
            </p>
          ) : null}
        </section>
      ) : null}

      {current === "security" ? (
        <section className="mt-6 space-y-4">
          <p className="text-sm text-muted">
            {hasPassword ? "Password is set." : "Choose a password so you can log in again."}
          </p>
          <form action={actionReplacePassword} className="max-w-md space-y-3">
            {hasPassword ? (
              <label className="block text-sm font-semibold text-indigo">
                Current password
                <input name="current" type="password" required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
              </label>
            ) : null}
            <label className="block text-sm font-semibold text-indigo">
              New password
              <input name="password" type="password" required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
            </label>
            <label className="block text-sm font-semibold text-indigo">
              Confirm password
              <input name="confirm" type="password" required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
            </label>
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save password
            </button>
          </form>
          <p className="text-sm">
            <Link href="/account/reset" className="font-semibold text-violet">
              Forgot password
            </Link>
          </p>
        </section>
      ) : null}

      {current === "notifications" ? (
        <section className="mt-6 space-y-4">
          <form action={actionSaveEmailPreference} className="space-y-3 rounded-2xl border border-[#E6ECF7] bg-white p-5 text-sm">
            <h2 className="font-display text-lg font-bold text-indigo">Email</h2>
            <p className="text-muted">Security mail, including verification codes and password resets, stays on.</p>
            <label className="flex items-center gap-2 font-semibold text-indigo">
              <input name="collaborations" type="checkbox" defaultChecked={emailPrefs.collaborations} />
              Collaboration, invitation, and payout updates
            </label>
            <label className="flex items-center gap-2 font-semibold text-indigo">
              <input name="billing" type="checkbox" defaultChecked={emailPrefs.billing} />
              Subscription receipts and payment problems
            </label>
            <label className="flex items-center gap-2 font-semibold text-indigo">
              <input name="outreach" type="checkbox" defaultChecked={emailPrefs.outreach} />
              Claim invitations and follow-ups
            </label>
            <label className="flex items-center gap-2 font-semibold text-indigo">
              <input name="productNews" type="checkbox" defaultChecked={emailPrefs.productNews} />
              Product news
            </label>
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save email preferences
            </button>
          </form>
          <form action={actionSaveCommPreference} className="space-y-3 rounded-2xl border border-[#E6ECF7] bg-white p-5 text-sm">
            <h2 className="font-display text-lg font-bold text-indigo">Communication preference</h2>
            <p className="text-muted">Influrios reaches this account by email.</p>
            <label className="block font-semibold text-indigo">
              Phone
              <input name="phone" defaultValue={phone} placeholder="+15555550100" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
            </label>
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save preference
            </button>
          </form>
          {audience === "creator" ? (
            <p className="text-sm">
              <Link href="/creator/notifications" className="font-semibold text-violet">
                Open notification centre
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      {current === "verification" ? (
        <section className="mt-6 space-y-3 text-sm text-indigo">
          <p>{identityVerified ? "Identity is verified." : "Identity is not verified yet."}</p>
          <p>
            <Link href="/account/verification" className="font-semibold text-violet">
              Open verification checks
            </Link>
          </p>
          <p>
            <Link href="/dashboard/kyc" className="font-semibold text-violet">
              Open identity documents
            </Link>
          </p>
        </section>
      ) : null}

      {current === "connections" ? (
        <section className="mt-6 space-y-3 text-sm text-indigo">
          <p>Social accounts and sign-in connections stay on their own page.</p>
          <p>
            <Link href="/dashboard/social" className="font-semibold text-violet">
              Manage connections
            </Link>
          </p>
        </section>
      ) : null}

      {current === "billing" ? (
        <section className="mt-6 space-y-3 text-sm text-indigo">
          <h2 className="font-display text-lg font-bold">Billing & Plan</h2>
          <p>Current plan: {plan}</p>
          <p className="text-muted">Payout setup stays on Earnings & Payouts. This page is the subscription.</p>
          <p>
            <Link href={billingHref} className="font-semibold text-violet">
              Manage Billing & Plan
            </Link>
          </p>
        </section>
      ) : null}
    </div>
  );
}
