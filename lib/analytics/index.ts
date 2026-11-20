import "server-only";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { buildAnalytics } from "./build";
import { todayIn } from "./range";
import type { AnalyticsView, RangeKey } from "./types";

/** Analytics for the signed-in owner. Always computed at request time. */
export async function getAnalytics(rangeKey: RangeKey): Promise<AnalyticsView> {
  await connection();
  const timezone = env().TIMEZONE;
  return buildAnalytics(await getDb(), rangeKey, todayIn(timezone), timezone);
}

export type * from "./types";
