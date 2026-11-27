import Link from "next/link";
import { requireAdminPage } from "@/app/admin/guard";
import { actionCheckGoogleWallet, actionClearWallet, actionSaveAppleWallet, actionSaveGoogleWallet } from "@/app/admin/wallet/actions";
import { hasPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { walletConfigStatus } from "@/lib/wallet/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Wallet passes" };

type Props = { searchParams: Promise<{ saved?: string; incomplete?: string; error?: string; checked?: string; cleared?: string }> };

const input = "mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal text-indigo";
const area = `${input} font-mono text-xs`;

function Badge({ ready }: { ready: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ready ? "bg-[#EAF7EF] text-[#146C3A]" : "bg-[#FFF4E5] text-[#9A5B00]"}`}>
      {ready ? "Ready · buttons shown to influencers" : "Not set up · buttons hidden"}
    </span>
  );
}

export default async function AdminWalletPage({ searchParams }: Props) {
  const session = await requireAdminPage("wallet");
  const canEdit = hasPermission(session, "wallet.edit");
  const params = await searchParams;
  const [status, sample, registrations] = await Promise.all([
    walletConfigStatus(),
    prisma.creator.findFirst({ where: { userId: { not: null } }, orderBy: { updatedAt: "desc" }, select: { slug: true, displayName: true } }).catch(() => null),
    prisma.walletPassRegistration.count().catch(() => 0),
  ]);
  const notice = params.error
    ? params.error
    : params.saved
      ? `${params.saved === "apple" ? "Apple" : "Google"} Wallet settings saved.${params.incomplete ? " Some fields are still missing." : ""}`
      : params.checked
        ? "Google accepted the service account key."
        : params.cleared
          ? "Credentials removed. The buttons are hidden."
          : null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-indigo">Wallet passes</h1>
        <p className="mt-1 text-sm text-muted">
          Influencers can add their Influrios Card to Apple Wallet and Google Wallet. The pass shows their photo, name, specialty and
          socials, and a QR code that opens their card link (inflr.me/name). When an influencer edits their card, saved passes update.
          Each button appears only after its credentials are saved here.
        </p>
      </div>
      {notice ? (
        <p role="status" className={`rounded-xl px-3 py-2 text-sm font-semibold ${params.error ? "bg-amber-50 text-amber-900" : "bg-[#EAF8F2] text-[#087B5A]"}`}>
          {notice}
        </p>
      ) : null}

      <section className="card-surface space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-indigo">Apple Wallet</h2>
          <Badge ready={status.apple.ready} />
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>In your Apple Developer account (Certificates, Identifiers &amp; Profiles), create a Pass Type ID, for example pass.com.influrios.card.</li>
          <li>Create a certificate for that Pass Type ID, download it (.cer) and export its private key from Keychain as a .pem (or a .p12 converted to PEM).</li>
          <li>Download Apple&apos;s &ldquo;Worldwide Developer Relations - G4&rdquo; intermediate certificate.</li>
          <li>Enter them below with your 10-character Team ID. Blank fields keep what is already saved.</li>
        </ol>
        <p className="text-xs text-muted">
          Saved: Pass Type ID {status.apple.passTypeIdentifier || "—"} · Team ID {status.apple.teamIdentifier || "—"} · certificate{" "}
          {status.apple.hasCertificate ? "✓" : "—"} · private key {status.apple.hasPrivateKey ? "✓" : "—"} · Apple WWDR certificate{" "}
          {status.apple.hasWwdr ? "✓" : "—"} · {registrations} {registrations === 1 ? "iPhone" : "iPhones"} receiving updates
        </p>
        {canEdit ? (
          <form action={actionSaveAppleWallet} className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              Pass Type ID
              <input name="passTypeIdentifier" placeholder={status.apple.passTypeIdentifier || "pass.com.influrios.card"} className={input} />
            </label>
            <label className="text-xs font-semibold text-muted">
              Team ID
              <input name="teamIdentifier" placeholder={status.apple.teamIdentifier || "ABCDE12345"} className={input} />
            </label>
            <label className="text-xs font-semibold text-muted">
              Pass certificate (.cer or .pem)
              <input name="certificateFile" type="file" accept=".cer,.pem,.crt" className={input} />
              <textarea name="certificatePem" rows={2} placeholder="…or paste -----BEGIN CERTIFICATE-----" className={area} />
            </label>
            <label className="text-xs font-semibold text-muted">
              Private key (.pem)
              <input name="privateKeyFile" type="file" accept=".pem,.key" className={input} />
              <textarea name="privateKeyPem" rows={2} placeholder="…or paste -----BEGIN PRIVATE KEY-----" className={area} />
            </label>
            <label className="text-xs font-semibold text-muted">
              Private key passphrase (if it has one)
              <input name="privateKeyPassphrase" type="password" autoComplete="off" className={input} />
            </label>
            <label className="text-xs font-semibold text-muted">
              Apple WWDR certificate (.cer or .pem)
              <input name="wwdrFile" type="file" accept=".cer,.pem,.crt" className={input} />
              <textarea name="wwdrPem" rows={2} placeholder="…or paste -----BEGIN CERTIFICATE-----" className={area} />
            </label>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button type="submit" className="btn-primary w-fit !py-2 text-sm">
                Save Apple Wallet
              </button>
              {status.apple.ready && sample ? (
                <a href={`/api/wallet/apple/pass/${sample.slug}`} className="btn-secondary w-fit !py-2 text-sm">
                  Download a test pass ({sample.displayName})
                </a>
              ) : null}
            </div>
          </form>
        ) : null}
        {canEdit && (status.apple.passTypeIdentifier || status.apple.hasCertificate) ? (
          <form action={actionClearWallet}>
            <input type="hidden" name="which" value="apple" />
            <button type="submit" className="text-xs font-semibold text-muted underline">
              Remove Apple Wallet credentials
            </button>
          </form>
        ) : null}
      </section>

      <section className="card-surface space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-indigo">Google Wallet</h2>
          <Badge ready={status.google.ready} />
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>In the Google Pay &amp; Wallet Console, open Google Wallet API and note your Issuer ID.</li>
          <li>In Google Cloud, enable the Google Wallet API, create a service account and download a JSON key.</li>
          <li>In the Wallet console, add that service account&apos;s email as a user of the issuer account.</li>
          <li>Until Google approves publishing access, only accounts listed as test users in the console can save the pass.</li>
        </ol>
        <p className="text-xs text-muted">
          Saved: Issuer ID {status.google.issuerId || "—"} · service account {status.google.serviceAccountEmail || "—"}
        </p>
        {canEdit ? (
          <form action={actionSaveGoogleWallet} className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              Issuer ID
              <input name="issuerId" inputMode="numeric" placeholder={status.google.issuerId || "3388000000012345678"} className={input} />
            </label>
            <label className="text-xs font-semibold text-muted">
              Service account key (.json)
              <input name="serviceAccountFile" type="file" accept=".json,application/json" className={input} />
              <textarea name="serviceAccountJson" rows={2} placeholder='…or paste the JSON key ({"type": "service_account", …})' className={area} />
            </label>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button type="submit" className="btn-primary w-fit !py-2 text-sm">
                Save Google Wallet
              </button>
              {status.google.ready ? (
                <>
                  <button type="submit" formAction={actionCheckGoogleWallet} className="btn-secondary w-fit !py-2 text-sm">
                    Check credentials
                  </button>
                  {sample ? (
                    <a href={`/api/wallet/google/${sample.slug}`} target="_blank" rel="noreferrer" className="btn-secondary w-fit !py-2 text-sm">
                      Open a test pass ({sample.displayName})
                    </a>
                  ) : null}
                </>
              ) : null}
            </div>
          </form>
        ) : null}
        {canEdit && status.google.issuerId ? (
          <form action={actionClearWallet}>
            <input type="hidden" name="which" value="google" />
            <button type="submit" className="text-xs font-semibold text-muted underline">
              Remove Google Wallet credentials
            </button>
          </form>
        ) : null}
      </section>

      <p className="text-xs text-muted">
        The pass design follows the card: name, title, specialty, location, top socials and the QR code. Edit card visuals on{" "}
        <Link href="/admin/cards" className="font-semibold text-violet hover:underline">Influencer cards</Link>.
      </p>
    </div>
  );
}
