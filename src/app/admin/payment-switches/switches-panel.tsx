import { actionSavePaymentChargeSwitches } from "@/app/admin/payment-switches/actions";
import { paymentSettingsParams } from "@/app/admin/payment-settings/owner";
import { requireAnyAdminModule } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { listPaymentChargeSwitches } from "@/lib/payment-charge-switches";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment and charge switches · Admin" };

export async function PaymentSwitchesPanel({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAnyAdminModule(["marketplace", "collab_finance"]);
  const canEdit = hasPermission(session, "marketplace.manage");
  const params = paymentSettingsParams(await searchParams);
  const switches = await listPaymentChargeSwitches().catch(() => []);
  const groups = ["Charges", "Payments", "Refunds"];

  return (
    <div id="payment-switches" className="mx-auto max-w-3xl scroll-mt-24 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-indigo">Payment and charge switches</h1>
        <p className="mt-2 text-sm text-muted">
          Each switch turns one payment or charge on or off. Fee amounts stay on Fees & policies. Country routes stay
          on Country routes. Saving this form does not move money that is already with a provider.
        </p>
      </div>
      {params.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{params.error}</p>
      ) : null}
      {params.saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Saved {params.saved}.
        </p>
      ) : null}
      {switches.length === 0 ? (
        <p className="text-sm text-muted">The switch list could not be read.</p>
      ) : canEdit ? (
        <form action={actionSavePaymentChargeSwitches} className="space-y-4">
          {groups.map((group) => (
            <section key={group} className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
              <h2 className="font-display text-lg font-bold text-indigo">{group}</h2>
              <ul className="mt-3 space-y-3">
                {switches
                  .filter((row) => row.group === group)
                  .map((row) => (
                    <li key={row.key}>
                      <label className="flex items-start gap-2 text-sm text-indigo">
                        <input type="checkbox" name={row.key} defaultChecked={row.enabled} className="mt-1" />
                        <span>
                          <span className="font-semibold">{row.label}</span>
                          <span className="mt-0.5 block text-xs text-muted">{row.description}</span>
                        </span>
                      </label>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
          <input name="reason" required minLength={8} placeholder="Reason for this change" className="w-full rounded-lg border px-3 py-2 text-sm" />
          <button className="rounded-full bg-indigo px-4 py-2 text-xs font-bold text-white">Save switches</button>
        </form>
      ) : (
        <ul className="space-y-2 text-sm text-indigo">
          {switches.map((row) => (
            <li key={row.key}>
              {row.label}: {row.enabled ? "on" : "off"}
            </li>
          ))}
          <li className="text-xs text-muted">Marketplace manage can change these switches.</li>
        </ul>
      )}
    </div>
  );
}
