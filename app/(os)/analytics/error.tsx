"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown if Analytics can't load: says what happened and offers a retry (Next's error.js convention). */
export default function AnalyticsError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";

  return (
    // The Analytics frame (title and pages) stays on screen around this; only the page's part failed.
    <div>
      <div role="alert" className="flex max-w-2xl items-start gap-3 rounded-xl border bg-card p-5 shadow-xs">
        <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-bad" />
        <div>
          <p className="font-bold">Analytics couldn&apos;t load right now</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The numbers are safe; reading them failed this time. Try again, and if it keeps happening, tell OpsLabs
            {digest ? ` (reference ${digest})` : ""}.
          </p>
          <Button className="mt-4" onClick={() => retry()}>
            <RefreshCw aria-hidden />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
