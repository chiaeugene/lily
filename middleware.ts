import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionCookie } from "./lib/session";

// Public paths that must NOT be gated:
//  - "/" the marketing landing page
//  - /login and /api/auth (the gate itself)
//  - /api/telegram (Telegram's webhook posts without a cookie)
//  - /client/[token] the customer self-service portal (its own opaque-token
//    auth, not staff login — a customer should never need a Lily passcode)
function isPublic(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/telegram") ||
    pathname.startsWith("/client/") ||
    pathname.startsWith("/api/client/")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const staffId = await verifySessionCookie(req.cookies.get("lily_auth")?.value);
  if (!staffId) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?from=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // run on everything except Next internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
