/**
 * Lead sheet -> spiral.lead_sheet_rows (replaced each run) and one person per
 * lead. A row's own source (the Instantly tab = cold email, the SEO tab =
 * Google, or a "How did you find us?" answer) fills in a person's source when
 * nothing better is known yet.
 */
import { plural } from "@/lib/format";
import { upsertPerson } from "@/lib/people";
import { LEAD_SHEET_TABS, parseLeadSheetTab, tabRule } from "@/lib/sources/lead-sheet";
import { readTabs, sheetTitles } from "@/lib/sources/sheets";
import { insertRows } from "./store";
import type { SourceResult, SyncContext } from "./types";

export async function syncLeadSheet(ctx: SyncContext): Promise<SourceResult> {
  const { db, config } = ctx;
  const token = await ctx.googleToken!();
  const sheetId = config.leadSheetId!;

  const titles = (await sheetTitles(ctx.fetch, token, sheetId)).filter((t) => tabRule(t));
  if (!titles.length) {
    const names = LEAD_SHEET_TABS.map((r) => r.name).join(", ");
    return { status: "skipped", rows: 0, message: `None of the lead tabs were found in the sheet (looked for ${names}).` };
  }
  const values = await readTabs(ctx.fetch, token, sheetId, titles);
  const rows = titles.flatMap((t) => parseLeadSheetTab(t, values[t] ?? []));
  const dated = rows.filter((r) => r.day);

  await db.transaction(async (tx) => {
    await tx.query("delete from spiral.lead_sheet_rows");
    const stored: Record<string, unknown>[] = [];
    for (const r of rows) {
      const personId = r.day
        ? await upsertPerson(tx, {
            fullName: r.fullName,
            email: r.email,
            phone: r.phone,
            licenseNumber: r.licenseNumber,
            seenAt: new Date(`${r.day}T12:00:00Z`),
            signed: r.kind === "signup",
            origin: "lead_sheet",
          })
        : null;
      if (personId && r.source !== "unknown") {
        await tx.query(
          `update spiral.people set source = $2, source_detail = coalesce(source_detail, $3), updated_at = now()
            where id = $1 and source in ('unknown', 'website', 'lead_sheet')`,
          [personId, r.source, `Lead sheet: ${r.tab.trim()}`],
        );
      }
      stored.push({
        tab: r.tab,
        row_number: r.rowNumber,
        kind: r.kind,
        day: r.day,
        full_name: r.fullName,
        email: r.email,
        phone: r.phone,
        license_number: r.licenseNumber,
        status: r.status,
        plan: r.plan,
        how_found: r.howFound,
        source: r.source,
        person_id: personId,
      });
    }
    await insertRows(
      tx,
      "spiral.lead_sheet_rows",
      [
        ["tab", "text"],
        ["row_number", "integer"],
        ["kind", "text"],
        ["day", "date"],
        ["full_name", "text"],
        ["email", "text"],
        ["phone", "text"],
        ["license_number", "text"],
        ["status", "text"],
        ["plan", "text"],
        ["how_found", "text"],
        ["source", "text"],
        ["person_id", "uuid"],
      ],
      stored,
      "on conflict do nothing",
    );
  });

  if (!dated.length) return { status: "skipped", rows: 0, message: "The lead tabs have no dated rows yet." };
  const days = dated.map((r) => r.day!).sort();
  const leads = dated.filter((r) => r.kind === "lead").length;
  const signups = dated.length - leads;
  const undated = rows.length - dated.length;
  return {
    status: "success",
    rows: rows.length,
    rangeStart: days[0],
    rangeEnd: days.at(-1),
    message:
      `${plural(leads, "lead", "leads")} and ${plural(signups, "sign-up", "sign-ups")} from ${titles.map((t) => t.trim()).join(", ")}.` +
      (undated ? ` ${undated === 1 ? "1 row has" : `${undated} rows have`} no date in the sheet, so ${undated === 1 ? "it is" : "they are"} kept but not counted on any day.` : ""),
  };
}
