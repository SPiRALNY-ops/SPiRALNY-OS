"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseAuthConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = { error?: string };

const credentials = z.object({
  email: z.string().trim().email("Enter your email address."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

/** Only same-site paths are allowed after sign-in. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/analytics";
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };

  if (!supabaseAuthConfigured()) redirect(safeNext(parsed.data.next));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: "That email and password don't match. Try again." };
  redirect(safeNext(parsed.data.next));
}

export async function signOut(): Promise<void> {
  if (supabaseAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/sign-in");
}
