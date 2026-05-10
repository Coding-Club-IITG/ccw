import { auth } from "@/lib/auth";

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // Protect internal and admin routes
  const isInternalRoute = pathname.startsWith("/internal");
  const isAdminRoute = pathname.startsWith("/admin");

  if ((isInternalRoute || isAdminRoute) && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }

  // Admin specific protection
  if (
    isAdminRoute &&
    req.auth?.user.role !== "Secretary" &&
    req.auth?.user.role !== "OC" &&
    req.auth?.user.role !== "Core Team"
  ) {
    return Response.redirect(
      new URL("/internal/dashboard", req.nextUrl.origin),
    );
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
