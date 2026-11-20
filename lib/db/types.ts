/** A minimal database handle shared by the Postgres (Supabase) and PGlite (local) drivers. */
export interface Db {
  readonly kind: "postgres" | "pglite";
  /** One parameterised statement. Use `$1, $2…` placeholders. */
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Several statements with no parameters (migrations). */
  exec(sql: string): Promise<void>;
  /** Run `fn` inside a transaction; rolls back if it throws. */
  transaction<T>(fn: (tx: Pick<Db, "query" | "exec">) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
