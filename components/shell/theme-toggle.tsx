"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ORDER = ["system", "light", "dark"] as const;
const LABEL = { system: "Theme: device setting", light: "Theme: light", dark: "Theme: dark" };
const noopSubscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // false while server-rendering, true in the browser (the saved theme is only known there).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const current = (mounted ? theme : "system") as (typeof ORDER)[number];
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(className)}
      aria-label={`${LABEL[current] ?? LABEL.system}. Switch to ${next}.`}
      title={LABEL[current] ?? LABEL.system}
      onClick={() => setTheme(next)}
    >
      <Icon className="size-4" />
    </Button>
  );
}
