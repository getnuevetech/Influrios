/** Public plan pages and signed-in account screens draw their own header. */
const EXACT = new Set([
  "/pricing",
  "/billing",
  "/creator",
  "/business/plans",
  "/business/billing",
  "/business/home",
]);

export function hidesMarketingChrome(pathname: string): boolean {
  if (EXACT.has(pathname)) return true;
  if (pathname.startsWith("/dashboard")) return true;
  if (pathname.startsWith("/billing/")) return true;
  if (pathname.startsWith("/creator/")) return true;
  if (pathname.startsWith("/business/billing/")) return true;
  if (pathname.startsWith("/business/home/")) return true;
  return false;
}
