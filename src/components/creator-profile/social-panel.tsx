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
  authorizeReport?: string | null;
  authorizeRedirect?: string | null;
  sandboxClient?: boolean;
  scopes?: string | null;
  consentDetail?: string | null;
  loginMode?: string | null;
  metricLabels?: { primary: string; secondary: string };
  audienceStatus?: "synced" | "unavailable" | "idle";
};

function audienceLine(account: SocialAccount) {
  const labels = account.metricLabels ?? { primary: "followers", secondary: "likes" };
  if (account.status === "connected" && account.live && account.followers != null) {
    if (account.likes != null) {
      return `${formatFollowers(account.followers)} ${labels.primary} · ${formatFollowers(account.likes)} ${labels.secondary}`;
    }
    return `${formatFollowers(account.followers)} ${labels.primary}`;
  }
  if (account.status === "connected") {
    return account.audienceStatus === "unavailable"
      ? "Connected · audience stats unavailable"
      : "Connected";
  }
  return account.ready ? "Not connected" : "Not ready in admin";
}

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
      <h2 id="socials" className="font-display text-xl font-bold text-indigo">
        Social accounts
      </h2>
      <p className="mt-1 text-sm text-muted">
        Connecting authorizes Influrios to identify the account. Audience statistics appear only when that network
        returns them — missing counts no longer undo the connection.
      </p>
      {params.social === "synced" ? (
        <p className="mt-3 text-sm font-semibold text-emerald-700">Connected and audience statistics were synced.</p>
      ) : null}
      {params.social === "connected" ? (
        <p className="mt-3 text-sm font-semibold text-emerald-700">
          Connected. If audience statistics are missing, use Sync now after setup is complete.
        </p>
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
                  <p className="text-xs text-muted">{audienceLine(account)}</p>
                </div>
                {account.lastError && !account.lastError.startsWith("Last authorize request") ? (
                  <p className="mt-2 text-xs text-amber-800">
                    {connected ? "Audience sync note: " : ""}
                    {account.lastError}
                  </p>
                ) : null}
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
                    {account.loginMode === "unified_config" ? (
                      <p className="w-full text-xs text-muted">
                        Connect opens <span className="font-semibold text-indigo">Facebook / Meta Unified Login</span>{" "}
                        (not the Instagram website). That is required for newer Meta apps that only support Unified
                        Login Configuration IDs.
                      </p>
                    ) : null}
                    <label className="flex items-start gap-2 text-xs text-indigo">
                      <input type="checkbox" name="acceptTerms" className="mt-0.5 accent-violet" required />
                      <span>
                        I acknowledge the Connected Social Data & API Policy and authorize Influrios to start the{" "}
                        {account.name} connection
                        {account.consentDetail
                          ? ` via ${account.consentDetail}`
                          : account.scopes
                            ? ` for: ${account.scopes}`
                            : ""}
                        . This is not granted by the Influencer Terms.
                      </span>
                    </label>
                    <button type="submit" className="btn-primary !py-1.5 text-xs">
                      Connect {account.name}
                    </button>
                    {account.sandboxClient && account.authorizeRedirect ? (
                      <p className="w-full text-xs leading-relaxed text-indigo">
                        This client key is a TikTok sandbox key. In the sandbox, open Login Kit → Web and register this URL,
                        including the final slash. Add the TikTok account as a target user:{" "}
                        <code className="font-semibold">{account.authorizeRedirect}</code>
                      </p>
                    ) : null}
                    {account.authorizeReport ? (
                      <p className="w-full font-mono text-[11px] leading-relaxed text-indigo [overflow-wrap:anywhere]">
                        {account.authorizeReport}
                      </p>
                    ) : null}
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
