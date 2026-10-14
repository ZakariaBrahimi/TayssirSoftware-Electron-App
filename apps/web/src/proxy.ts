import { getSessionCookie } from "better-auth/cookies";
import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { getMode } from "./server/context";

const intl = createIntlMiddleware(routing);

const PUBLIC_PAGES = ["/login", "/setup", "/signup"];

/**
 * Locale routing + an optimistic auth redirect. Real authorization happens
 * in the API on every request; this only avoids flashing protected pages.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/");
  const locale = routing.locales.find((l) => l === segments[1]);

  if (locale) {
    const page = "/" + segments.slice(2).join("/");
    if (page === "/") {
      // Signed in: straight to the app. Signed out: the landing page in the
      // cloud, the sign-in screen on a shop's own install. `?preview` lets a
      // signed-in platform owner look at the landing page.
      const goToApp = getSessionCookie(request) && !request.nextUrl.searchParams.has("preview");
      const target = goToApp ? "/start" : getMode() === "cloud" ? null : "/login";
      if (target) return NextResponse.redirect(new URL(`/${locale}${target}`, request.url));
      return intl(request);
    }
    const isPublic = PUBLIC_PAGES.some((p) => page === p || page.startsWith(`${p}/`));
    if (!isPublic && !getSessionCookie(request)) {
      const url = new URL(`/${locale}/login`, request.url);
      if (page !== "/") url.searchParams.set("next", page);
      return NextResponse.redirect(url);
    }
  }

  return intl(request);
}

export const config = {
  // Everything except the API, Next internals and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
