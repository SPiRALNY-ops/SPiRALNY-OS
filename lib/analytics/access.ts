import "server-only";
import { canSee, getSession, requireUser, type User } from "@/lib/auth/session";
import { parseRangeKey } from "./range";
import { viewKey } from "./index";

/**
 * Who may see Analytics: the same rule on every Analytics page and in the detail-panel route,
 * because a check in a layout doesn't protect the pages under it. Signed-out visitors are sent to
 * sign-in; signed-in people without access get `allowed: false` (the page explains).
 */
export async function analyticsPage(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const { range } = await searchParams;
  const [user, key] = await Promise.all([requireUser(), viewKey(parseRangeKey(Array.isArray(range) ? range[0] : range))]);
  return { user, allowed: canSee(user, "analytics"), key };
}

/** For route handlers: the user if they may see Analytics, otherwise null (answer 401, never redirect). */
export async function analyticsApiUser(): Promise<User | null> {
  const session = await getSession();
  return session.status === "signed-in" && canSee(session.user, "analytics") ? session.user : null;
}
