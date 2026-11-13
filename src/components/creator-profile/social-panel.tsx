"use client";

import { useState } from "react";
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
  syncedAt?: string | null;
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
  manualRetry = false,
}: {
  social: { creatorId?: string | null; accounts: SocialAccount[] } | null;
  flash?: { social?: string };
  manualRetry?: boolean;
}) {
  const [manage, setManage] = useState<string | null>(null);
  if (!social) {
    return <p className="text-sm text-muted">Social connection state is unavailable right now.</p>;
  }
  const params = flash ?? {};
  const selected = social.accounts.find((account) => account.platform === manage) ?? null;
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
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-[#98A2B3]">
              <tr>
                <th className="py-2 pr-3 font-semibold">Platform</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 pr-3 font-semibold">Details</th>
                <th className="py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {social.accounts.map((account) => {
                const connected = account.status === "connected";
                return (
                  <tr key={account.platform} className="border-t border-[#EEF2F7]">
                    <td className="py-3 pr-3 font-semibold text-[#1B1464]">{account.name}</td>
                    <td className="py-3 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${connected ? "bg-emerald-50 text-emerald-700" : "bg-[#F4F6FB] text-[#667085]"}`}>
                        {connected ? "Connected" : "Not connected"}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-xs text-[#667085]">
                      {audienceLine(account)}
                      {account.syncedAt ? ` · Last sync ${account.syncedAt.slice(0, 16).replace("T", " ")}` : connected ? " · Last sync not available" : ""}
                    </td>
                    <td className="py-3">
                      <button type="button" onClick={() => setManage(account.platform)} className="rounded-full border border-[#E4E9F5] px-3 py-1.5 text-xs font-semibold text-[#6D4AFF]">
                        {connected ? "Reconnect" : "Connect"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {selected ? (
            <div className="fixed inset-0 z-50">
              <button type="button" aria-label="Close connection" className="absolute inset-0 bg-[#1B1464]/40" onClick={() => setManage(null)} />
              <div role="dialog" aria-modal="true" className="absolute left-1/2 top-1/2 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-xl font-bold text-[#1B1464]">Manage {selected.name}</h3>
                  <button type="button" aria-label="Close" onClick={() => setManage(null)} className="text-xl text-[#667085]">×</button>
                </div>
                <p className="mt-2 text-sm text-[#667085]">{audienceLine(selected)}</p>
                {selected.lastError && !selected.lastError.startsWith("Last authorize request") ? (
                  <p className="mt-2 text-xs text-amber-800">{selected.lastError}</p>
                ) : null}
                {selected.status === "connected" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <form action={actionRefreshSocial}>
                      <input type="hidden" name="platform" value={selected.platform} />
                      <button type="submit" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">Sync</button>
                    </form>
                    <form action={actionConnectSocial}>
                      <input type="hidden" name="platform" value={selected.platform} />
                      <input type="hidden" name="acceptTerms" value="on" />
                      <button type="submit" className="rounded-full border border-[#E4E9F5] px-4 py-2 text-sm font-semibold text-[#1B1464]">Reconnect</button>
                    </form>
                    <form action={actionDisconnectSocial}>
                      <input type="hidden" name="platform" value={selected.platform} />
                      <button type="submit" className="rounded-full border border-[#E4E9F5] px-4 py-2 text-sm font-semibold text-[#1B1464]">Disconnect</button>
                    </form>
                  </div>
                ) : selected.ready ? (
                  <form action={actionConnectSocial} className="mt-4 space-y-3">
                    <input type="hidden" name="platform" value={selected.platform} />
                    <label className="flex items-start gap-2 text-xs text-indigo">
                      <input type="checkbox" name="acceptTerms" className="mt-0.5 accent-violet" required />
                      <span>
                        I acknowledge the{" "}
                        <Link href="/legal/connected-social-data-policy" className="font-semibold underline" target="_blank">
                          Connected Social Data & API Policy
                        </Link>{" "}
                        and authorize this connection. A typed handle is not verification.
                      </span>
                    </label>
                    <button type="submit" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
                      {manualRetry ? `Retry ${selected.name}` : "Connect"}
                    </button>
                  </form>
                ) : (
                  <p className="mt-4 text-sm text-[#667085]">This network is not ready for a new connection.</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
