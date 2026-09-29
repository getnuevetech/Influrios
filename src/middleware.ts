import { NextRequest, NextResponse } from "next/server";

/** Cookie name must match ADMIN_COOKIE in admin-auth.ts */
const ADMIN_COOKIE = "influrios_admin_session";

/**
 * Edge-safe gate: require an admin session cookie for /admin/* except login.
 * Signature verification happens in Node via getAdminSession / requireAdminPage.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }
  if (!req.cookies.get(ADMIN_COOKIE)?.value) {
    const login = new URL("/admin/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
