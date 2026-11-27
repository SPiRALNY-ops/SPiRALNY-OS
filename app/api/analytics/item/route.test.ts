import { beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({ current: null as null | { id: string } }));
const item = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/analytics/access", () => ({ analyticsApiUser: async () => user.current }));
vi.mock("@/lib/analytics", () => ({
  dataKey: async () => ({ today: "2026-11-27", version: "v1" }),
  cachedItem: async (kind: string, id: string) => (item.current ? { ...(item.current as object), kind, id } : null),
}));

const { GET } = await import("./route");
const get = (query: string) => GET(new Request(`http://localhost/api/analytics/item?${query}`));

describe("detail panel route", () => {
  beforeEach(() => {
    user.current = { id: "u1" };
    item.current = { months: [] };
  });

  it("answers 401 (never a redirect) to someone who can't see Analytics", async () => {
    user.current = null;
    const res = await get("kind=page&id=/x/");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in to see this." });
  });

  it("refuses unknown kinds and empty or oversized ids", async () => {
    for (const q of ["kind=campaign&id=1", "kind=page&id=", `kind=search&id=${"a".repeat(301)}`, "id=/x/"]) {
      expect((await get(q)).status).toBe(400);
    }
  });

  it("returns the item, or 404 when Google has nothing for it", async () => {
    const ok = await get(`kind=search&id=${encodeURIComponent("100 commission brokerage")}`);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ kind: "search", id: "100 commission brokerage" });
    item.current = null;
    expect((await get("kind=page&id=/nothing/")).status).toBe(404);
  });
});
