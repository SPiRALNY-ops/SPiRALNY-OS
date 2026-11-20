import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { supabaseAuthConfigured } from "@/lib/env";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  const localDev = !supabaseAuthConfigured() && process.env.NODE_ENV !== "production";
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/brand/spiralny-logo@2x.png"
            alt="SPiRALNY Real Estate"
            width={2048}
            height={698}
            priority
            className="h-auto w-[220px]"
          />
          <p className="mt-3 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">Spiral OS</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="mb-1 text-lg font-semibold">Sign in</h1>
          <p className="mb-5 text-sm text-muted-foreground">Use the email and password OpsLabs set up for you.</p>
          <Suspense fallback={<div className="h-48" />}>
            <SignInForm localDev={localDev} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
