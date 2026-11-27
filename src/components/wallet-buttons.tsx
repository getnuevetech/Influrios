import { walletAvailability } from "@/lib/wallet/config";

/** "Add to Apple Wallet" / "Add to Google Wallet" for an influencer card. Each shows only when it is set up. */
export async function WalletButtons({ slug, className = "" }: { slug: string; className?: string }) {
  if (!slug) return null;
  const available = await walletAvailability();
  if (!available.apple && !available.google) return null;
  const button = "inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-black px-3 text-[13px] font-semibold text-white hover:bg-[#1f1f1f]";
  return (
    <div className={`grid gap-2 ${className}`}>
      {available.apple ? (
        <a href={`/api/wallet/apple/pass/${encodeURIComponent(slug)}`} className={button} aria-label="Add to Apple Wallet">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
            <path d="M16.37 12.6c-.02-2.03 1.66-3 1.74-3.05-.95-1.39-2.42-1.58-2.94-1.6-1.25-.13-2.44.73-3.08.73-.64 0-1.62-.71-2.66-.69-1.37.02-2.63.8-3.33 2.02-1.42 2.47-.36 6.12 1.02 8.12.68.98 1.48 2.08 2.53 2.04 1.02-.04 1.4-.66 2.63-.66 1.23 0 1.57.66 2.65.64 1.09-.02 1.79-1 2.46-1.98.77-1.13 1.09-2.23 1.11-2.29-.02-.01-2.13-.82-2.13-3.28zM14.34 6.62c.56-.68.94-1.62.84-2.56-.81.03-1.79.54-2.37 1.22-.52.6-.98 1.56-.85 2.48.9.07 1.82-.46 2.38-1.14z" />
          </svg>
          Add to Apple Wallet
        </a>
      ) : null}
      {available.google ? (
        <a
          href={`/api/wallet/google/${encodeURIComponent(slug)}`}
          target="_blank"
          rel="noreferrer"
          className={button}
          aria-label="Add to Google Wallet"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path fill="#4285F4" d="M21.6 12.23c0-.68-.06-1.33-.17-1.96H12v3.7h5.4a4.62 4.62 0 0 1-2 3.03v2.52h3.24c1.9-1.75 2.96-4.33 2.96-7.29z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.52c-.9.6-2.04.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.6A10 10 0 0 0 12 22z" />
            <path fill="#FBBC05" d="M6.4 13.89a6 6 0 0 1 0-3.78V7.5H3.06a10 10 0 0 0 0 9l3.34-2.61z" />
            <path fill="#EA4335" d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2 10 10 0 0 0 3.06 7.5L6.4 10.1C7.19 7.74 9.4 5.98 12 5.98z" />
          </svg>
          Add to Google Wallet
        </a>
      ) : null}
    </div>
  );
}
