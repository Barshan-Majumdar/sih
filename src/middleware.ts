import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/invite(.*)",
  "/pricing",
  "/features(.*)",
  "/solutions(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();
  const url = new URL(request.url);

  // If already authenticated and landing on marketing root or sign-in/up, route straight to dashboard
  if (
    userId &&
    !url.pathname.includes("sso-callback") &&
    (url.pathname === "/" || url.pathname.startsWith("/sign-in") || url.pathname.startsWith("/sign-up"))
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
