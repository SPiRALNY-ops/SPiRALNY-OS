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
      {/* Styled like spiralny.com's plan cards: a charcoal header band over a white body. */}
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col items-center bg-sidebar px-6 pt-8 pb-6 text-center">
          <Image
            src="/brand/spiralny-logo@2x.png"
            alt="SPiRALNY Real Estate"
            width={200}
            height={68}
            loading="eager"
            className="h-auto w-[200px]"
          />
          <p className="mt-3 text-sm font-semibold text-sidebar-muted">Spiral OS</p>
        </div>
        <div className="p-6">
          <h1 className="brand-underline mb-2 text-xl font-bold">Sign in</h1>
          <p className="mb-5 text-sm text-muted-foreground">Use the email and password OpsLabs set up for you.</p>
          <Suspense fallback={<div className="h-48" />}>
            <SignInForm localDev={localDev} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
