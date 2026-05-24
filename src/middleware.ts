import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/session-cookie";

// Lightweight UX gate: redirect to /login when no session cookie is present.
// Real authorization (role checks, expiry) is enforced server-side in layouts
// and API route handlers — this just avoids flashing protected pages.
const PROTECTED = [
  /^\/dashboard(\/|$)/,
  /^\/kds(\/|$)/,
  /^\/pos(\/|$)/,
  /^\/waitstaff(\/|$)/,
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((re) => re.test(pathname))) return NextResponse.next();

  const hasSession = req.cookies.has(SESSION_COOKIE);
  if (hasSession) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/kds/:path*",
    "/pos/:path*",
    "/waitstaff/:path*",
  ],
};
