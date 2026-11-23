import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { formatPercent, percentChange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InfoTip } from "./info-tip";

/**
 * A change against the period before. `goodWhen` says which direction is good
 * news ("down" for average position, where lower is better); null = neutral.
 * `previous` null = no data that far back, so nothing fair to compare with.
 */
export function Change({
  value,
  previous,
  goodWhen = "up",
  previousText,
  inverse = false,
  absolute = false,
  places = false,
}: {
  value: number;
  previous: number | null;
  goodWhen?: "up" | "down" | null;
  previousText?: string;
  inverse?: boolean;
  /** Show the difference in points (for rates) instead of a percentage change. */
  absolute?: boolean;
  /** Average position: show "Up 1.1 places" / "Down 1.1 places" (a lower number is higher on the page). */
  places?: boolean;
}) {
  const muted = inverse ? "text-sidebar-muted" : "text-muted-foreground";
  if (previous === null) return <p className={cn("text-xs", muted)}>No earlier data to compare</p>;
  const change = absolute || places ? value - previous : percentChange(value, previous);
  if (change === null) return <p className={cn("text-xs", muted)}>None in the period before</p>;
  const eps = places ? 0.05 : absolute ? 0.0005 : 0.005;
  const direction = change > eps ? "up" : change < -eps ? "down" : "flat";
  const tone =
    direction === "flat" || goodWhen === null
      ? muted
      : direction === goodWhen
        ? inverse
          ? "text-good-inverse"
          : "text-good"
        : inverse
          ? "text-bad-inverse"
          : "text-bad";
  // For positions the arrow follows the ranking: a bigger number means lower on the page.
  const visual = places ? (direction === "up" ? "down" : direction === "down" ? "up" : "flat") : direction;
  const Icon = visual === "up" ? ArrowUpRight : visual === "down" ? ArrowDownRight : ArrowRight;
  const text =
    direction === "flat"
      ? "No change"
      : places
        ? `${direction === "up" ? "Down" : "Up"} ${Math.abs(change).toFixed(1)} places`
        : absolute
        ? `${change > 0 ? "+" : "−"}${Math.abs(change * 100).toFixed(1)} pts`
        : `${change > 0 ? "+" : "−"}${formatPercent(Math.abs(change), 0)}`;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs">
      <span className={cn("inline-flex items-center gap-0.5 font-semibold", tone)}>
        <Icon aria-hidden className="size-3.5" strokeWidth={2.5} />
        {text}
      </span>
      {previousText && <span className={muted}>{previousText}</span>}
    </p>
  );
}

/** A labelled figure with an optional definition and comparison. */
export function Stat({
  label,
  value,
  info,
  change,
  sub,
  className,
}: {
  label: string;
  value: React.ReactNode;
  info?: React.ReactNode;
  change?: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <p className="text-sm font-medium text-muted-foreground">
        {label} {info && <InfoTip label={label}>{info}</InfoTip>}
      </p>
      <p className="text-[1.6rem] leading-tight font-semibold tracking-tight">{value}</p>
      {change}
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
