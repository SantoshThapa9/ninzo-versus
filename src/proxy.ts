import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const protectedRoutes = ["/wallet", "/clash", "/events", "/support", "/profile", "/admin"] as const;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  if (!needsAuth) return NextResponse.next();

  const sessionCookie =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");

  if (!sessionCookie) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/wallet",
    "/wallet/:path*",
    "/clash",
    "/clash/:path*",
    "/events",
    "/events/:path*",
    "/support",
    "/support/:path*",
    "/profile",
    "/profile/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
