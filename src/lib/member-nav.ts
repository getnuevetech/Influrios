/** Which sidebar item is the page the member is on. Dashboard is only the exact home. */
export function memberNavActive(href: string, path: string, search = "") {
  const url = new URL(href, "http://local.invalid");
  const base = url.pathname;
  if (path === "/collaboration/work" || path.startsWith("/collaboration/work/")) {
    return base === "/collaboration/hub" || base === "/collaboration/business";
  }
  if (base === "/creator" || base === "/business/home") return path === base;
  if (base === "/agency") {
    if (path !== "/agency") return false;
    const wantView = url.searchParams.get("view");
    const current = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("view");
    if (wantView) return current === wantView;
    return !current;
  }
  if (base === "/creator/earnings" && (path === "/payments" || path.startsWith("/payments/"))) return true;
  if (!(path === base || path.startsWith(`${base}/`))) return false;
  if (base === "/collaboration/hub") return true;
  const wantView = url.searchParams.get("view");
  if (wantView) {
    const current = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("view");
    // Default hub view is opportunities when no ?view= is present.
    return (current ?? "opportunities") === wantView;
  }
  return true;
}
