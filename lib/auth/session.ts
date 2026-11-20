import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { isProduction, supabaseAuthConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Role = "owner" | "team" | "opslabs";

export type User = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
};

/** Only used on a developer's machine when Supabase isn't configured. Never in production. */
const LOCAL_DEV_USER: User = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "dev@localhost",
  name: "Local developer",
  role: "opslabs",
};

export type SessionResult =
  | { status: "signed-in"; user: User }
  | { status: "signed-out" }
  | { status: "no-access"; email: string };

/**
 * Reads and verifies the session (getClaims checks the token signature), then
 * looks up the Spiral OS role. Reads cookies, so callers must sit inside a
 * <Suspense> boundary. Cached per request.
 */
export const getSession = cache(async (): Promise<SessionResult> => {
  if (!supabaseAuthConfigured()) {
    return isProduction() ? { status: "signed-out" } : { status: "signed-in", user: LOCAL_DEV_USER };
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { status: "signed-out" };

  const [profile] = await query<{ email: string; full_name: string | null; role: Role }>(
    "select email, full_name, role from spiral.profiles where user_id = $1",
    [claims.sub],
  );
  const email = typeof claims.email === "string" ? claims.email : "";
  if (!profile) return { status: "no-access", email };
  return {
    status: "signed-in",
    user: { id: claims.sub, email: profile.email, name: profile.full_name, role: profile.role },
  };
});

/** For pages and actions: returns the user or redirects to sign-in. */
export async function requireUser(): Promise<User> {
  const session = await getSession();
  if (session.status === "signed-in") return session.user;
  redirect(session.status === "no-access" ? "/sign-in?error=no-access" : "/sign-in");
}

/** Who can open which tab (the plan's "Used by" line for each tool). */
export const TAB_ACCESS: Record<string, Role[]> = {
  analytics: ["owner", "opslabs"],
};

export function canSee(user: User, tab: string): boolean {
  const allowed = TAB_ACCESS[tab];
  return !allowed || allowed.includes(user.role);
}
