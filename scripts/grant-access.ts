/**
 * Give a Supabase Auth user access to Spiral OS.
 * Create the user first in Supabase (Authentication > Users > Add user), then:
 *   DATABASE_URL="postgresql://…" npm run grant -- marcel@spiralny.com owner "Marcel Bellucci"
 * Roles: owner | team | opslabs
 */
import { openPostgres } from "../lib/db/drivers";

const ROLES = ["owner", "team", "opslabs"] as const;

async function main() {
  const [email, role, fullName] = process.argv.slice(2);
  const url = process.env.DATABASE_URL;
  if (!url || !email || !ROLES.includes(role as (typeof ROLES)[number])) {
    console.error('Usage: DATABASE_URL=… npm run grant -- <email> <owner|team|opslabs> ["Full name"]');
    process.exit(1);
  }
  const db = openPostgres(url);
  try {
    const users = await db.query<{ id: string }>(
      "select id from auth.users where lower(email) = lower($1)",
      [email],
    );
    if (!users[0]) {
      console.error(`No Supabase Auth user with email ${email}. Create it in Supabase first.`);
      process.exit(1);
    }
    await db.query(
      `insert into spiral.profiles (user_id, email, full_name, role)
       values ($1, lower($2), $3, $4)
       on conflict (user_id) do update set email = excluded.email,
         full_name = coalesce(excluded.full_name, spiral.profiles.full_name), role = excluded.role`,
      [users[0].id, email, fullName ?? null, role],
    );
    console.log(`${email} can now sign in as ${role}.`);
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
