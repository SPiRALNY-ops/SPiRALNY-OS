/**
 * Apply database migrations to Supabase.
 *   DATABASE_URL="postgresql://…" npm run db:migrate
 * Use Supabase's direct or session connection string (not the transaction
 * pooler), because migrations run several statements per transaction.
 */
import { openPostgres } from "../lib/db/drivers";
import { runMigrations } from "../lib/db/migrate";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL to the Supabase connection string first.");
    process.exit(1);
  }
  const db = openPostgres(url);
  try {
    const applied = await runMigrations(db);
    console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Already up to date.");
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
