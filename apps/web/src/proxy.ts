import { getSessionCookie } from "better-auth/cookies";
import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);

const PUBLIC_PAGES = ["/login", "/setup"];

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
