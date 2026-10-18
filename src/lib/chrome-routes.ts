/** Public plan pages and signed-in account screens draw their own header. */
const EXACT = new Set([
  "/pricing",
  "/billing",
  "/creator",
  "/business/plans",
  "/business/billing",
  "/business/home",
  "/discover",
]);

export function hidesMarketingChrome(pathname: string): boolean {
  if (EXACT.has(pathname)) return true;
  if (pathname.startsWith("/dashboard")) return true;
  if (pathname.startsWith("/billing/")) return true;
  if (pathname.startsWith("/creator/")) return true;
  if (pathname.startsWith("/discover/")) return true;
  if (pathname.startsWith("/collaboration/hub")) return true;
  if (pathname.startsWith("/collaboration/requests")) return true;
  if (pathname.startsWith("/collaboration/applications")) return true;
  if (pathname.startsWith("/collaboration/business")) return true;
  if (pathname.startsWith("/collaboration/team")) return true;
  if (pathname.startsWith("/collaboration/records")) return true;
  if (pathname.startsWith("/collaboration/contract")) return true;
  if (pathname.startsWith("/business/billing/")) return true;
  if (pathname.startsWith("/business/home/")) return true;
  if (pathname.startsWith("/business/campaigns")) return true;
  if (pathname.startsWith("/business/profile")) return true;
  if (pathname.startsWith("/business/intelligence")) return true;
  if (pathname.startsWith("/payments")) return true;
  if (pathname.startsWith("/account")) return true;
  return false;
}
