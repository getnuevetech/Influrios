import Link from "next/link";
import { actionConnectSocial, actionDisconnectSocial, actionRefreshSocial } from "@/app/dashboard/social-actions";
import { formatFollowers } from "@/lib/seed-data";

type SocialAccount = {
  platform: string;
  name: string;
  status: string;
  ready: boolean;
  live?: boolean;
  followers?: number | null;
  likes?: number | null;
  lastError?: string | null;
  scopes?: string | null;
};

export function SocialConnectionsPanel({
  social,
  flash,
}: {
  social: { creatorId?: string | null; accounts: SocialAccount[] } | null;
  flash?: { social?: string };
}) {
  if (!social) {
    return <p className="text-sm text-muted">Social connection state is unavailable right now.</p>;
  }
  const params = flash ?? {};
  return (
    <section className="card-surface p-6">
              <h2 id="socials" className="font-display text-xl font-bold text-indigo">Social accounts</h2>
              <p className="mt-1 text-sm text-muted">
                Connecting a network does not change the profile layout. Follower and like counts replace the current
                figure only after that network returns both.
              </p>
              {params.social === "connected" || params.social === "synced" ? (
                <p className="mt-3 text-sm font-semibold text-emerald-700">The network returned a follower count and likes.</p>
              ) : null}
              {params.social === "disconnected" ? (
                <p className="mt-3 text-sm font-semibold text-emerald-700">Disconnected. Further sync has stopped.</p>
              ) : null}
              {!social.creatorId ? (
                <p className="mt-4 text-sm text-muted">Publish your card before connecting a network.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {social.accounts.some((account) => account.ready && account.status !== "connected") ? (
                    <div className="rounded-xl bg-lavender/40 p-4 text-sm text-indigo">
                      <p className="font-semibold">Before the network login</p>
                      <p className="mt-2">
                        Accepting the Influencer Terms does not authorize a social account. This step explains the permissions
                        and asks you to acknowledge the{" "}
                        <Link href="/legal/connected-social-data-policy" className="font-semibold underline" target="_blank">
                          Connected Social Data & API Policy
                        </Link>
                        . The{" "}
                        <Link href="/legal/social-platform-integration-terms" className="font-semibold underline" target="_blank">
                          Social Platform Integration Terms
                        </Link>{" "}
                        stay a separate agreement.
                      </p>
                    </div>
                  ) : null}
                  {social.accounts.map((account) => {
                    const connected = account.status === "connected";
                    return (
                      <div key={account.platform} className="rounded-xl border border-border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-indigo">{account.name}</p>
                            {connected ? (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800">
                                Connected
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted">
                            {connected && account.live && account.followers != null && account.likes != null
                              ? `${formatFollowers(account.followers)} followers · ${formatFollowers(account.likes)} likes`
                              : connected
                                ? account.live
                                  ? "Connected · waiting for follower and like counts"
                                  : "Connected"
                                : account.ready
                                  ? "Not connected"
                                  : "Not ready in admin"}
                          </p>
                        </div>
                        {account.lastError ? <p className="mt-2 text-xs text-amber-800">{account.lastError}</p> : null}
                        {connected ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <form action={actionRefreshSocial}>
                              <input type="hidden" name="platform" value={account.platform} />
                              <button type="submit" className="btn-secondary !py-1.5 text-xs">
                                Sync now
                              </button>
                            </form>
                            <form action={actionDisconnectSocial}>
                              <input type="hidden" name="platform" value={account.platform} />
                              <button type="submit" className="btn-secondary !py-1.5 text-xs">
                                Disconnect
                              </button>
                            </form>
                          </div>
                        ) : account.ready ? (
                          <form action={actionConnectSocial} className="mt-3 flex flex-wrap items-center gap-3">
                            <input type="hidden" name="platform" value={account.platform} />
                            <label className="flex items-start gap-2 text-xs text-indigo">
                              <input type="checkbox" name="acceptTerms" className="mt-0.5 accent-violet" required />
                              <span>
                                I acknowledge the Connected Social Data & API Policy and authorize Influrios to start the{" "}
                                {account.name} login
                                {account.scopes ? ` for: ${account.scopes}` : ""}. This is not granted by the Influencer
                                Terms.
                              </span>
                            </label>
                            <button type="submit" className="btn-primary !py-1.5 text-xs">
                              Connect {account.name}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
  );
}
