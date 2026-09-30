import Link from "next/link";
import { requireAdminPage } from "@/app/admin/guard";
import {
  actionRestoreValueProposition,
  actionUpdateValueProposition,
} from "@/app/admin/actions";
import { hasPermission } from "@/lib/admin-auth";
import { getCms } from "@/lib/cms";

export const metadata = { title: "Admin · Value proposition" };

type Props = { searchParams: Promise<{ saved?: string; restored?: string }> };

export default async function AdminValuePropPage({ searchParams }: Props) {
  const session = await requireAdminPage("banners");
  const canEdit = hasPermission(session, "banners.edit");
  const params = await searchParams;
  const strip = (await getCms()).valueProposition;
  const items = [...strip.items].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">
          Homepage value proposition
        </h1>
        <p className="mt-1 text-sm text-muted">
          Phase 12a — CMS-managed pillars that replace placeholder homepage statistics (Addendum
          §23 / Product §21).
        </p>
      </div>

      {params.saved || params.restored ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {params.restored ? "Defaults restored." : "Value proposition saved."}
        </div>
      ) : null}

      <form action={actionUpdateValueProposition} className="card-surface space-y-5 p-5">
        <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
          <input type="checkbox" name="enabled" defaultChecked={strip.enabled} disabled={!canEdit} />
          Section enabled
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Eyebrow" name="eyebrow" defaultValue={strip.eyebrow} disabled={!canEdit} />
          <Field
            label="Headline"
            name="headline"
            defaultValue={strip.headline}
            disabled={!canEdit}
          />
          <Field
            label="Headline highlight"
            name="headlineHighlight"
            defaultValue={strip.headlineHighlight}
            disabled={!canEdit}
          />
          <Field
            label="Subtitle"
            name="subtitle"
            defaultValue={strip.subtitle}
            disabled={!canEdit}
          />
          <Field
            label="Closing line 1"
            name="closing1"
            defaultValue={strip.closingTaglineLine1}
            disabled={!canEdit}
          />
          <Field
            label="Closing line 2"
            name="closing2"
            defaultValue={strip.closingTaglineLine2}
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold text-indigo">Pillars</h2>
          {items.map((item) => (
            <div key={item.key} className="rounded-xl border border-[#E6ECFF] bg-[#F8FAFF] p-4">
              <input type="hidden" name="itemKey" value={item.key} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-indigo">{item.key}</p>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    name={`enabled_${item.key}`}
                    defaultChecked={item.enabled}
                    disabled={!canEdit}
                  />
                  Enabled
                </label>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Field
                  label="Title"
                  name={`title_${item.key}`}
                  defaultValue={item.title}
                  disabled={!canEdit}
                />
                <Field
                  label="Micro-label"
                  name={`micro_${item.key}`}
                  defaultValue={item.microLabel}
                  disabled={!canEdit}
                />
                <Field
                  label="Description"
                  name={`desc_${item.key}`}
                  defaultValue={item.description}
                  disabled={!canEdit}
                />
                <Field
                  label="Link URL"
                  name={`link_${item.key}`}
                  defaultValue={item.linkUrl}
                  disabled={!canEdit}
                />
                <Field
                  label="Sort order"
                  name={`sort_${item.key}`}
                  defaultValue={String(item.sortOrder)}
                  disabled={!canEdit}
                />
                <label className="text-xs font-semibold text-muted">
                  Icon
                  <select
                    name={`icon_${item.key}`}
                    defaultValue={item.iconKey}
                    disabled={!canEdit}
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
                  >
                    <option value="card">card</option>
                    <option value="intelligence">intelligence</option>
                    <option value="network">network</option>
                    <option value="payments">payments</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted">
                  Accent
                  <select
                    name={`accent_${item.key}`}
                    defaultValue={item.accentToken}
                    disabled={!canEdit}
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
                  >
                    <option value="violet">violet</option>
                    <option value="blue">blue</option>
                    <option value="rose">rose</option>
                    <option value="emerald">emerald</option>
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save value proposition
            </button>
          </div>
        ) : null}
      </form>

      {canEdit ? (
        <form action={actionRestoreValueProposition}>
          <button type="submit" className="btn-secondary !py-2 text-sm">
            Restore launch defaults
          </button>
        </form>
      ) : null}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  disabled,
}: {
  label: string;
  name: string;
  defaultValue: string;
  disabled?: boolean;
}) {
  return (
    <label className="text-xs font-semibold text-muted">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo disabled:bg-[#F3F4F6]"
      />
    </label>
  );
}
