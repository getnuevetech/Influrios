import { NextRequest, NextResponse } from "next/server";
import { isShortLinkHost, normalizeShortHost } from "@/lib/short-link-hosts";

/** Cookie name must match ADMIN_COOKIE in admin-auth.ts */
const ADMIN_COOKIE = "influrios_admin_session";
const GUEST_COOKIE = "influrios_guest";

/**
 * Edge-safe gate: require an admin session cookie for /admin/* except login.
 * Also mint a guest id so profile and search limits can be counted in Node.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (isShortLinkHost(host)) {
    if (pathname === "/api/short/resolve") return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/api/short/resolve";
    url.searchParams.set("path", pathname);
    // The rewrite can replace Host. Pass the host this edge already accepted.
    url.searchParams.set("host", normalizeShortHost(host));
    return NextResponse.rewrite(url);
  }
  const requestHeaders = new Headers(req.headers);
  let guest = req.cookies.get(GUEST_COOKIE)?.value;
  const minted = !guest;
  if (!guest) {
    guest = crypto.randomUUID();
    requestHeaders.set("x-influrios-guest", guest);
  }

  const needsAdmin =
    pathname.startsWith("/admin") &&
    pathname !== "/admin/login" &&
    !pathname.startsWith("/admin/login/");
  const response =
    needsAdmin && !req.cookies.get(ADMIN_COOKIE)?.value
      ? NextResponse.redirect(new URL(`/admin/login?next=${encodeURIComponent(pathname)}`, req.url))
      : NextResponse.next({ request: { headers: requestHeaders } });

  // Do not mint a cookie on /admin. That response is also the login action, and a
  // second Set-Cookie here was competing with the admin session cookie.
  if (minted && !pathname.startsWith("/admin")) {
    response.cookies.set(GUEST_COOKIE, guest, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
