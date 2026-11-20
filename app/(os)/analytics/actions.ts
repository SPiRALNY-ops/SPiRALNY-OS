"use server";

import { refresh } from "next/cache";
import { parseKey } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/session";
import { deleteGoogleConnection, readRefreshToken } from "@/lib/sources/google-account";
import { revokeToken } from "@/lib/sources/google-oauth";
import { startSync } from "@/lib/sync/server";

async function requireOpsLabs() {
  const user = await requireUser();
  if (user.role !== "opslabs") throw new Error("Only OpsLabs can change connections.");
  return user;
}

export async function syncNow(): Promise<void> {
  await requireOpsLabs();
  startSync();
  refresh();
}

export async function disconnectGoogle(): Promise<void> {
  await requireOpsLabs();
  const db = await getDb();
  const key = env().APP_ENCRYPTION_KEY;
  if (key) {
    const token = await readRefreshToken(db, parseKey(key)).catch(() => null);
    if (token) await revokeToken(fetch, token);
  }
  await deleteGoogleConnection(db);
  refresh();
}
