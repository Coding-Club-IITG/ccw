import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { isAdmin } from "@/lib/utils";

export default auth((req: NextRequest & { auth: any }) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // Define route categories
  const isProtectedRoute =
    pathname.startsWith("/internal") || pathname.startsWith("/admin");

  // Redirect authenticated users away from ANY public route to the dashboard
  if (isLoggedIn && !isProtectedRoute) {
    return Response.redirect(
      new URL("/internal/dashboard", req.nextUrl.origin),
    );
  }

  // Protect internal and admin routes for non-authenticated users
  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL("/", req.nextUrl.origin); // Redirect to home for login
    return Response.redirect(loginUrl);
  }

  // Admin specific protection
  if (
    isLoggedIn &&
    pathname.startsWith("/admin") &&
    !isAdmin(req.auth?.user.role)
  ) {
    return Response.redirect(
      new URL("/internal/dashboard", req.nextUrl.origin),
    );
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
