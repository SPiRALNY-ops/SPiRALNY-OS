"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  ChartLine,
  CreditCard,
  FileText,
  Funnel,
  House,
  Inbox,
  Phone,
  SquareCheckBig,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TOOLS, type ToolIcon } from "@/lib/tools";

const ICONS: Record<ToolIcon, LucideIcon> = {
  home: House,
  leads: Funnel,
  inbox: Inbox,
  analytics: ChartLine,
  billing: CreditCard,
  agents: Users,
  onboarding: SquareCheckBig,
  calls: Phone,
  documents: FileText,
  brain: Brain,
};

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Spiral OS tools" className="flex flex-col gap-0.5">
      {TOOLS.map((tool) => {
        const Icon = ICONS[tool.icon];
        const href = `/${tool.slug}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={tool.slug}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-muted",
              !tool.live && !active && "text-muted-foreground",
            )}
          >
            {active && (
              <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand" />
            )}
            <Icon
              aria-hidden
              className={cn("size-4 shrink-0", active ? "text-brand" : tool.live ? "" : "opacity-70")}
            />
            <span className="truncate">{tool.name}</span>
            {!tool.live && (
              <span className="ml-auto shrink-0 rounded-full border px-1.5 py-px text-[11px] font-medium text-muted-foreground">
                Step {tool.step}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
