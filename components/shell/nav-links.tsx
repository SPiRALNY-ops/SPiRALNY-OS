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

/** The ten tools on the charcoal sidebar. Live tools first, then the plan's later steps. */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const live = TOOLS.filter((t) => t.live);
  const later = TOOLS.filter((t) => !t.live);

  const item = (tool: (typeof TOOLS)[number]) => {
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
            ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
            : tool.live
              ? "text-sidebar-foreground hover:bg-sidebar-accent"
              : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-brand" />}
        <Icon aria-hidden className={cn("size-[18px] shrink-0", active && "text-brand")} />
        <span className="truncate">{tool.name}</span>
        {!tool.live && (
          <span className="ml-auto shrink-0 rounded-full border border-sidebar-border px-2 py-px text-[11px] font-medium text-sidebar-muted">
            Step {tool.step}
          </span>
        )}
      </Link>
    );
  };

  return (
    <nav aria-label="Spiral OS tools" className="flex flex-col gap-0.5">
      {live.map(item)}
      <p className="mt-6 mb-1.5 px-3 text-xs font-medium text-sidebar-muted">Coming soon, in plan order</p>
      {later.map(item)}
    </nav>
  );
}
