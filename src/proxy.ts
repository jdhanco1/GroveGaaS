import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Only the admin portal requires a login; the scan flow and dashboard are
// reachable without one (dashboard is meant for an always-on iPad kiosk,
// protected physically rather than by login — see plan discussion).
const PROTECTED_PREFIXES = ["/admin"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (needsAuth && !req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
