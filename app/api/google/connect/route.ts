import { NextResponse, connection } from "next/server";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { OAUTH_COOKIE, appUrl, googleRedirectUri, oauthCookieOptions } from "@/lib/sources/google-connect";
import { buildAuthUrl, pkcePair, randomState } from "@/lib/sources/google-oauth";

/** OpsLabs only: send the browser to Google's consent screen (sign in as admin@outreachify.io). */
export async function GET(request: Request) {
  await connection(); // always per request, never prerendered
  const session = await getSession();
  if (session.status !== "signed-in" || session.user.role !== "opslabs") {
    return NextResponse.redirect(appUrl(request, "/analytics"));
  }
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_ENCRYPTION_KEY } = env();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !APP_ENCRYPTION_KEY) {
    return NextResponse.redirect(appUrl(request, "/analytics?google=not-configured#connections"));
  }

  const state = randomState();
  const { verifier, challenge } = pkcePair();
  const response = NextResponse.redirect(
    buildAuthUrl({
      clientId: GOOGLE_CLIENT_ID,
      redirectUri: googleRedirectUri(request),
      state,
      codeChallenge: challenge,
    }),
  );
  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier }), oauthCookieOptions());
  return response;
}
