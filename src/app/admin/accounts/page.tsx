import Link from "next/link";
import { actionSaveAccountPolicy, actionSaveMember } from "@/app/admin/accounts/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { DEFAULT_SITE_CONFIG, getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Member accounts" };

const ROLES = ["CREATOR", "BUSINESS", "AGENCY", "ADMIN"] as const;
const PLANS = ["STARTER", "PLUS", "PRO", "BUSINESS_FREE", "BUSINESS_PRO", "AGENCY"] as const;

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requireAdminPage("accounts");
  const canEdit = hasPermission(session, "accounts.edit");
  const params = await searchParams;
  const policy = await getSiteConfig();
  const users = await prisma.user
    .findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { consents: { orderBy: { acceptedAt: "desc" }, take: 1 } },
    })
    .catch(() => []);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Member accounts</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        These are creator, business, and agency sign-ins. The admin console itself is still managed under Access
        levels. Guest view and search limits are on{" "}
        <Link href="/admin/guests" className="font-semibold text-violet">
          Guest gates
        </Link>
        .
      </p>
      {params.saved === "policy" ? <p className="mt-4 text-sm font-semibold text-emerald-700">Account policy saved.</p> : null}
      {params.saved === "member" ? <p className="mt-4 text-sm font-semibold text-emerald-700">Account updated.</p> : null}
      {params.error ? <p className="mt-4 text-sm font-semibold text-amber-800">That change could not be saved.</p> : null}

      <form action={actionSaveAccountPolicy} className="mt-6 space-y-3 rounded-2xl border border-[#E4EBFF] bg-white p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Registration policy</h2>
        <p className="text-sm text-muted">New sign-ups record this consent version. Existing consents stay on the version they accepted.</p>
        <label className="block text-sm font-semibold text-indigo">
          Consent version
          <input
            name="consentVersion"
            defaultValue={policy.consentVersion || DEFAULT_SITE_CONFIG.consentVersion}
            disabled={!canEdit}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold text-indigo">
          Consent text
          <textarea
            name="consentCopy"
            defaultValue={policy.consentCopy || DEFAULT_SITE_CONFIG.consentCopy}
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
            defaultValue={policy.passwordMinLength}
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

      <h2 className="mt-10 font-display text-lg font-bold text-indigo">Accounts</h2>
      {users.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No member accounts yet, or the database is unavailable.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {users.map((user) => (
            <form key={user.id} action={actionSaveMember} className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
              <input type="hidden" name="userId" value={user.id} />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-indigo">{user.name || "Unnamed"}</p>
                  <p className="text-sm text-muted">{user.email}</p>
                  <p className="mt-1 text-xs text-muted">
                    Joined {user.createdAt.toISOString().slice(0, 10)} · consent {user.consents[0]?.version || "none"}
                  </p>
                </div>
                {canEdit ? (
                  <button type="submit" className="rounded-xl border border-[#E4EBFF] px-3 py-2 text-sm font-semibold text-indigo">
                    Save
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
                  Role
                  <select name="role" defaultValue={user.role} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo">
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
                  Plan
                  <select name="planTier" defaultValue={user.planTier} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo">
                    {PLANS.map((plan) => (
                      <option key={plan} value={plan}>
                        {plan}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-indigo">
                  <input type="checkbox" name="verified" value="1" defaultChecked={Boolean(user.emailVerifiedAt)} disabled={!canEdit} />
                  Email verified
                </label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-indigo">
                  <input type="checkbox" name="suspended" value="1" defaultChecked={Boolean(user.suspendedAt)} disabled={!canEdit} />
                  Suspended
                </label>
              </div>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
