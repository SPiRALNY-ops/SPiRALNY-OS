/**
 * Form entries: WPForms "Spiral OS entry" notification emails in Gmail ->
 * spiral.form_entries, plus the person record for each entry.
 */
import { todayIn } from "@/lib/analytics/range";
import { upsertPerson } from "@/lib/people";
import { getMessage, listMessageIds, readMessage } from "@/lib/sources/gmail";
import { parseSpiralEntry } from "@/lib/sources/wpforms-email";
import { hasRows } from "./store";
import type { SourceResult, SyncContext } from "./types";

/** Re-read a couple of days before the newest stored email; duplicates are skipped by message ID. */
const OVERLAP_DAYS = 2;

/** OpsLabs' own test entries (our addresses) never count as Spiral NY leads. */
export const TEST_EMAIL_DOMAINS = ["outreachify.io"];
const isTestEntry = (email: string | null) => Boolean(email && TEST_EMAIL_DOMAINS.some((d) => email.endsWith(`@${d}`)));

export async function syncForms(ctx: SyncContext): Promise<SourceResult> {
  const { db, config } = ctx;
  const token = await ctx.googleToken!();

  const [latest] = await db.query<{ at: Date | string | null }>("select max(received_at) as at from spiral.form_entries");
  let q = config.gmailQuery;
  if (latest?.at) {
    const since = new Date(new Date(latest.at).getTime() - OVERLAP_DAYS * 86_400_000);
    // Gmail's after: takes a calendar date (YYYY/MM/DD).
    q += ` after:${since.toISOString().slice(0, 10).replaceAll("-", "/")}`;
  }

  const ids = await listMessageIds(ctx.fetch, token, q);
  const known = ids.length
    ? new Set(
        (
          await db.query<{ id: string }>(
            "select gmail_message_id as id from spiral.form_entries where gmail_message_id = any($1::text[])",
            [ids],
          )
        ).map((r) => r.id),
      )
    : new Set<string>();

  let written = 0;
  let ignored = 0;
  let tests = 0;
  const days: string[] = [];
  for (const id of ids.filter((i) => !known.has(i))) {
    const message = readMessage(await getMessage(ctx.fetch, token, id));
    const entry = parseSpiralEntry(message.subject, message.text);
    if (!entry) {
      ignored++;
      continue;
    }
    if (isTestEntry(entry.email)) {
      tests++;
      continue;
    }
    await db.transaction(async (tx) => {
      const personId = await upsertPerson(tx, {
        fullName: entry.fullName,
        email: entry.email,
        phone: entry.phone,
        licenseNumber: entry.licenseNumber,
        seenAt: message.receivedAt,
        signed: entry.entryType === "complete",
      });
      await tx.query(
        `insert into spiral.form_entries
           (gmail_message_id, form_id, form_name, entry_id, entry_type, received_at, full_name, email, phone,
            license_number, plan, amount_cents, page_url, fields, person_id)
         values ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
         on conflict (gmail_message_id) do nothing`,
        [
          message.id,
          entry.formId,
          entry.formName,
          entry.entryId,
          entry.entryType,
          message.receivedAt.toISOString(),
          entry.fullName,
          entry.email,
          entry.phone,
          entry.licenseNumber,
          entry.plan,
          entry.amountCents,
          entry.pageUrl,
          JSON.stringify(entry.fields),
          personId,
        ],
      );
    });
    written++;
    days.push(todayIn(config.timezone, message.receivedAt));
  }

  const note =
    (ignored ? ` ${ignored} matching ${ignored === 1 ? "email was" : "emails were"} not Spiral OS entries and ${ignored === 1 ? "was" : "were"} ignored.` : "") +
    (tests ? ` ${tests} OpsLabs test entr${tests === 1 ? "y was" : "ies were"} skipped.` : "");
  if (!(await hasRows(db, "spiral.form_entries"))) {
    return {
      status: "skipped",
      rows: 0,
      message: `Gmail is connected, but no "Spiral OS entry" emails have arrived yet.${note}`,
    };
  }
  days.sort();
  return {
    status: "success",
    rows: written,
    rangeStart: days[0] ?? null,
    rangeEnd: days.at(-1) ?? null,
    message: `${written} new form entr${written === 1 ? "y" : "ies"}.${note}`,
  };
}
