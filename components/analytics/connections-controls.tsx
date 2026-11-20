"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SyncNowButton({ running, disabled }: { running: boolean; disabled: boolean }) {
  const { pending } = useFormStatus();
  const busy = pending || running;
  return (
    <Button type="submit" size="sm" disabled={busy || disabled}>
      {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
      {busy ? "Syncing…" : "Sync now"}
    </Button>
  );
}

export function DisconnectButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="ghost" disabled={pending}>
      <Unplug aria-hidden />
      Disconnect
    </Button>
  );
}

/** While a sync runs, re-read the page every few seconds so results appear without a manual reload. */
export function RefreshWhileRunning({ running }: { running: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [running, router]);
  return null;
}
