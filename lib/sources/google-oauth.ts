/**
 * Google OAuth 2.0 for a web server app, with plain fetch.
 * Endpoints from https://accounts.google.com/.well-known/openid-configuration;
 * flow from https://developers.google.com/identity/protocols/oauth2/web-server.
 *
 * Spiral OS signs in once as admin@outreachify.io (an "Internal" OAuth app in
 * that Workspace), keeps the refresh token encrypted, and reads Spiral NY's
 * Google data with the access that account was given.
 */
import { createHash, randomBytes } from "node:crypto";
import { HttpError, requestJson, type Fetch } from "./http";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/** Read-only scopes, one per source. */
export const GOOGLE_SCOPES = {
  identity: ["openid", "email"],
  ga4: "https://www.googleapis.com/auth/analytics.readonly",
  gsc: "https://www.googleapis.com/auth/webmasters.readonly",
  gmail: "https://www.googleapis.com/auth/gmail.readonly",
} as const;

export const ALL_GOOGLE_SCOPES = [
  ...GOOGLE_SCOPES.identity,
  GOOGLE_SCOPES.ga4,
  GOOGLE_SCOPES.gsc,
  GOOGLE_SCOPES.gmail,
];

export type GoogleClient = { clientId: string; clientSecret: string };

/** PKCE (S256): the verifier stays in a cookie, Google only ever sees the challenge. */
export function pkcePair() {
  const verifier = randomBytes(48).toString("base64url"); // 64 chars, within 43–128
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function randomState(): string {
  return randomBytes(32).toString("base64url");
}

export function buildAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  loginHint?: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: ALL_GOOGLE_SCOPES.join(" "),
    access_type: "offline", // ask for a refresh token
    prompt: "consent", // show consent every time, so a refresh token is always returned
    include_granted_scopes: "true",
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  });
  if (opts.loginHint) params.set("login_hint", opts.loginHint);
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
  id_token?: string;
};

/** Google says the stored access is no longer valid: someone has to press "Connect Google" again. */
export class GoogleReconnectNeeded extends Error {
  constructor(detail: string) {
    super(`Google access has expired or was removed. Reconnect Google. (${detail})`);
    this.name = "GoogleReconnectNeeded";
  }
}

async function tokenRequest(fetchFn: Fetch, form: Record<string, string>): Promise<TokenResponse> {
  try {
    return await requestJson<TokenResponse>(fetchFn, GOOGLE_TOKEN_URL, { service: "Google sign-in", method: "POST", form });
  } catch (error) {
    if (error instanceof HttpError && error.status === 400 && error.body.includes("invalid_grant")) {
      throw new GoogleReconnectNeeded("invalid_grant");
    }
    if (error instanceof HttpError) {
      // Never surface the request body; the response body holds only an error code.
      throw new Error(`Google sign-in returned HTTP ${error.status}: ${error.body.slice(0, 200)}`);
    }
    throw error;
  }
}

export function exchangeCode(
  fetchFn: Fetch,
  client: GoogleClient,
  opts: { code: string; codeVerifier: string; redirectUri: string },
): Promise<TokenResponse> {
  return tokenRequest(fetchFn, {
    client_id: client.clientId,
    client_secret: client.clientSecret,
    code: opts.code,
    code_verifier: opts.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: opts.redirectUri,
  });
}

export function refreshAccessToken(fetchFn: Fetch, client: GoogleClient, refreshToken: string): Promise<TokenResponse> {
  return tokenRequest(fetchFn, {
    client_id: client.clientId,
    client_secret: client.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

export async function fetchAccountEmail(fetchFn: Fetch, accessToken: string): Promise<string | null> {
  const info = await requestJson<{ email?: string; email_verified?: boolean }>(fetchFn, GOOGLE_USERINFO_URL, {
    service: "Google sign-in",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return info.email ?? null;
}

/** Best effort: a failed revoke still lets us forget the token. */
export async function revokeToken(fetchFn: Fetch, token: string): Promise<void> {
  try {
    await requestJson(fetchFn, GOOGLE_REVOKE_URL, { service: "Google sign-in", method: "POST", form: { token }, retries: 0 });
  } catch {
    // ignore
  }
}
