/**
 * One record per person (the plan's foundation). Form entries create or update
 * the person: matched by email, else by phone. Existing details are never
 * overwritten by blanks, and the first-seen date only moves earlier.
 */
import type { Db } from "@/lib/db/types";

type Tx = Pick<Db, "query">;

export type PersonInput = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  licenseNumber: string | null;
  seenAt: Date;
  /** A completed sign-up form means they joined. */
  signed: boolean;
};

const UPDATE_SET = `
  full_name      = coalesce(people.full_name, excluded.full_name),
  phone          = coalesce(people.phone, excluded.phone),
  license_number = coalesce(people.license_number, excluded.license_number),
  stage          = case when excluded.stage = 'signed' then 'signed' else people.stage end,
  first_seen_at  = least(people.first_seen_at, excluded.first_seen_at),
  updated_at     = now()`;

export async function upsertPerson(tx: Tx, p: PersonInput): Promise<string | null> {
  const stage = p.signed ? "signed" : "new";
  const values = [p.fullName, p.email, p.phone, p.licenseNumber, stage, p.seenAt.toISOString()];

  if (p.email) {
    const [row] = await tx.query<{ id: string }>(
      `insert into spiral.people as people (full_name, email, phone, license_number, stage, first_seen_at, source)
       values ($1, lower($2), $3, $4, $5, $6::timestamptz, 'website')
       on conflict (lower(email)) where email is not null do update set ${UPDATE_SET}
       returning id`,
      values,
    );
    return row.id;
  }

  if (p.phone) {
    const [existing] = await tx.query<{ id: string }>(
      "select id from spiral.people where phone = $1 order by first_seen_at limit 1",
      [p.phone],
    );
    if (existing) {
      await tx.query(
        `update spiral.people set
           full_name      = coalesce(full_name, $2),
           license_number = coalesce(license_number, $3),
           stage          = case when $4 = 'signed' then 'signed' else stage end,
           first_seen_at  = least(first_seen_at, $5::timestamptz),
           updated_at     = now()
         where id = $1`,
        [existing.id, p.fullName, p.licenseNumber, stage, p.seenAt.toISOString()],
      );
      return existing.id;
    }
    const [row] = await tx.query<{ id: string }>(
      `insert into spiral.people (full_name, email, phone, license_number, stage, first_seen_at, source)
       values ($1, $2, $3, $4, $5, $6::timestamptz, 'website') returning id`,
      values,
    );
    return row.id;
  }

  return null; // no way to recognise this person again (e.g. an abandoned form with no contact details)
}
