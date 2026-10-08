import Image from "next/image";
import Link from "next/link";
import {
  actionAdvanceIntro,
  actionOpenIntroFeeCheckout,
  actionCreateIntro,
  actionRecordIntroduction,
  actionRequestIntroFeeSettlement,
  actionSetManagedPromotion,
  actionSetOptIn,
} from "@/app/admin/matching/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import {
  getManagedMatching,
  getManagedPromotionEnabled,
  INTRO_STATUSES,
  listQueuedMatchRequests,
} from "@/lib/managed-matching";
import { introStatusDisplayLabel, MATCHING_PRODUCT_BOUNDARY } from "@/lib/matching-product-boundary";
import { formatMoney } from "@/lib/money";
import { indexCreatorsBySlug, listDirectoryCreators } from "@/lib/directory";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Managed Matching" };

type Props = {
  searchParams: Promise<{
    created?: string;
    advanced?: string;
    optin?: string;
    flag?: string;
    recorded?: string;
    feeQuoted?: string;
    feeOpened?: string;
    error?: string;
  }>;
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  outreach: "bg-amber-100 text-amber-800",
  introduced: "bg-blue-100 text-blue-800",
  in_conversation: "bg-violet-100 text-violet-800",
  paid: "bg-emerald-100 text-emerald-800",
  declined: "bg-rose-100 text-rose-800",
  closed: "bg-slate-200 text-slate-600",
};

export default async function AdminMatchingPage({ searchParams }: Props) {
  const session = await requireAdminPage("matching");
  const canCreateIntros = hasPermission(session, "matching.create_intros");
  const canAdvanceIntros = hasPermission(session, "matching.advance_intros");
  const canManageOptins = hasPermission(session, "matching.manage_optins");
  const params = await searchParams;
  let store;
  let queue;
  let promotionOn = false;
  try {
    [store, queue, promotionOn] = await Promise.all([
      getManagedMatching(),
      listQueuedMatchRequests(),
      getManagedPromotionEnabled(),
    ]);
  } catch {
    return (
      <div className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-bold text-indigo">Managed Matching</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Matching records are unavailable. Nothing was saved.
        </p>
      </div>
    );
  }
  const optInCount = store.optIns.filter((o) => o.openToManaged).length;
  const paidCount = store.intros.filter((i) => i.status === "paid").length;

  const directoryCreators = await listDirectoryCreators();
  const bySlug = indexCreatorsBySlug(directoryCreators);

  return (
    <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
            ← Admin
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold text-indigo">
            Managed Matching
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Influencer opt-in, shortlist delivery, facilitated intros, and intro-fee tracking.
          </p>
          <p className="mt-2 max-w-2xl rounded-xl border border-[#E4E9F5] bg-[#F7FAFF] px-3 py-2 text-xs text-indigo">
            <strong>R073:</strong> {MATCHING_PRODUCT_BOUNDARY.summary}{" "}
            {MATCHING_PRODUCT_BOUNDARY.nextStepHint}
          </p>
        </div>
        <div className="flex gap-3 text-center text-xs">
          <div className="rounded-xl bg-lavender px-4 py-2">
            <p className="font-display text-lg font-bold text-violet">{optInCount}</p>
            <p className="text-muted">Opted in</p>
          </div>
          <div className="rounded-xl bg-[#D9E8FF] px-4 py-2">
            <p className="font-display text-lg font-bold text-blue">{store.intros.length}</p>
            <p className="text-muted">Intros</p>
          </div>
          <div className="rounded-xl bg-emerald-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-emerald-700">{paidCount}</p>
            <p className="text-muted">Intro fees</p>
          </div>
        </div>
      </div>

      {params.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </div>
      ) : null}
      {params.created || params.advanced || params.optin || params.flag || params.recorded || params.feeQuoted || params.feeOpened ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Saved
          {params.created ? " · intro created" : ""}
          {params.advanced ? " · status advanced" : ""}
          {params.feeQuoted ? " · intro fee quote requested" : ""}
          {params.feeOpened ? " · intro fee checkout opened. Paid when the provider webhook arrives." : ""}
          {params.recorded ? " · introduction recorded" : ""}
          {params.optin ? ` · opt-in updated (${params.optin})` : ""}
          {params.flag ? " · managed promotion updated" : ""}.
        </div>
      ) : null}

      {canManageOptins ? (
        <section className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Managed promotion</h2>
          <p className="mt-1 text-sm text-muted">
            When this is off, businesses cannot request managed matching. Agency is still required when it is on.
          </p>
          <form action={actionSetManagedPromotion} className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
              <input type="checkbox" name="enabled" defaultChecked={promotionOn} className="accent-violet" />
              managed_promotion
            </label>
            <button type="submit" className="btn-secondary !py-1.5 text-xs">
              Save flag
            </button>
            <span className="text-xs text-muted">{promotionOn ? "On" : "Off"}</span>
          </form>
        </section>
      ) : (
        <section className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Managed promotion</h2>
          <p className="mt-1 text-sm text-muted">
            managed_promotion is {promotionOn ? "on" : "off"}. Your role cannot change it.
          </p>
        </section>
      )}

      <section className="card-surface p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Managed queue</h2>
        <p className="mt-1 text-sm text-muted">
          Requests from business briefs. Recording an introduction moves the item out of the queue.
        </p>
        {queue.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No briefs are waiting.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {queue.map((item) => (
              <li key={item.id} className="rounded-2xl border border-border bg-starter-bg p-4">
                <p className="font-bold text-indigo">{item.briefTitle}</p>
                <p className="text-sm text-muted">
                  {item.businessName} · requested {new Date(item.createdAt).toLocaleString()}
                </p>
                {canCreateIntros ? (
                  <form action={actionRecordIntroduction} className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input type="hidden" name="requestId" value={item.id} />
                    <label className="text-sm">
                      <span className="font-semibold text-indigo">Influencer</span>
                      <select name="creatorSlug" required className="mt-1 w-full rounded-xl border border-border px-3 py-2">
                        {store.optIns
                          .filter((opt) => opt.openToManaged)
                          .map((opt) => (
                            <option key={opt.creatorSlug} value={opt.creatorSlug}>
                              {bySlug.get(opt.creatorSlug)?.displayName ?? opt.creatorSlug}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="font-semibold text-indigo">Expected fee</span>
                      <input
                        name="feeExpected"
                        defaultValue="15% success fee"
                        className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                      />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      <span className="font-semibold text-indigo">Notes</span>
                      <input
                        name="notes"
                        placeholder="Why this introduction"
                        className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <button type="submit" className="btn-primary !py-2 text-sm">
                        Record introduction
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-2 text-xs text-muted">View-only — your role cannot record introductions.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Create intro from shortlist delivery */}
      {canCreateIntros ? (
        <section className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Deliver shortlist → create intro</h2>
          <p className="mt-1 text-sm text-muted">
            Manual facilitation first. Pick an opted-in creator and open an intro pipeline.
          </p>
          <form action={actionCreateIntro} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-semibold text-indigo">Business</span>
              <input
                name="businessName"
                placeholder="Business name"
                required
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-indigo">Influencer</span>
              <select name="creatorSlug" className="mt-1 w-full rounded-xl border border-border px-3 py-2" required>
                {store.optIns
                  .filter((o) => o.openToManaged)
                  .map((o) => (
                    <option key={o.creatorSlug} value={o.creatorSlug}>
                      {bySlug.get(o.creatorSlug)?.displayName ?? o.creatorSlug}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-semibold text-indigo">Brief / campaign</span>
              <input
                name="briefTitle"
                defaultValue="Clean Skincare Launch"
                required
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-semibold text-indigo">Ops notes</span>
              <textarea
                name="notes"
                rows={2}
                placeholder="Why this fit, outreach angle…"
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-indigo">Expected fee</span>
              <input
                name="feeExpected"
                defaultValue="15% success fee"
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full !py-2 text-sm">
                Create intro
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {/* Intro pipeline */}
      <section className="card-surface p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Intro pipeline</h2>
        <ul className="mt-4 space-y-4">
          {store.intros.map((intro) => {
            const creator = bySlug.get(intro.creatorSlug);
            return (
              <li
                key={intro.id}
                className="rounded-2xl border border-border bg-starter-bg p-4"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <span className="relative h-12 w-12 overflow-hidden rounded-full">
                    {creator ? (
                      <Image src={creator.image} alt="" fill className="object-cover" sizes="48px" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-indigo">
                        {intro.businessName} ↔ {creator?.displayName ?? intro.creatorSlug}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLOR[intro.status]}`}
                      >
                        {introStatusDisplayLabel(intro.status)}
                      </span>
                    </div>
                    <p className="text-sm text-muted">
                      {intro.briefTitle}
                      {intro.feeExpected ? ` · ${intro.feeExpected}` : ""}
                      {intro.feeExpectedCents != null
                        ? ` · quoted ${formatMoney(intro.feeExpectedCents)}`
                        : ""}
                      {intro.feeIntentRef ? ` · intent ${intro.feeIntentRef}` : ""}
                      {intro.feeProviderRef ? ` · settled ${intro.feeProviderRef}` : ""}
                    </p>
                    {intro.notes ? <p className="mt-1 text-xs text-muted">{intro.notes}</p> : null}
                    <ol className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold text-muted">
                      {intro.timeline.map((t, i) => (
                        <li key={`${t.at}-${i}`} className="rounded bg-white px-2 py-0.5 ring-1 ring-border">
                          {introStatusDisplayLabel(t.status)}
                          {t.note ? ` — ${t.note}` : ""}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
                {canAdvanceIntros ? (
                  <div className="mt-3 space-y-2">
                    {intro.status !== "paid" && intro.status !== "declined" && intro.status !== "closed" ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={actionRequestIntroFeeSettlement} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="id" value={intro.id} />
                          <label className="text-xs">
                            <span className="font-semibold text-indigo">Deal basis (¢)</span>
                            <input
                              name="grossCents"
                              type="number"
                              min={100}
                              placeholder="10000"
                              className="ml-2 w-28 rounded-lg border border-border px-2 py-1 text-sm"
                            />
                          </label>
                          <button type="submit" className="btn-secondary !px-3 !py-1.5 text-xs">
                            {intro.feeIntentRef ? "Refresh fee quote" : "Request fee quote"}
                          </button>
                        </form>
                        {intro.feeIntentRef && intro.feeExpectedCents != null ? (
                          <form action={actionOpenIntroFeeCheckout}>
                            <input type="hidden" name="id" value={intro.id} />
                            <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">
                              Open fee checkout
                            </button>
                          </form>
                        ) : null}
                        <p className="w-full text-[10px] text-muted">
                          Opening checkout does not mark this intro paid. The provider webhook is the only settlement.
                        </p>
                      </div>
                    ) : null}
                    <p className="text-[10px] text-muted">{MATCHING_PRODUCT_BOUNDARY.introFeePaidHint}</p>
                    <form action={actionAdvanceIntro} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={intro.id} />
                      <label className="text-xs">
                        <span className="font-semibold text-indigo">Advance to</span>
                        <select
                          name="status"
                          defaultValue={
                            INTRO_STATUSES[
                              Math.min(
                                INTRO_STATUSES.findIndex((s) => s.code === intro.status) + 1,
                                INTRO_STATUSES.length - 1,
                              )
                            ]?.code ?? "outreach"
                          }
                          className="ml-2 rounded-lg border border-border px-2 py-1"
                        >
                          {INTRO_STATUSES.map((s) => (
                            <option key={s.code} value={s.code}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <input
                        name="note"
                        placeholder="Note (optional)"
                        className="min-w-[10rem] flex-1 rounded-lg border border-border px-2 py-1 text-sm"
                      />
                      <button type="submit" className="btn-secondary !px-3 !py-1.5 text-xs">
                        Update status
                      </button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Influencer opt-in targeting */}
      <section className="card-surface p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Influencer opt-in targeting</h2>
        <p className="mt-1 text-sm text-muted">
          Only opted-in influencers appear in the intro delivery picker.
          {!canManageOptins ? " View-only — your role cannot change opt-ins." : ""}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {directoryCreators.map((c) => {
            const opt = store.optIns.find((o) => o.creatorSlug === c.slug);
            if (!canManageOptins) {
              return (
                <div key={c.slug} className="rounded-xl border border-border bg-white p-4">
                  <div className="flex items-center gap-3">
                    <span className="relative h-10 w-10 overflow-hidden rounded-full">
                      <Image src={c.image} alt="" fill className="object-cover" sizes="40px" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-indigo">{c.displayName}</p>
                      <p className="truncate text-xs text-muted">{c.title}</p>
                    </div>
                    <span className="text-xs font-semibold text-violet">
                      {opt?.openToManaged ? "Opted in" : "Not opted in"}
                    </span>
                  </div>
                </div>
              );
            }
            return (
              <form
                key={c.slug}
                action={actionSetOptIn}
                className="rounded-xl border border-border bg-white p-4"
              >
                <input type="hidden" name="creatorSlug" value={c.slug} />
                <div className="flex items-center gap-3">
                  <span className="relative h-10 w-10 overflow-hidden rounded-full">
                    <Image src={c.image} alt="" fill className="object-cover" sizes="40px" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-indigo">{c.displayName}</p>
                    <p className="truncate text-xs text-muted">{c.title}</p>
                  </div>
                  <label className="flex items-center gap-1 text-xs font-semibold text-indigo">
                    <input
                      type="checkbox"
                      name="openToManaged"
                      defaultChecked={opt?.openToManaged}
                      className="accent-violet"
                    />
                    Opt in
                  </label>
                </div>
                <input
                  name="niches"
                  defaultValue={(opt?.niches ?? c.specialties).join(",")}
                  className="mt-3 w-full rounded-lg border border-border px-2 py-1.5 text-xs"
                  placeholder="niches"
                />
                <input
                  name="targetingNotes"
                  defaultValue={opt?.targetingNotes ?? c.offer ?? ""}
                  className="mt-2 w-full rounded-lg border border-border px-2 py-1.5 text-xs"
                  placeholder="Targeting notes"
                />
                <button type="submit" className="btn-secondary mt-2 !py-1.5 text-xs">
                  Save
                </button>
              </form>
            );
          })}
        </div>
      </section>
    </div>
  );
}
