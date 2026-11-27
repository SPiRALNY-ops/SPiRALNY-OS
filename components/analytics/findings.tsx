import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, Lightbulb, TriangleAlert } from "lucide-react";
import type { Finding, Severity } from "@/lib/analytics/insights";
import { cn } from "@/lib/utils";
import { InfoTip } from "./info-tip";

/** Each severity's icon, its word, and the icon's colour. The word always carries the meaning. */
const LOOK: Record<Severity, { icon: typeof CircleAlert; word: string; color: string }> = {
  fix: { icon: CircleAlert, word: "Fix", color: "text-bad" },
  watch: { icon: TriangleAlert, word: "Watch", color: "text-warn" },
  opportunity: { icon: Lightbulb, word: "Opportunity", color: "text-chart-slate" },
  good: { icon: CircleCheck, word: "Good", color: "text-good" },
};

/**
 * The few things worth knowing on a page, most urgent first. Each comes from a plain rule over the
 * numbers on the page (see lib/analytics/insights.ts) and links to the section that shows it.
 */
export function Findings({
  items,
  title = "What stands out",
  range,
  empty,
}: {
  items: Finding[];
  title?: string;
  /** Added to links, so the period carries over. */
  range: string;
  /** Said when nothing stands out. */
  empty?: string;
}) {
  if (!items.length && !empty) return null;
  return (
    <section aria-labelledby="findings-title" className="rounded-xl border bg-card shadow-xs">
      <header className="flex items-center gap-1 px-4 pt-4 sm:px-5">
        <h2 id="findings-title" className="text-base font-bold">
          {title}
        </h2>
        <InfoTip label="How these are chosen">
          Simple rules over the numbers on this page, each with its threshold written down (for example, a recruiting
          page losing 30% of its clicks, or more than 3% of cold emails bouncing). Fix: broken or losing data. Watch:
          moving the wrong way. Opportunity: room to grow. Good: worth knowing it works.
        </InfoTip>
      </header>
      {items.length ? (
        <ul className="mt-2 divide-y">
          {items.map((f) => {
            const look = LOOK[f.severity];
            const Icon = look.icon;
            const [path, hash] = f.href.split("#");
            const href = `${path}${path.includes("?") ? "&" : "?"}range=${range}${hash ? `#${hash}` : ""}`;
            return (
              <li key={f.id}>
                <Link
                  href={href}
                  className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5"
                >
                  <Icon aria-hidden className={cn("mt-0.5 size-[18px] shrink-0", look.color)} />
                  <span className="min-w-0 flex-1">
                    <span className="mr-2 inline-flex rounded-full border px-2 py-px align-[1px] text-[11px] font-semibold">{look.word}</span>
                    <span className="font-semibold">{f.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{f.detail}</span>
                  </span>
                  <ArrowRight aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 pt-2 pb-4 text-sm text-muted-foreground sm:px-5">{empty}</p>
      )}
      {items.length > 0 && <div className="h-1" />}
    </section>
  );
}
