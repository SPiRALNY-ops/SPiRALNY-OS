"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PAGE_GROUPS, SEARCH_GROUPS } from "@/lib/analytics/groups";
import type { ItemView } from "@/lib/analytics/types";
import { formatFull, formatPercent, formatPosition, pageLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MonthlyBarsCard } from "./trend-cards";

export type ItemKind = "page" | "search";

/** Was the open panel opened from inside the app? Then Back closes it; otherwise we just drop ?item. */
let openedHere = false;

/**
 * Opens a page's or a search's panel without asking the server for the page again: the address
 * gains ?item=… through the browser's own history (Next.js follows it), so Back closes the panel
 * and the address can be shared.
 */
export function openItem(kind: ItemKind, id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("item", `${kind}:${id}`);
  url.hash = "";
  openedHere = true;
  window.history.pushState(null, "", url);
}

function closeItem() {
  if (openedHere) {
    openedHere = false;
    window.history.back();
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("item");
  window.history.replaceState(null, "", url);
}

function parseItem(raw: string | null): { kind: ItemKind; id: string } | null {
  if (!raw) return null;
  const i = raw.indexOf(":");
  const kind = raw.slice(0, i);
  const id = raw.slice(i + 1);
  return (kind === "page" || kind === "search") && id ? { kind, id } : null;
}

const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia("(min-width: 640px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** A button that opens an item's panel; looks like a link. */
export function ItemLink({ kind, id, children, className }: { kind: ItemKind; id: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => openItem(kind, id)}
      className={cn(
        "min-w-0 text-left underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
    >
      {children}
    </button>
  );
}

type Loaded = { key: string; item: ItemView | null; error?: string };

/** The panel for the ?item in the address: a sheet from the right (from the bottom on phones). */
export function DetailPanel() {
  const params = useSearchParams();
  const current = parseItem(params.get("item"));
  const key = current ? `${current.kind}:${current.id}` : "";
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 640px)").matches, () => true);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!current) return;
    let live = true;
    fetch(`/api/analytics/item?kind=${current.kind}&id=${encodeURIComponent(current.id)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!live) return;
        setLoaded(res.ok ? { key, item: body as ItemView } : { key, item: null, error: body.error ?? "Couldn't load this." });
      })
      .catch(() => live && setLoaded({ key, item: null, error: "Couldn't load this. Check the connection and try again." }));
    return () => {
      live = false;
    };
    // `key` covers kind and id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const data = loaded?.key === key ? loaded : null;
  return (
    <Sheet open={Boolean(current)} onOpenChange={(open) => !open && closeItem()}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={cn("gap-0 overflow-y-auto", wide ? "w-full sm:max-w-xl" : "max-h-[85svh] rounded-t-2xl")}
      >
        <SheetHeader className="border-b pr-12">
          <SheetDescription>{current?.kind === "search" ? "Google search" : "Page on spiralny.com"}</SheetDescription>
          <SheetTitle className="text-lg leading-snug font-bold break-words">{current?.kind === "page" ? pageLabel(current.id) : current?.id}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-5 p-4">
          {!data ? (
            <div aria-busy className="space-y-3" aria-label="Loading">
              <div className="h-16 animate-pulse rounded-lg bg-muted/60" />
              <div className="h-56 animate-pulse rounded-lg bg-muted/60" />
            </div>
          ) : !data.item ? (
            <p className="text-sm text-muted-foreground">{data.error}</p>
          ) : (
            <ItemBody item={data.item} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ItemBody({ item }: { item: ItemView }) {
  const sum = (k: "clicks" | "impressions") => item.months.reduce((s, m) => s + m[k], 0);
  const clicks = sum("clicks");
  const shown = sum("impressions");
  const lastShown = [...item.months].reverse().find((m) => m.impressions > 0);
  const group =
    item.kind === "page"
      ? PAGE_GROUPS.find((g) => g.key === item.group)?.label
      : SEARCH_GROUPS.find((g) => g.key === item.group)?.label;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {group && <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium">{group}</span>}
        {item.kind === "page" && (
          <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline underline-offset-4">
            Open on spiralny.com <ExternalLink aria-hidden className="size-3.5" />
          </a>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Figure label="Google clicks" value={formatFull(clicks)} note="16 months" />
        <Figure label="Times shown" value={formatFull(shown)} note="16 months" />
        <Figure label="Click rate" value={shown ? formatPercent(clicks / shown, clicks / shown < 0.01 ? 2 : 1) : "—"} note="16 months" />
        <Figure label="Position" value={lastShown ? formatPosition(lastShown.position) : "—"} note={lastShown ? `Average, ${lastShown.label}` : "Not shown yet"} />
        {item.kind === "page" && item.visits !== null && <Figure label="Visits" value={formatFull(item.visits)} note="Last 90 days" />}
        {item.kind === "page" && item.forms && <Figure label="Form leads" value={formatFull(item.forms.leads)} note={`${formatFull(item.forms.signups)} signed, last 90 days`} />}
      </dl>
      <MonthlyBarsCard
        title="By month"
        months={item.months.map((m) => ({ key: m.key, label: m.label, partial: m === item.months.at(-1) }))}
        measures={[
          { key: "clicks", label: "Clicks", values: item.months.map((m) => m.clicks) },
          { key: "impressions", label: "Times shown", values: item.months.map((m) => m.impressions) },
        ]}
      />
      {item.kind === "page" ? (
        <RelatedList
          title="Searches that led here"
          rows={item.searches.map((s) => ({ key: s.query, label: s.query, clicks: s.clicks, impressions: s.impressions, position: s.position, open: () => openItem("search", s.query) }))}
          empty="Google doesn't name the searches behind this page's clicks (it hides rare ones)."
        />
      ) : (
        <RelatedList
          title="Pages Google showed for it"
          rows={item.pages.map((p) => ({ key: p.path, label: pageLabel(p.path), clicks: p.clicks, impressions: p.impressions, position: p.position, open: () => openItem("page", p.path) }))}
          empty="No page showed for this search in the last 90 days."
        />
      )}
    </>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl leading-tight font-semibold">{value}</dd>
      <dd className="text-xs text-muted-foreground">{note}</dd>
    </div>
  );
}

function RelatedList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { key: string; label: string; clicks: number; impressions: number; position: number; open: () => void }[];
  empty: string;
}) {
  return (
    <section>
      <h3 className="mb-1 text-base font-bold">{title}</h3>
      <p className="mb-2 flex justify-between gap-3 text-xs text-muted-foreground">
        <span>Last 90 days. Tap one to open it.</span>
        <span aria-hidden>Clicks</span>
      </p>
      {rows.length ? (
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => (
            <li key={r.key}>
              <button
                type="button"
                onClick={r.open}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              >
                <span className="min-w-0 truncate font-medium">{r.label}</span>
                <span aria-hidden className="text-right font-semibold tabular">{formatFull(r.clicks)}</span>
                <span className="col-span-2 text-xs text-muted-foreground">
                  Shown {formatFull(r.impressions)} times, position {formatPosition(r.position)}
                  <span className="sr-only">, {formatFull(r.clicks)} clicks</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
