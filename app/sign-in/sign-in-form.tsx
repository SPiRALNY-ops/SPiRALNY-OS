"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, type SignInState } from "./actions";

const NOTICES: Record<string, string> = {
  "no-access": "Your account isn't set up for Spiral OS yet. Ask OpsLabs to give you access.",
};

export function SignInForm({ localDev }: { localDev: boolean }) {
  const params = useSearchParams();
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});
  const notice = NOTICES[params.get("error") ?? ""];
  const message = state.error ?? notice;

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      {localDev && (
        <p className="rounded-lg border border-dashed bg-muted px-3 py-2 text-sm text-muted-foreground">
          Local development: Supabase isn&apos;t connected, so any email and password will open the app.
        </p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-10">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
