/**
 * Site Influrios wordmark — ∞ mark in brand gradient + product name.
 * Keep in sync with marketing and account chrome.
 */
export function InfluriosWordmark({
  className = "inline-flex items-center gap-2 font-display text-lg font-bold text-indigo",
  markClassName = "inline-flex h-8 w-8 items-center justify-center rounded-full brand-gradient text-sm text-white shadow-md shadow-violet/30",
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={className}>
      <span aria-hidden className={markClassName}>
        ∞
      </span>
      Influrios
    </span>
  );
}
