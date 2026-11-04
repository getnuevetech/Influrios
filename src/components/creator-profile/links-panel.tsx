import Link from "next/link";
import { NfcWriter } from "@/app/dashboard/nfc-writer";
import { ScheduleStartsField } from "@/app/dashboard/schedule-starts-field";
import {
  actionCancelSchedule,
  actionChangeShortSlug,
  actionCreateCampaignLink,
  actionRollbackDynamicDestination,
  actionScheduleDestination,
  actionSetCampaignLinkStatus,
  actionSetDynamicDestination,
} from "@/app/dashboard/short-actions";
import type { CreatorProfileBundle } from "@/lib/creator-profile-data";
import { slugChangeWarning } from "@/lib/short-link";
import { referralRewardLabel } from "@/lib/referrals";

type LinksPanelProps = {
  draft: Pick<CreatorProfileBundle["draft"], "id" | "slug">;
  shortLink: CreatorProfileBundle["shortLink"];
  shortHost: string;
  linkLimits: CreatorProfileBundle["linkLimits"];
  slugHistory: CreatorProfileBundle["slugHistory"];
  referrals: CreatorProfileBundle["referrals"];
  destinationHistory: CreatorProfileBundle["destinationHistory"];
  pendingSchedules: CreatorProfileBundle["pendingSchedules"];
  campaignLinks: CreatorProfileBundle["campaignLinks"];
  campaignMax: number;
  campaignRoom: boolean;
  linkAnalytics: CreatorProfileBundle["linkAnalytics"];
  confirmSlug?: string;
};

export function LinksManagementPanel({
  draft,
  shortLink,
  shortHost,
  linkLimits,
  slugHistory,
  referrals,
  destinationHistory,
  pendingSchedules,
  campaignLinks,
  campaignMax,
  campaignRoom,
  linkAnalytics,
  confirmSlug,
}: LinksPanelProps) {
  const params = { confirmSlug };
  return (
    <div className="space-y-6">
            <section className="card-surface p-6">
              <h2 className="font-display text-xl font-bold text-indigo">Your links</h2>
              <p className="mt-2 text-sm text-indigo">
                Canonical profile: influrios.com/c/{draft.slug}
              </p>
              {shortLink && shortLink.status === "active" ? (
                <div className="mt-3 space-y-3 text-sm text-indigo">
                  <p>
                    Short link: https://{shortHost}/{shortLink.slug}
                  </p>
                  {slugHistory.length ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-indigo">Earlier names</p>
                      <ul className="space-y-1 text-xs text-muted">
                        {slugHistory.map((row) => (
                          <li key={row.id}>
                            /{row.slug} {row.redirect ? `redirects to /${shortLink.slug}` : "redirect off"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p className="text-xs text-muted">
                    This short link is the referral link. A new account that starts from it is logged with the reward admin
                    saved.
                  </p>
                  {referrals.length === 0 ? (
                    <p className="text-xs text-muted">No referral registrations yet.</p>
                  ) : (
                    <ul className="space-y-1 text-xs text-muted">
                      {referrals.map((row) => {
                        const reward = referralRewardLabel(row);
                        return (
                          <li key={row.id}>
                            {row.referredEmail}
                            {reward ? ` · ${reward}` : ""}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {linkLimits?.standardQr || linkLimits?.dynamicQr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/qr/${draft.slug}?size=160&logo=0`} alt="Influencer Card QR" width={160} height={160} />
                  ) : null}
                  {shortLink.nfcIdentities[0] ? (
                    <div className="space-y-2">
                      <p>
                        NFC URL: https://{shortHost}/n/{shortLink.nfcIdentities[0].token}
                      </p>
                      <NfcWriter url={`https://${shortHost}/n/${shortLink.nfcIdentities[0].token}`} />
                      <p className="text-xs text-muted">
                        A tap opens the current destination. Changing the destination does not require writing the tag again.{" "}
                        <Link href="/faq?audience=creator#nfc-write" className="font-semibold text-violet hover:underline">
                          NFC instructions
                        </Link>
                      </p>
                    </div>
                  ) : null}
                  {linkLimits?.customAlias ? (
                    <div className="space-y-2">
                      {params.confirmSlug && params.confirmSlug !== shortLink.slug ? (
                        <form action={actionChangeShortSlug} className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                          <p className="text-xs font-semibold text-indigo">Confirm short link change</p>
                          <p className="text-xs text-muted">{slugChangeWarning(shortLink.slug, params.confirmSlug)}</p>
                          <input type="hidden" name="slug" value={params.confirmSlug} />
                          <input type="hidden" name="acknowledged" value="1" />
                          <div className="flex flex-wrap gap-2">
                            <button type="submit" className="btn-secondary !py-1.5 text-xs">
                              Yes, change to /{params.confirmSlug}
                            </button>
                            <Link href="/dashboard/links" className="btn-secondary !py-1.5 text-xs">
                              Cancel
                            </Link>
                          </div>
                        </form>
                      ) : (
                        <form action={actionChangeShortSlug} className="space-y-2">
                          <p className="text-xs text-muted">
                            Changing this name keeps the printed QR. You will confirm before the old name starts redirecting
                            to the new one.
                          </p>
                          <input
                            name="slug"
                            defaultValue={shortLink.slug}
                            className="w-full max-w-xs rounded-xl border border-border px-3 py-2"
                          />
                          <button type="submit" className="btn-secondary !py-1.5 text-xs">
                            Update short link
                          </button>
                        </form>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted">A custom short name follows the plan entitlement.</p>
                  )}
                  {linkLimits?.dynamicQr && shortLink.dynamic ? (
                    <div className="space-y-3 border-t border-border pt-3">
                      <div>
                        <p className="font-semibold text-indigo">Dynamic destination</p>
                        <p className="mt-1 text-xs text-muted">
                          This plan can change where the short link and QR resolve without reprinting the QR. Paths stay on
                          Influrios; https hosts must be allow-listed by admin.
                        </p>
                      </div>
                      <p className="text-xs text-muted">
                        Current: <span className="font-semibold text-indigo">{shortLink.destination}</span>
                      </p>
                      <form action={actionSetDynamicDestination} className="space-y-2">
                        <input
                          name="destination"
                          defaultValue={shortLink.destination}
                          placeholder={`/c/${draft.slug} or https://influrios.com/...`}
                          className="w-full max-w-md rounded-xl border border-border px-3 py-2"
                        />
                        <button type="submit" className="btn-secondary !py-1.5 text-xs">
                          Update destination
                        </button>
                      </form>
                      {destinationHistory.length ? (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-indigo">Recent changes</p>
                          <ul className="space-y-1 text-xs text-muted">
                            {destinationHistory.map((row) => (
                              <li key={row.id}>
                                {row.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {row.reason} ·{" "}
                                {row.previousDestination} → {row.destination}
                              </li>
                            ))}
                          </ul>
                          <form action={actionRollbackDynamicDestination}>
                            <button type="submit" className="btn-secondary !py-1.5 text-xs">
                              Roll back to prior destination
                            </button>
                          </form>
                        </div>
                      ) : null}
                      <form action={actionScheduleDestination} className="space-y-2">
                        <p className="text-xs font-semibold text-indigo">Schedule a destination</p>
                        <p className="text-xs text-muted">
                          The change applies at the chosen time. The QR and NFC tokens stay the same. One pending change at a time.
                        </p>
                        <input
                          name="destination"
                          placeholder={`/c/${draft.slug} or https://influrios.com/...`}
                          className="w-full max-w-md rounded-xl border border-border px-3 py-2"
                        />
                        <ScheduleStartsField />
                        <button type="submit" className="btn-secondary !py-1.5 text-xs">
                          Schedule destination
                        </button>
                      </form>
                      {pendingSchedules.length ? (
                        <ul className="space-y-2 text-xs text-muted">
                          {pendingSchedules.map((row) => (
                            <li key={row.id} className="flex flex-wrap items-center gap-2">
                              <span>
                                {row.startsAt.toISOString().slice(0, 16).replace("T", " ")} UTC → {row.destination}
                              </span>
                              <form action={actionCancelSchedule}>
                                <input type="hidden" name="scheduleId" value={row.id} />
                                <button type="submit" className="btn-secondary !py-0.5 text-[11px]">
                                  Cancel
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="space-y-3 border-t border-border pt-3">
                    <div>
                      <p className="font-semibold text-indigo">Campaign links</p>
                      <p className="mt-1 text-xs text-muted">
                        A campaign link is https://{shortHost}/c/your-code and keeps its own destination. Visits are counted on this short link. This plan allows {campaignMax} campaign {campaignMax === 1 ? "link" : "links"}. That number is a plan feature, separate from the profile short link.
                      </p>
                    </div>
                    {campaignLinks.length ? (
                      <ul className="space-y-2">
                        {campaignLinks.map((row) => (
                          <li key={row.id} className="rounded-xl border border-border p-3 text-xs">
                            <p className="font-semibold text-indigo">
                              https://{shortHost}/c/{row.code} · {row.label} · {row.status}
                            </p>
                            <p className="mt-1 text-muted">{row.destination}</p>
                            <form action={actionSetCampaignLinkStatus} className="mt-2">
                              <input type="hidden" name="campaignId" value={row.id} />
                              <input type="hidden" name="status" value={row.status === "active" ? "suspended" : "active"} />
                              <button type="submit" className="btn-secondary !py-1 text-xs">
                                {row.status === "active" ? "Suspend" : "Activate"}
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {campaignRoom ? (
                      <form action={actionCreateCampaignLink} className="space-y-2">
                        <input
                          name="code"
                          placeholder="spring-launch"
                          className="w-full max-w-xs rounded-xl border border-border px-3 py-2"
                        />
                        <input
                          name="label"
                          placeholder="Spring launch"
                          className="w-full max-w-md rounded-xl border border-border px-3 py-2"
                        />
                        <input
                          name="destination"
                          placeholder={`/c/${draft.slug} or https://influrios.com/...`}
                          className="w-full max-w-md rounded-xl border border-border px-3 py-2"
                        />
                        <button type="submit" className="btn-secondary !py-1.5 text-xs">
                          Add campaign link
                        </button>
                      </form>
                    ) : (
                      <p className="text-xs text-muted">
                        {campaignLinks.length
                          ? `All ${campaignMax} campaign ${campaignMax === 1 ? "link" : "links"} on this plan are in use.`
                          : "This plan’s campaign-link count is 0. An admin can raise it without changing the short link."}
                      </p>
                    )}
                  </div>
                </div>
              ) : shortLink ? (
                <div className="mt-3 space-y-2 text-sm text-indigo">
                  <p>
                    Short link: https://{shortHost}/{shortLink.slug}
                  </p>
                  <p className="text-xs text-muted">This short link is suspended. The QR identity is unchanged.</p>
                  {shortLink.qrIdentities[0] ? (
                    <p className="text-xs text-muted">
                      QR: https://{shortHost}/q/{shortLink.qrIdentities[0].token}
                    </p>
                  ) : null}
                  {slugHistory.length ? (
                    <ul className="space-y-1 text-xs text-muted">
                      {slugHistory.map((row) => (
                        <li key={row.id}>
                          /{row.slug} {row.redirect ? `redirects to /${shortLink.slug}` : "redirect off"}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  This plan uses the canonical profile link. A short link and QR appear when the plan entitlements include them.
                </p>
              )}
            </section>

            {linkAnalytics?.ok ? (
              <section className="card-surface p-6">
                <h2 id="analytics" className="font-display text-xl font-bold text-indigo">Link analytics</h2>
                <p className="mt-2 text-sm text-muted">
                  Privacy-safe totals for your short link and QR. Depth follows your plan entitlement (
                  {linkAnalytics.analytics.level}). Precise location is never stored.
                </p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">Total visits</dt>
                    <dd className="font-display text-2xl font-bold text-indigo">{linkAnalytics.analytics.totalVisits}</dd>
                  </div>
                  {linkAnalytics.analytics.qrScans != null ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">QR scans</dt>
                      <dd className="font-display text-2xl font-bold text-indigo">{linkAnalytics.analytics.qrScans}</dd>
                    </div>
                  ) : null}
                  {linkAnalytics.analytics.directVisits != null ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">Direct short-link visits</dt>
                      <dd className="font-display text-2xl font-bold text-indigo">{linkAnalytics.analytics.directVisits}</dd>
                    </div>
                  ) : null}
                  {linkAnalytics.analytics.ctaClicks != null ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">Card CTA clicks</dt>
                      <dd className="font-display text-2xl font-bold text-indigo">{linkAnalytics.analytics.ctaClicks}</dd>
                    </div>
                  ) : null}
                  {linkAnalytics.analytics.inquiryConversions != null ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">Inquiry conversions</dt>
                      <dd className="font-display text-2xl font-bold text-indigo">
                        {linkAnalytics.analytics.inquiryConversions}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {linkAnalytics.analytics.deviceClasses || linkAnalytics.analytics.referrerClasses ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm text-indigo">
                    {linkAnalytics.analytics.deviceClasses ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Device class</p>
                        <ul className="mt-1 space-y-1">
                          {Object.entries(linkAnalytics.analytics.deviceClasses as Record<string, number>).map(
                            ([key, count]) => (
                            <li key={key}>
                              {key}: {count}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {linkAnalytics.analytics.referrerClasses ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Referrer class</p>
                        <ul className="mt-1 space-y-1">
                          {Object.entries(linkAnalytics.analytics.referrerClasses as Record<string, number>).map(
                            ([key, count]) => (
                            <li key={key}>
                              {key}: {count}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : null}

    </div>
  );
}
