import QRCode from "qrcode";

/** QR code plus the typed key for an authenticator app. */
export async function AuthenticatorSetup({ url, secret }: { url: string; secret: string }) {
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 200 });
  const grouped = secret.replace(/(.{4})/g, "$1 ").trim();
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-xl border border-border bg-white p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="QR code for your authenticator app" width={160} height={160} className="rounded-lg" />
      <div className="min-w-0 flex-1 text-sm text-indigo">
        <p className="font-semibold">1. Scan this with an authenticator app</p>
        <p className="mt-1 text-muted">Google Authenticator, Microsoft Authenticator, 1Password, Authy and similar apps work.</p>
        <p className="mt-3 font-semibold">Can&apos;t scan? Enter this key</p>
        <p className="mt-1 break-all font-mono text-xs tracking-wide">{grouped}</p>
        <p className="mt-3 font-semibold">2. Enter the 6-digit code the app shows</p>
      </div>
    </div>
  );
}
