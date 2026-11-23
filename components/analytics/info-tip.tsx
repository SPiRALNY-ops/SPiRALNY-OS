"use client";

import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** A small "?" that explains a term in plain words. Focusable, so keyboard users get it too. */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          className="ml-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full align-[-3px] text-muted-foreground/80 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <CircleHelp aria-hidden className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72 text-left leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
