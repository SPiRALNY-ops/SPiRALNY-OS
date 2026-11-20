import "server-only";
import { env, isProduction } from "@/lib/env";

/** Short-lived cookie holding the OAuth state and PKCE verifier between /connect and /callback. */
export const OAUTH_COOKIE = "spiral_google_oauth";

export const oauthCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: "lax" as const,
  path: "/api/google",
  maxAge: 600,
});

/**
 * Must match an "Authorized redirect URI" on the Google OAuth client exactly.
 * Production uses APP_URL (Railway's internal request URL isn't the public one).
 */
export function googleRedirectUri(request: Request): string {
  return appUrl(request, "/api/google/callback").toString();
}

/** A public URL in this app: APP_URL when set, else (local dev only) the request's own origin. */
export function appUrl(request: Request, path: string): URL {
  const base = env().APP_URL ?? (isProduction() ? undefined : new URL(request.url).origin);
  if (!base) throw new Error("APP_URL is not set.");
  return new URL(path, base);
}
