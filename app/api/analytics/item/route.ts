import { z } from "zod";
import { cachedItem, dataKey } from "@/lib/analytics";
import { analyticsApiUser } from "@/lib/analytics/access";

const Query = z.object({
  kind: z.enum(["page", "search"]),
  // A page path ("/x/") or a search as typed into Google; long enough for both, short enough to be safe.
  id: z.string().trim().min(1).max(300),
});

/**
 * The detail panel's numbers for one page or search (GET /api/analytics/item?kind=page&id=/x/).
 * Answers 401 instead of redirecting, because the panel fetches it in the background. Cached per
 * day and data version, so opening the same panel again is instant.
 */
export async function GET(request: Request) {
  if (!(await analyticsApiUser())) return Response.json({ error: "Sign in to see this." }, { status: 401 });
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Unknown item." }, { status: 400 });
  const { today, version } = await dataKey();
  const item = await cachedItem(parsed.data.kind, parsed.data.id, today, version);
  if (!item) return Response.json({ error: "No Google data for this yet." }, { status: 404 });
  return Response.json(item, { headers: { "cache-control": "private, no-store" } });
}
