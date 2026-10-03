import Link from "next/link";
import {
  actionSaveBusinessRequest,
  actionSaveCreatorOpportunity,
} from "@/app/admin/marketplace-listings/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import {
  listAdminBusinessRequests,
  listAdminCreatorOpportunities,
} from "@/lib/marketplace-listings";
import { getDirectory } from "@/lib/directory";

export const dynamic = "force-dynamic";
export const metadata = { title: "Marketplace listings · Admin" };

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

const inputClass = "mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal text-sm";

export default async function AdminMarketplaceListingsPage({ searchParams }: Props) {
  const session = await requireAdminPage("collaborations");
  const canEdit = hasPermission(session, "collaborations.edit");
  const params = await searchParams;
  const [requests, opportunities, directory] = await Promise.all([
    listAdminBusinessRequests(),
    listAdminCreatorOpportunities(),
    getDirectory().catch(() => null),
  ]);
  const creators = directory?.creators ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Marketplace listings</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Publish business requests and creator collaboration opportunities shown on the public
          Collaboration landing. Changes appear without a redeploy.
        </p>
      </div>

      {params.saved ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Saved {params.saved}.
        </p>
      ) : null}
      {params.error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{params.error}</p>
      ) : null}

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-indigo">Business requests</h2>
        {requests.map((row) => (
          <form
            key={row.id}
            action={actionSaveBusinessRequest}
            className="grid gap-3 rounded-2xl border border-[#E4EBFF] bg-white p-4 sm:grid-cols-2"
          >
            <input type="hidden" name="id" value={row.id} />
            <Field label="Brand" name="brand" defaultValue={row.brand} disabled={!canEdit} />
            <Field label="Category" name="category" defaultValue={row.category} disabled={!canEdit} />
            <Field label="Budget" name="budget" defaultValue={row.budget} disabled={!canEdit} />
            <Field label="Location" name="location" defaultValue={row.location} disabled={!canEdit} />
            <Field
              label="Tags (comma-separated)"
              name="tags"
              defaultValue={row.tags.join(", ")}
              disabled={!canEdit}
              className="sm:col-span-2"
            />
            <label className="block text-xs font-semibold text-muted sm:col-span-2">
              Summary
              <textarea
                name="summary"
                rows={2}
                defaultValue={row.summary}
                disabled={!canEdit}
                className={inputClass}
              />
            </label>
            <Field
              label="Looking for"
              name="lookingFor"
              defaultValue={row.lookingFor}
              disabled={!canEdit}
              className="sm:col-span-2"
            />
            <Field label="Logo URL" name="logoUrl" defaultValue={row.logoUrl ?? ""} disabled={!canEdit} />
            <Field label="Image URL" name="imageUrl" defaultValue={row.imageUrl ?? ""} disabled={!canEdit} />
            <label className="block text-xs font-semibold text-muted">
              Status
              <select name="status" defaultValue={row.status} disabled={!canEdit} className={inputClass}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <Field
              label="Sort order"
              name="sortOrder"
              type="number"
              defaultValue={String(row.sortOrder)}
              disabled={!canEdit}
            />
            {canEdit ? (
              <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
                Save request
              </button>
            ) : null}
          </form>
        ))}

        {canEdit ? (
          <form
            action={actionSaveBusinessRequest}
            className="grid gap-3 rounded-2xl border border-dashed border-[#C9D4F5] bg-[#F8FAFF] p-4 sm:grid-cols-2"
          >
            <p className="text-sm font-bold text-indigo sm:col-span-2">Add business request</p>
            <Field label="Brand" name="brand" disabled={!canEdit} />
            <Field label="Category" name="category" disabled={!canEdit} />
            <Field label="Budget" name="budget" disabled={!canEdit} />
            <Field label="Location" name="location" disabled={!canEdit} />
            <Field label="Tags (comma-separated)" name="tags" className="sm:col-span-2" disabled={!canEdit} />
            <label className="block text-xs font-semibold text-muted sm:col-span-2">
              Summary
              <textarea name="summary" rows={2} disabled={!canEdit} className={inputClass} />
            </label>
            <Field label="Looking for" name="lookingFor" className="sm:col-span-2" disabled={!canEdit} />
            <Field label="Logo URL" name="logoUrl" disabled={!canEdit} />
            <Field label="Image URL" name="imageUrl" disabled={!canEdit} />
            <label className="block text-xs font-semibold text-muted">
              Status
              <select name="status" defaultValue="published" disabled={!canEdit} className={inputClass}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <Field label="Sort order" name="sortOrder" type="number" defaultValue="99" disabled={!canEdit} />
            <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
              Create request
            </button>
          </form>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-indigo">Creator opportunities</h2>
        {opportunities.map((row) => (
          <form
            key={row.id}
            action={actionSaveCreatorOpportunity}
            className="grid gap-3 rounded-2xl border border-[#E4EBFF] bg-white p-4 sm:grid-cols-2"
          >
            <input type="hidden" name="id" value={row.id} />
            <label className="block text-xs font-semibold text-muted">
              Creator
              <select name="creatorSlug" defaultValue={row.creatorSlug} disabled={!canEdit} className={inputClass}>
                {creators.map((creator) => (
                  <option key={creator.slug} value={creator.slug}>
                    {creator.displayName}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Looking for" name="lookingFor" defaultValue={row.lookingFor} disabled={!canEdit} />
            <label className="block text-xs font-semibold text-muted sm:col-span-2">
              Summary
              <textarea
                name="summary"
                rows={2}
                defaultValue={row.summary}
                disabled={!canEdit}
                className={inputClass}
              />
            </label>
            <Field label="Purpose" name="purpose" defaultValue={row.purpose ?? ""} disabled={!canEdit} />
            <Field label="Location" name="location" defaultValue={row.location ?? ""} disabled={!canEdit} />
            <label className="block text-xs font-semibold text-muted">
              Status
              <select name="status" defaultValue={row.status} disabled={!canEdit} className={inputClass}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <Field
              label="Sort order"
              name="sortOrder"
              type="number"
              defaultValue={String(row.sortOrder)}
              disabled={!canEdit}
            />
            {canEdit ? (
              <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
                Save opportunity
              </button>
            ) : null}
          </form>
        ))}

        {canEdit ? (
          <form
            action={actionSaveCreatorOpportunity}
            className="grid gap-3 rounded-2xl border border-dashed border-[#C9D4F5] bg-[#F8FAFF] p-4 sm:grid-cols-2"
          >
            <p className="text-sm font-bold text-indigo sm:col-span-2">Add creator opportunity</p>
            <label className="block text-xs font-semibold text-muted">
              Creator
              <select name="creatorSlug" disabled={!canEdit} className={inputClass} defaultValue="">
                <option value="">—</option>
                {creators.map((creator) => (
                  <option key={creator.slug} value={creator.slug}>
                    {creator.displayName}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Looking for" name="lookingFor" disabled={!canEdit} />
            <label className="block text-xs font-semibold text-muted sm:col-span-2">
              Summary
              <textarea name="summary" rows={2} disabled={!canEdit} className={inputClass} />
            </label>
            <Field label="Purpose" name="purpose" disabled={!canEdit} />
            <Field label="Location" name="location" disabled={!canEdit} />
            <label className="block text-xs font-semibold text-muted">
              Status
              <select name="status" defaultValue="published" disabled={!canEdit} className={inputClass}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <Field label="Sort order" name="sortOrder" type="number" defaultValue="99" disabled={!canEdit} />
            <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
              Create opportunity
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue = "",
  disabled,
  type = "text",
  className = "",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  disabled?: boolean;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block text-xs font-semibold text-muted ${className}`}>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        disabled={disabled}
        className={inputClass}
      />
    </label>
  );
}
