import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, connection } from "next/server";
import { getSession } from "@/lib/auth/session";
import { parseKey } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { saveGoogleConnection } from "@/lib/sources/google-account";
import { OAUTH_COOKIE, appUrl, googleRedirectUri, oauthCookieOptions } from "@/lib/sources/google-connect";
import { exchangeCode, fetchAccountEmail } from "@/lib/sources/google-oauth";
import { startSync } from "@/lib/sync/server";

/** Google sends the browser back here after consent. Stores the connection, then starts a first sync. */
export async function GET(request: Request) {
  await connection(); // always per request, never prerendered
  const url = new URL(request.url);
  const back = (result: string) => {
    const res = NextResponse.redirect(appUrl(request, `/analytics?google=${result}#connections`));
    res.cookies.set(OAUTH_COOKIE, "", { ...oauthCookieOptions(), maxAge: 0 });
    return res;
  };

  const session = await getSession();
  if (session.status !== "signed-in" || session.user.role !== "opslabs") return back("forbidden");

  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";

  let saved: { state?: string; verifier?: string } = {};
  try {
    saved = JSON.parse((await cookies()).get(OAUTH_COOKIE)?.value ?? "{}");
  } catch {
    // fall through to the state check
  }
  if (!code || !saved.state || !saved.verifier || !sameString(state, saved.state)) return back("state-mismatch");

  const e = env();
  if (!e.GOOGLE_CLIENT_ID || !e.GOOGLE_CLIENT_SECRET || !e.APP_ENCRYPTION_KEY) return back("not-configured");

  try {
    const tokens = await exchangeCode(
      fetch,
      { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET },
      { code, codeVerifier: saved.verifier, redirectUri: googleRedirectUri(request) },
    );
    if (!tokens.refresh_token) return back("no-refresh-token");
    const accountEmail = await fetchAccountEmail(fetch, tokens.access_token);
    await saveGoogleConnection(await getDb(), parseKey(e.APP_ENCRYPTION_KEY), {
      accountEmail,
      refreshToken: tokens.refresh_token,
      scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
      connectedBy: session.user.email,
    });
  } catch (error) {
    console.error("[google] connect failed", error instanceof Error ? error.message : error);
    return back("failed");
  }

  startSync();
  return back("connected");
}

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
