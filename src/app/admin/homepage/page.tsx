import { actionUpdateMenu, actionUpdateSection } from "@/app/admin/homepage/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { getDirectory } from "@/lib/directory";

export const dynamic = "force-dynamic";
export const metadata = { title: "Homepage · Admin" };

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminHomepagePage({ searchParams }: Props) {
  const session = await requireAdminPage("banners");
  const query = await searchParams;
  const canEdit = hasPermission(session, "banners.edit");
  const directory = await getDirectory();
  const sections = [...directory.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const menus = directory.menus.filter((item) => item.menu === "header" || item.menu === "footer_platform");

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-indigo">Homepage</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Section order and publish state change the public homepage on the next request. Statistics
        stay off until the numbers are audited. Header and platform-footer links come from the menu
        rows below.
      </p>
      {query.saved ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Saved.</p>
      ) : null}
      {query.error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{query.error}</p>
      ) : null}

      <div className="mt-6 space-y-3">
        {sections.map((section) => (
          <form key={section.key} action={actionUpdateSection} className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#E4EBFF] bg-white px-4 py-3">
            <input type="hidden" name="key" value={section.key} />
            <div className="min-w-40">
              <div className="font-semibold text-indigo">{section.title}</div>
              <div className="text-[11px] text-muted">{section.key}</div>
            </div>
            <label className="text-xs font-semibold text-muted">
              Order
              <input name="sortOrder" type="number" defaultValue={section.sortOrder} className="mt-1 block w-20 rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm text-indigo" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Enabled
              <select name="enabled" defaultValue={section.enabled ? "true" : "false"} className="mt-1 block rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm text-indigo">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Status
              <select name="status" defaultValue={section.status} className="mt-1 block rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm text-indigo">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            {canEdit ? (
              <button type="submit" className="text-sm font-bold text-violet hover:underline">Save</button>
            ) : null}
          </form>
        ))}
      </div>

      <h2 className="mt-10 font-display text-xl font-bold text-indigo">Menus</h2>
      <div className="mt-4 space-y-3">
        {menus.map((item) => (
          <form key={item.id} action={actionUpdateMenu} className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#E4EBFF] bg-white px-4 py-3">
            <input type="hidden" name="id" value={item.id} />
            <div className="text-[11px] font-bold uppercase text-muted">{item.menu}</div>
            <label className="text-xs font-semibold text-muted">
              Label
              <input name="label" defaultValue={item.label} className="mt-1 block rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm text-indigo" />
            </label>
            <label className="text-xs font-semibold text-muted">
              URL
              <input name="href" defaultValue={item.href} className="mt-1 block rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm text-indigo" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Order
              <input name="sortOrder" type="number" defaultValue={item.sortOrder} className="mt-1 block w-20 rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm text-indigo" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Visible
              <select name="visible" defaultValue={item.visible ? "true" : "false"} className="mt-1 block rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm text-indigo">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            {canEdit ? (
              <button type="submit" className="text-sm font-bold text-violet hover:underline">Save</button>
            ) : null}
          </form>
        ))}
      </div>
    </div>
  );
}
