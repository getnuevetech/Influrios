import Link from "next/link";
import { actionDeleteFaq, actionSaveFaq } from "@/app/admin/faq/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { FAQ_AUDIENCE_LABELS, FAQ_AUDIENCES } from "@/lib/faq-catalog";
import { listFaqEntries } from "@/lib/faq";

export const dynamic = "force-dynamic";
export const metadata = { title: "FAQ · Admin" };

const inputClass = "mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal";

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminFaqPage({ searchParams }: Props) {
  const session = await requireAdminPage("banners");
  const canEdit = hasPermission(session, "banners.edit");
  const params = await searchParams;
  let entries: Awaited<ReturnType<typeof listFaqEntries>> = [];
  let dbError = false;
  try {
    entries = await listFaqEntries();
  } catch (error) {
    console.error("admin faq", error);
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">FAQ</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        These answers are the public FAQ at /faq. Audiences are general, creators, businesses, agencies, and visitors.
        The NFC articles explain how a creator writes inflr.me/n/{"{token}"} onto a physical tag and how that tag is handed on.
        Editing an answer here replaces the stored text. A seed question is added only when its key is missing, so an edit is kept.
      </p>
      {params.saved ? <p className="mt-4 text-sm font-semibold text-emerald-700">Saved.</p> : null}
      {params.error ? <p className="mt-4 text-sm text-amber-800">{params.error}</p> : null}
      {dbError ? <p className="mt-4 text-sm text-amber-800">The FAQ is unavailable.</p> : null}

      {canEdit ? (
        <form action={actionSaveFaq} className="card-surface mt-6 space-y-3 p-5">
          <h2 className="font-display text-lg font-bold text-indigo">New answer</h2>
          <label className="block text-sm font-semibold text-indigo">
            Key
            <input name="key" placeholder="nfc-replace" className={inputClass} />
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Audience
            <select name="audience" className={inputClass}>
              {FAQ_AUDIENCES.map((audience) => (
                <option key={audience} value={audience}>
                  {FAQ_AUDIENCE_LABELS[audience]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Question
            <input name="question" className={inputClass} />
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Answer
            <textarea name="answer" rows={6} className={inputClass} />
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Sort
            <input name="sortOrder" type="number" min={0} defaultValue={100} className={inputClass} />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
            <input type="checkbox" name="published" value="1" defaultChecked />
            Published
          </label>
          <button type="submit" className="btn-primary !py-2 text-sm">
            Add answer
          </button>
        </form>
      ) : null}

      <div className="mt-6 space-y-4">
        {entries.map((entry) => (
          <form key={entry.id} action={actionSaveFaq} className="card-surface space-y-3 p-5">
            <input type="hidden" name="id" value={entry.id} />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {FAQ_AUDIENCE_LABELS[entry.audience as keyof typeof FAQ_AUDIENCE_LABELS] ?? entry.audience} · {entry.key}
            </p>
            <label className="block text-sm font-semibold text-indigo">
              Audience
              <select name="audience" defaultValue={entry.audience} disabled={!canEdit} className={inputClass}>
                {FAQ_AUDIENCES.map((audience) => (
                  <option key={audience} value={audience}>
                    {FAQ_AUDIENCE_LABELS[audience]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-indigo">
              Question
              <input name="question" defaultValue={entry.question} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="block text-sm font-semibold text-indigo">
              Answer
              <textarea name="answer" defaultValue={entry.answer} rows={8} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="block text-sm font-semibold text-indigo">
              Sort
              <input name="sortOrder" type="number" min={0} defaultValue={entry.sortOrder} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
              <input type="checkbox" name="published" value="1" defaultChecked={entry.published} disabled={!canEdit} />
              Published
            </label>
            {canEdit ? (
              <div className="flex flex-wrap gap-4">
                <button type="submit" className="text-sm font-bold text-violet hover:underline">
                  Save
                </button>
                <button formAction={actionDeleteFaq} className="text-sm font-bold text-rose-700 hover:underline">
                  Delete
                </button>
              </div>
            ) : null}
          </form>
        ))}
      </div>
    </div>
  );
}
