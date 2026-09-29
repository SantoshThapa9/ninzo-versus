import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Maintenance mode
  if (process.env.MAINTENANCE_MODE === "true") {
    if (pathname !== "/maintenance") {
      return NextResponse.redirect(new URL("/maintenance", request.url));
    }

    return NextResponse.next();
  }
  // Browsing pages and the product tour are public. Server actions enforce
  // authentication before changing player data.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
