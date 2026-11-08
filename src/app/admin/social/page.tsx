import Link from "next/link";
import {
  actionSaveMetaWebhook,
  actionSaveSocialNetwork,
  actionSaveSocialPolicy,
} from "@/app/admin/social/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { getMetaWebhookConfig, metaWebhookPath } from "@/lib/meta-webhook";
import { callbackAbsoluteUrl, callbackPath, getSocialPolicy, listSocialNetworks } from "@/lib/social-connect";

export const dynamic = "force-dynamic";
export const metadata = { title: "Social networks · Admin" };

const inputClass = "mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal";

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminSocialPage({ searchParams }: Props) {
  const session = await requireAdminPage("social");
  const canEdit = hasPermission(session, "social.edit");
  const params = await searchParams;
  let policy: Awaited<ReturnType<typeof getSocialPolicy>> | null = null;
  let networks: Awaited<ReturnType<typeof listSocialNetworks>> = [];
  let metaWebhook: Awaited<ReturnType<typeof getMetaWebhookConfig>> | null = null;
  let dbError = false;
  try {
    [policy, networks, metaWebhook] = await Promise.all([
      getSocialPolicy(),
      listSocialNetworks(),
      getMetaWebhookConfig(),
    ]);
  } catch (error) {
    console.error("admin social", error);
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Social networks</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Each network stays off until a client id and secret are saved and the provider is enabled. OAuth endpoints and
        permission scopes are locked in code — do not paste arbitrary Meta permission names. Audience statistics sync
        separately after a successful login. A creator must accept the current terms before Influrios starts that
        network&apos;s login.
      </p>
      <p className="mt-2 text-sm text-muted">
        OAuth redirect path: <span className="font-semibold text-indigo">{callbackPath()}</span>
      </p>
      <p className="mt-1 text-sm text-muted">
        Paste this <span className="font-semibold text-indigo">exact</span> URL into Google / Meta / TikTok authorized
        redirect URIs (https, no trailing slash):{" "}
        <code className="rounded bg-[#F1ECFF] px-1.5 py-0.5 text-xs font-semibold text-violet">{callbackAbsoluteUrl()}</code>
      </p>
      <p className="mt-2 text-sm text-muted">
        Meta webhook path: <span className="font-semibold text-indigo">{metaWebhookPath()}</span>
      </p>
      <p className="mt-1 text-sm text-muted">
        Paste this into Meta → Instagram → Configure webhooks (not the OAuth redirect URI):{" "}
        <code className="rounded bg-[#F1ECFF] px-1.5 py-0.5 text-xs font-semibold text-violet">
          {metaWebhook?.webhookUrl ?? "https://influrios.com/api/social/meta/webhook"}
        </code>
      </p>
      {params.saved ? <p className="mt-4 text-sm font-semibold text-emerald-700">Saved.</p> : null}
      {params.error ? <p className="mt-4 text-sm font-semibold text-amber-800">{params.error}</p> : null}
      {dbError ? <p className="mt-4 text-sm text-amber-800">The database is unavailable.</p> : null}

      {metaWebhook ? (
        <form action={actionSaveMetaWebhook} className="mt-6 grid gap-3 rounded-2xl border border-[#E4EBFF] bg-white p-4">
          <h2 className="font-display text-lg font-bold text-indigo">Meta / Instagram Unified Login · Webhooks</h2>
          <p className="text-sm text-muted">
            Your Meta app uses <span className="font-semibold">API setup with Unified login</span>. OAuth{" "}
            <span className="font-semibold">requires</span> a <code className="text-xs">config_id</code> on the
            Facebook and Instagram rows below — without it Meta shows{" "}
            <span className="font-semibold">Invalid parameter: config_id is required</span> (Development and Live).
            Webhooks are separate: Meta GETs the callback with your verify token; Influrios returns{" "}
            <code className="text-xs">hub.challenge</code> as plain text.
          </p>
          <div className="grid gap-2 rounded-xl bg-[#F8F6FF] px-3 py-2 text-xs text-indigo sm:grid-cols-2">
            <p>
              OAuth callback (read-only):{" "}
              <code className="font-semibold text-violet">{callbackAbsoluteUrl()}</code>
            </p>
            <p>
              Webhook URL (read-only):{" "}
              <code className="font-semibold text-violet">{metaWebhook.webhookUrl}</code>
            </p>
            <p>
              Webhook verify token:{" "}
              <span className="font-semibold">
                {metaWebhook.verifyTokenStatus === "saved" ? "Configured ✓" : "Missing — Meta Verify and save will fail"}
              </span>
            </p>
            <p>
              Meta app secret for signatures:{" "}
              <span className="font-semibold">
                {metaWebhook.appSecretStatus === "saved" ? "Configured ✓" : "Missing (optional until POST events)"}
              </span>
            </p>
          </div>
          <p className="text-xs text-amber-900">
            Do <span className="font-semibold">not</span> paste a Meta access token (values starting with{" "}
            <code>EAA…</code>). Create a private string, e.g.{" "}
            <code className="text-[11px]">openssl rand -hex 32</code>, save it here, then paste the{" "}
            <span className="font-semibold">same</span> string into Meta → Configure webhooks → Verify token. If an
            access token was pasted into Meta already, revoke/regenerate it.
          </p>
          {metaWebhook.verifyTokenStatus === "saved" ? (
            <p className="text-xs text-muted">
              After saving, probe locally should return only <code>123456</code>:{" "}
              <code className="break-all text-[11px]">
                {metaWebhook.webhookUrl}?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=123456
              </code>
            </p>
          ) : (
            <p className="text-xs text-amber-900">
              Production currently answers <code>503 Meta webhook verify token is not configured</code> until you save a
              verify token here. That is why Meta shows “callback URL or verify token couldn&apos;t be validated”.
            </p>
          )}
          <label className="block text-sm font-semibold text-indigo">
            Verify token ({metaWebhook.verifyTokenStatus})
            <input
              name="verifyToken"
              type="password"
              placeholder="Private string you create — not an EAA… access token"
              disabled={!canEdit}
              className={inputClass}
              autoComplete="off"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
            <input type="checkbox" name="clearVerifyToken" value="1" disabled={!canEdit} />
            Clear saved verify token
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Meta app secret override ({metaWebhook.appSecretStatus})
            <input
              name="appSecret"
              type="password"
              placeholder="Optional — leave blank to use Instagram/Facebook client secret"
              disabled={!canEdit}
              className={inputClass}
              autoComplete="off"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
            <input type="checkbox" name="clearAppSecret" value="1" disabled={!canEdit} />
            Clear Meta app secret override
          </label>
          {canEdit ? (
            <button type="submit" className="btn-primary w-fit">
              Save Meta webhook settings
            </button>
          ) : null}
        </form>
      ) : null}

      <section className="mt-6 grid gap-3 rounded-2xl border border-[#E4EBFF] bg-white p-4">
        <h2 className="font-display text-lg font-bold text-indigo">Meta Live · normal creator testing</h2>
        <p className="text-sm text-muted">
          While the Meta app is in <span className="font-semibold">Development</span>, only Facebook users with an{" "}
          <span className="font-semibold">App Role</span> (Admin / Developer / Tester) can complete Instagram or
          Facebook Connect. A normal Influrios creator account is not enough by itself.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-indigo">
          <li>
            <span className="font-semibold">Fast path (still Development):</span> Meta → App roles → add the creator’s
            Facebook user as <span className="font-semibold">Tester</span> (they must accept the invite). Then connect
            from that creator’s Influrios account. This validates the Influrios flow, not public Live access.
          </li>
          <li>
            <span className="font-semibold">True Live / any creator:</span> Meta → App Review → request{" "}
            <span className="font-semibold">Advanced Access</span> for every permission in your Login configurations
            (at least <code className="text-[11px]">instagram_basic</code> / insights as configured,{" "}
            <code className="text-[11px]">pages_show_list</code>, <code className="text-[11px]">pages_read_engagement</code>
            ). Complete privacy policy, terms, and data-use questions.
          </li>
          <li>
            After Advanced Access is approved, Meta → Publish / switch the app to{" "}
            <span className="font-semibold">Live</span>. Development → Live does not replace App Review.
          </li>
          <li>
            Confirm Influrios Admin → Social has the same <span className="font-semibold">Meta App ID / Secret</span>,{" "}
            <span className="font-semibold">Configuration IDs</span>, and OAuth redirect{" "}
            <code className="text-[11px]">{callbackAbsoluteUrl()}</code> that Meta has whitelisted.
          </li>
          <li>
            Test with a creator whose Facebook user is <span className="font-semibold">not</span> an App Role: Connect
            Instagram, share an IG Professional asset; Connect Facebook, share a Page; then Sync now.
          </li>
        </ol>
        <p className="text-xs text-muted">
          YouTube is separate (Google Cloud OAuth). Put the OAuth client in Production and add the test Google account
          as a test user while the consent screen is in Testing, or publish the consent screen for any Google account.
        </p>
      </section>

      {policy ? (
        <form action={actionSaveSocialPolicy} className="mt-6 grid gap-3 rounded-2xl border border-[#E4EBFF] bg-white p-4">
          <h2 className="font-display text-lg font-bold text-indigo">Influencer agreement</h2>
          <p className="text-sm text-muted">
            Change the version whenever the terms or policy text changes. Existing connections must be accepted again
            before the next sync.
          </p>
          <label className="block text-sm font-semibold text-indigo">
            Version
            <input name="version" defaultValue={policy.version} disabled={!canEdit} className={inputClass} />
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Terms
            <textarea name="termsText" rows={4} defaultValue={policy.termsText} disabled={!canEdit} className={inputClass} />
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Policy
            <textarea name="policyText" rows={4} defaultValue={policy.policyText} disabled={!canEdit} className={inputClass} />
          </label>
          {canEdit ? <button type="submit" className="btn-primary w-fit">Save terms</button> : null}
        </form>
      ) : null}

      <section className="mt-8 space-y-4">
        <h2 className="font-display text-lg font-bold text-indigo">Networks</h2>
        {networks.map((network) => (
          <form key={network.code} action={actionSaveSocialNetwork} className="grid gap-3 rounded-2xl border border-[#E4EBFF] bg-white p-4 sm:grid-cols-2">
            <input type="hidden" name="code" value={network.code} />
            <div className="sm:col-span-2">
              <p className="font-semibold text-indigo">{network.name}</p>
              <p className="text-xs text-muted">
                {network.ready ? "Ready for creator consent and login" : "Not ready — no live sync"} · secret{" "}
                {network.secret}
              </p>
            </div>
            <label className="block text-sm font-semibold text-indigo sm:col-span-2">
              {network.code === "instagram"
                ? network.configId || !network.classicInstagramLogin
                  ? "Meta App ID (App settings → Basic — not Configuration ID)"
                  : "Instagram App ID (not the Meta App ID)"
                : network.code === "facebook"
                  ? "Meta App ID (App settings → Basic — not Configuration ID)"
                  : "Client id"}
              <input
                name="clientId"
                defaultValue={network.clientId}
                disabled={!canEdit}
                className={inputClass}
                placeholder={
                  network.supportsConfigId
                    ? "Numeric Meta App ID, or paste the Meta login URL (client_id is extracted)"
                    : undefined
                }
                autoComplete="off"
              />
            </label>
            {network.supportsConfigId ? (
              <p className="sm:col-span-2 -mt-2 text-xs text-muted">
                Meta’s <span className="font-semibold">“Invalid app ID”</span> means this field is wrong: use the App ID
                from <span className="font-semibold">App settings → Basic</span>. Do not paste the Configuration ID or
                App Secret here.
              </p>
            ) : null}
            <label className="block text-sm font-semibold text-indigo sm:col-span-2">
              {network.code === "instagram"
                ? network.configId || !network.classicInstagramLogin
                  ? `Meta App Secret (${network.secret})`
                  : `Instagram App Secret (${network.secret})`
                : network.code === "facebook"
                  ? `Meta App Secret (${network.secret})`
                  : `Client secret (${network.secret})`}
              <input name="secret" type="password" placeholder="Leave blank to keep the saved secret" disabled={!canEdit} className={inputClass} />
            </label>
            <div className="sm:col-span-2 rounded-xl bg-[#F8F6FF] px-3 py-2 text-xs text-muted">
              <p>
                <span className="font-semibold text-indigo">Authorize</span>{" "}
                <code className="text-[11px]">{network.authorizeUrl}</code>
              </p>
              <p className="mt-1">
                <span className="font-semibold text-indigo">Token</span>{" "}
                <code className="text-[11px]">{network.tokenUrl}</code>
              </p>
              <p className="mt-1">
                <span className="font-semibold text-indigo">Profile</span>{" "}
                <code className="text-[11px]">{network.profileUrl}</code>
              </p>
              <p className="mt-1">
                <span className="font-semibold text-indigo">Locked scopes</span>{" "}
                <code className="text-[11px]">{network.scopes}</code>
              </p>
            </div>
            {network.supportsConfigId ? (
              <label className="block text-sm font-semibold text-indigo sm:col-span-2">
                {network.code === "instagram"
                  ? "Unified Login · Configuration ID (required — Meta error without it: config_id is required)"
                  : "Facebook Login for Business · Configuration ID (required)"}
                <input
                  name="configId"
                  defaultValue={network.configId}
                  disabled={!canEdit}
                  className={inputClass}
                  placeholder="Paste config_id or the full Meta login URL that contains config_id="
                  autoComplete="off"
                  required={network.enabled && !(network.code === "instagram" && network.classicInstagramLogin)}
                />
              </label>
            ) : null}
            {network.supportsConfigId ? (
              <label className="flex items-center gap-2 text-sm font-semibold text-indigo sm:col-span-2">
                <input type="checkbox" name="clearConfigId" value="1" disabled={!canEdit} />
                Clear saved Configuration ID
              </label>
            ) : null}
            {network.code === "instagram" ? (
              <label className="flex items-center gap-2 text-sm font-semibold text-indigo sm:col-span-2">
                <input
                  type="checkbox"
                  name="classicInstagramLogin"
                  value="1"
                  defaultChecked={network.classicInstagramLogin}
                  disabled={!canEdit}
                />
                Use classic Instagram Login (legacy Instagram App ID only — leave Configuration ID empty)
              </label>
            ) : null}
            {network.code === "facebook" ? (
              <p className="sm:col-span-2 text-xs text-muted">
                Connects a <span className="font-semibold">Facebook Page</span> via{" "}
                <code className="text-[11px]">/me/accounts</code>. Use the same{" "}
                <span className="font-semibold">Meta App ID / Secret</span> as Instagram Unified Login, plus a
                Configuration ID that includes <code className="text-[11px]">{network.configPermissions}</code>. The
                configuration’s redirect URI must be{" "}
                <code className="text-[11px]">{callbackAbsoluteUrl()}</code>. “The network did not return an access
                token” usually means the Facebook row’s App Secret is wrong, or that configuration’s redirect URI does
                not match.
              </p>
            ) : null}
            {network.code === "instagram" ? (
              <p className="sm:col-span-2 text-xs text-muted">
                {network.configId ? (
                  <>
                    <span className="font-semibold text-indigo">Active mode: Unified Login.</span> “Connect Instagram”
                    opens the <span className="font-semibold">Facebook / Meta</span> dialog with{" "}
                    <code className="text-[11px]">config_id</code>.{" "}
                    <code className="text-[11px]">client_id</code> must be the{" "}
                    <span className="font-semibold">Meta App ID</span> from App settings → Basic (same app that owns the
                    configuration). If Meta shows <span className="font-semibold">Invalid app ID</span>, the App ID
                    field still has a Configuration ID, Instagram App ID, or secret.
                  </>
                ) : network.classicInstagramLogin ? (
                  <>
                    <span className="font-semibold text-indigo">Active mode: classic Instagram Login.</span> Connect uses{" "}
                    <code className="text-[11px]">www.instagram.com/oauth/authorize</code> with the{" "}
                    <span className="font-semibold">Instagram App ID</span> (not the Meta App ID). Newer Meta apps that
                    only offer Unified Login will fail — uncheck classic login and paste a Configuration ID instead.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-indigo">Configuration ID required.</span> Meta’s{" "}
                    <span className="font-semibold">“config_id is required”</span> error means this field is empty.
                    Paste the Configuration ID before enabling Instagram Connect.
                  </>
                )}
              </p>
            ) : null}
            {network.code === "tiktok" ? (
              <p className="sm:col-span-2 text-xs text-muted">
                TikTok Login Kit requires this exact redirect URI (https, no trailing slash, no{" "}
                <code className="text-[11px]">www</code>):{" "}
                <code className="text-[11px]">{callbackAbsoluteUrl()}</code>. Connect sends it form-urlencoded, which
                TikTok decodes before comparing. Paste that plain URL under Login Kit → Redirect URI, not only under
                the website URL. A TikTok page that says{" "}
                <span className="font-semibold">correct the following: redirect_uri</span> means the Login Kit value is
                different. Profile sync calls{" "}
                <code className="text-[11px]">
                  /v2/user/info/?fields=open_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count
                </code>
                . Scopes stay <code className="text-[11px]">user.info.basic,user.info.stats</code> with commas left
                unencoded — do not add <code className="text-[11px]">user.info.profile</code>.
              </p>
            ) : null}
            {network.code === "youtube" ? (
              <p className="sm:col-span-2 text-xs text-muted">
                YouTube stores subscribers + channel views. Google’s unverified-app interstitial is expected while the
                OAuth client is in Testing — testers can click Continue. The Google account must own a YouTube channel.
              </p>
            ) : null}
            <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
              <input type="checkbox" name="enabled" value="1" defaultChecked={network.enabled} disabled={!canEdit} />
              Enabled
            </label>
            {canEdit ? <button type="submit" className="btn-primary w-fit">Save {network.name}</button> : null}
          </form>
        ))}
      </section>
    </div>
  );
}
