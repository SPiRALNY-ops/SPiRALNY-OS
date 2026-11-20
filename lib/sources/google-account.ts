/**
 * The stored Google connection: one row in spiral.integrations, refresh token
 * encrypted with APP_ENCRYPTION_KEY. Access tokens live only in memory.
 */
import { decrypt, encrypt } from "@/lib/crypto";
import type { Db } from "@/lib/db/types";
import { GoogleReconnectNeeded, refreshAccessToken, type GoogleClient } from "./google-oauth";
import type { Fetch } from "./http";

export type GoogleConnection = {
  accountEmail: string | null;
  scopes: string[];
  connectedAt: string;
  connectedBy: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
};

export async function getGoogleConnection(db: Pick<Db, "query">): Promise<GoogleConnection | null> {
  const [row] = await db.query<{
    account_email: string | null;
    scopes: string[];
    connected_at: Date | string;
    connected_by: string | null;
    last_error: string | null;
    last_error_at: Date | string | null;
  }>(
    `select account_email, scopes, connected_at, connected_by, last_error, last_error_at
       from spiral.integrations where provider = 'google'`,
  );
  if (!row) return null;
  return {
    accountEmail: row.account_email,
    scopes: row.scopes ?? [],
    connectedAt: new Date(row.connected_at).toISOString(),
    connectedBy: row.connected_by,
    lastError: row.last_error,
    lastErrorAt: row.last_error_at ? new Date(row.last_error_at).toISOString() : null,
  };
}

export async function saveGoogleConnection(
  db: Pick<Db, "query">,
  key: Buffer,
  conn: { accountEmail: string | null; refreshToken: string; scopes: string[]; connectedBy: string | null },
): Promise<void> {
  await db.query(
    `insert into spiral.integrations (provider, account_email, secret_ciphertext, scopes, connected_by, connected_at, last_error, last_error_at)
     values ('google', $1, $2, $3, $4, now(), null, null)
     on conflict (provider) do update set
       account_email = excluded.account_email,
       secret_ciphertext = excluded.secret_ciphertext,
       scopes = excluded.scopes,
       connected_by = excluded.connected_by,
       connected_at = now(),
       last_error = null,
       last_error_at = null`,
    [conn.accountEmail, encrypt(conn.refreshToken, key), conn.scopes, conn.connectedBy],
  );
  tokenCache.clear();
}

export async function readRefreshToken(db: Pick<Db, "query">, key: Buffer): Promise<string | null> {
  const [row] = await db.query<{ secret_ciphertext: string }>(
    "select secret_ciphertext from spiral.integrations where provider = 'google'",
  );
  return row ? decrypt(row.secret_ciphertext, key) : null;
}

export async function deleteGoogleConnection(db: Pick<Db, "query">): Promise<void> {
  await db.query("delete from spiral.integrations where provider = 'google'");
  tokenCache.clear();
}

async function recordGoogleError(db: Pick<Db, "query">, message: string) {
  await db.query(
    "update spiral.integrations set last_error = $1, last_error_at = now() where provider = 'google'",
    [message.slice(0, 500)],
  );
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * A short-lived access token for the stored connection, refreshed when it is
 * within a minute of expiring. Records "reconnect needed" on the connection.
 */
export async function googleAccessToken(
  db: Pick<Db, "query">,
  fetchFn: Fetch,
  client: GoogleClient,
  key: Buffer,
  now: () => number = Date.now,
): Promise<string> {
  const refreshToken = await readRefreshToken(db, key);
  if (!refreshToken) throw new GoogleReconnectNeeded("not connected");
  const cached = tokenCache.get(refreshToken);
  if (cached && cached.expiresAt - 60_000 > now()) return cached.token;
  try {
    const res = await refreshAccessToken(fetchFn, client, refreshToken);
    tokenCache.set(refreshToken, { token: res.access_token, expiresAt: now() + res.expires_in * 1000 });
    return res.access_token;
  } catch (error) {
    if (error instanceof GoogleReconnectNeeded) await recordGoogleError(db, error.message);
    throw error;
  }
}
