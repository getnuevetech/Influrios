import Link from "next/link";
import { actionAssignAiFunction, actionSaveAiProvider } from "@/app/admin/ai/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { aiFunctionRoutes, listProviders } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI pipelines · Admin" };

const inputClass = "mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal";

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminAiPage({ searchParams }: Props) {
  const session = await requireAdminPage("ai");
  const canEdit = hasPermission(session, "ai.edit");
  const params = await searchParams;
  let providers: Awaited<ReturnType<typeof listProviders>> = [];
  let functions: Awaited<ReturnType<typeof aiFunctionRoutes>> = [];
  let dbError = false;
  try {
    [providers, functions] = await Promise.all([listProviders("ai"), aiFunctionRoutes()]);
  } catch (error) {
    console.error("admin ai", error);
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">AI pipelines</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Add more than one model provider. Each pipeline function can use a different provider. If a function has no
        enabled provider with a saved secret, the platform fallback stays in place and nothing is auto-published.
        Live calls are limited to OpenAI and Anthropic hosts.
      </p>
      {params.saved ? <p className="mt-4 text-sm font-semibold text-emerald-700">Saved.</p> : null}
      {params.error ? <p className="mt-4 text-sm font-semibold text-amber-800">{params.error}</p> : null}
      {dbError ? <p className="mt-4 text-sm text-amber-800">The database is unavailable.</p> : null}

      <section className="mt-6 space-y-3">
        <h2 className="font-display text-lg font-bold text-indigo">Functions</h2>
        {functions.map((fn) => (
          <form key={fn.key} action={actionAssignAiFunction} className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
            <input type="hidden" name="functionKey" value={fn.key} />
            <p className="font-semibold text-indigo">{fn.label}</p>
            <p className="mt-1 text-sm text-muted">{fn.description}</p>
            <p className="mt-1 text-xs text-muted">
              Fallback: {fn.fallback}. Now: {fn.decision.mode === "provider" ? fn.decision.providerCode : "platform fallback"}.
            </p>
            <label className="mt-3 block text-sm font-semibold text-indigo">
              Assigned provider
              <select name="providerId" defaultValue={fn.providerId} disabled={!canEdit} className={inputClass}>
                <option value="">Platform fallback</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} ({provider.code})
                  </option>
                ))}
              </select>
            </label>
            {canEdit ? <button type="submit" className="btn-primary mt-3 w-fit">Save assignment</button> : null}
          </form>
        ))}
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="font-display text-lg font-bold text-indigo">Providers</h2>
        {providers.map((provider) => (
          <form key={provider.id} action={actionSaveAiProvider} className="grid gap-3 rounded-2xl border border-[#E4EBFF] bg-white p-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={provider.id} />
            <input type="hidden" name="code" value={provider.code} />
            <label className="block text-sm font-semibold text-indigo">
              Name
              <input name="name" defaultValue={provider.name} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="block text-sm font-semibold text-indigo">
              Model
              <input name="model" defaultValue={provider.model} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="block text-sm font-semibold text-indigo sm:col-span-2">
              Base URL
              <input name="baseUrl" defaultValue={provider.baseUrl} placeholder="https://api.openai.com/v1" disabled={!canEdit} className={inputClass} />
            </label>
            <label className="block text-sm font-semibold text-indigo sm:col-span-2">
              API secret ({provider.secret})
              <input name="secret" type="password" placeholder="Leave blank to keep the saved secret" disabled={!canEdit} className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
              <input type="checkbox" name="enabled" value="1" defaultChecked={provider.enabled} disabled={!canEdit} />
              Enabled
            </label>
            {canEdit ? <button type="submit" className="btn-primary w-fit">Save provider</button> : null}
          </form>
        ))}
        {canEdit ? (
          <form action={actionSaveAiProvider} className="grid gap-3 rounded-2xl border border-dashed border-[#E4EBFF] bg-white p-4 sm:grid-cols-2">
            <h3 className="font-semibold text-indigo sm:col-span-2">Add a provider</h3>
            <label className="block text-sm font-semibold text-indigo">
              Code
              <input name="code" required placeholder="openai" className={inputClass} />
            </label>
            <label className="block text-sm font-semibold text-indigo">
              Name
              <input name="name" required placeholder="OpenAI" className={inputClass} />
            </label>
            <label className="block text-sm font-semibold text-indigo">
              Base URL
              <input name="baseUrl" placeholder="https://api.openai.com/v1" className={inputClass} />
            </label>
            <label className="block text-sm font-semibold text-indigo">
              Model
              <input name="model" placeholder="gpt-4o-mini" className={inputClass} />
            </label>
            <label className="block text-sm font-semibold text-indigo sm:col-span-2">
              API secret
              <input name="secret" type="password" className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
              <input type="checkbox" name="enabled" value="1" />
              Enabled
            </label>
            <button type="submit" className="btn-secondary w-fit">Add provider</button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
