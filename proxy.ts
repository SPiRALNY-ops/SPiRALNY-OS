import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every page request:
 *  1. Refreshes the Supabase session (getClaims verifies and, when needed,
 *     refreshes the token; new cookies are written to both the request and
 *     the response, as Supabase's Next.js guide describes).
 *  2. Optimistic gate: signed-out visitors go to /sign-in. Pages still verify
 *     the user and role themselves (lib/auth/session.ts) — this is not the
 *     security boundary.
 * When Supabase isn't configured (local development) it does nothing.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [header, value] of Object.entries(headers)) response.headers.set(header, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const isSignIn = request.nextUrl.pathname.startsWith("/sign-in");

  if (!signedIn && !isSignIn) {
    const target = request.nextUrl.clone();
    target.pathname = "/sign-in";
    target.search = "";
    if (request.nextUrl.pathname !== "/") target.searchParams.set("next", request.nextUrl.pathname);
    return copyAuth(response, NextResponse.redirect(target));
  }
  return response;
}

/** A different response must carry the refreshed cookies and no-cache headers too. */
function copyAuth(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) to.headers.set(header, value);
  }
  return to;
}

export const config = {
  // Skip static files, images, robots.txt, health checks and the cron endpoint (it has its own secret).
  matcher: ["/((?!_next/static|_next/image|brand/|icon.png|apple-icon.png|robots.txt|api/health|api/cron).*)"],
};
