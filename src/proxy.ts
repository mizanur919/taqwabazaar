import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only: sends visitors without a session cookie to the login page.
// The real check (session lookup in the DB) happens in requireAdmin() on every admin page/action.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();
  if (!request.cookies.has("tb_admin")) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
