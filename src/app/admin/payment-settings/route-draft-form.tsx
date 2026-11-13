import { actionSaveRouteDraft } from "@/app/admin/payment-standard/actions";

export function RouteDraftForm() {
  return (
    <form action={actionSaveRouteDraft} className="space-y-3 rounded-2xl border border-border bg-white p-5">
      <h2 className="font-display text-xl font-bold text-indigo">New route version</h2>
      <p className="text-sm text-muted">This creates a draft. It does not reroute held money. Webhooks, refunds, and reconciliation stay available when collections are off.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Country<input name="countryCode" defaultValue="US" className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
        <label className="text-sm">Currency<input name="currency" defaultValue="USD" className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
        <label className="text-sm">Environment
          <select name="environment" className="mt-1 w-full rounded-xl border px-3 py-2">
            <option value="sandbox">sandbox</option>
            <option value="live">live</option>
          </select>
        </label>
        <label className="text-sm">Provider<input name="providerCode" defaultValue="stripe" className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
      </div>
      <label className="flex gap-2 text-sm"><input type="checkbox" name="allocatedFundsApproved" /> Allocated funds approved by the provider</label>
      <label className="flex gap-2 text-sm"><input type="checkbox" name="newCollectionsEnabled" /> Allow new collections</label>
      <label className="flex gap-2 text-sm"><input type="checkbox" name="releasesEnabled" /> Allow releases</label>
      <label className="block text-sm">Evidence<textarea name="evidence" className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
      <button type="submit" className="h-11 rounded-full bg-violet px-4 text-sm font-semibold text-white">Save route draft</button>
    </form>
  );
}
