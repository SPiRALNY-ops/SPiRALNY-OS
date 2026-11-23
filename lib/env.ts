import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once and read lazily so `next build` works
 * without secrets. Every integration is optional: when its variables are
 * missing, the matching Analytics section stays on sample data.
 */
const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: optionalString,
  TIMEZONE: z.string().default("America/New_York"),

  // Database: Supabase Postgres connection string. Unset locally -> embedded Postgres.
  DATABASE_URL: optionalString,

  // Supabase Auth (sign-in).
  NEXT_PUBLIC_SUPABASE_URL: optionalString,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,

  // Encrypts stored OAuth tokens (64 hex chars = 32 bytes).
  APP_ENCRYPTION_KEY: optionalString,
  // Shared secret the Railway cron service sends to /api/cron/sync.
  CRON_SECRET: optionalString,

  // Google (OAuth app in the outreachify.io Workspace, signed in as admin@outreachify.io).
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  // The only Google account allowed to connect. Whatever it can read, Spiral OS can read.
  GOOGLE_ACCOUNT_EMAIL: optionalString,
  GA4_PROPERTY_ID: optionalString,
  // Search Console property. Unset = picked automatically from what the account can read.
  GSC_SITE_URL: optionalString,
  // Spiral NY's lead sheet (the ID in its docs.google.com/spreadsheets/d/<ID>/ link).
  LEAD_SHEET_ID: optionalString,
  // Gmail search that finds the WPForms "Spiral OS" notifications.
  GMAIL_FORMS_QUERY: z.string().default('subject:"Spiral OS entry"'),

  // Instantly API v2 key (scope all:read).
  INSTANTLY_API_KEY: optionalString,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid environment: ${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";

export const supabaseAuthConfigured = () =>
  Boolean(env().NEXT_PUBLIC_SUPABASE_URL && env().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const googleConfigured = () => Boolean(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET);
