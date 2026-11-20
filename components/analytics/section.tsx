import { SampleBadge } from "./chart-parts";

/** Plain card for table sections (charts use ChartCard, which adds the chart/table switch). */
export function Section({
  title,
  description,
  sample,
  footer,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  sample: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
      <header className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">{title}</h2>
          {sample && <SampleBadge />}
        </div>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </header>
      {children}
      {footer && <footer className="mt-3 text-xs text-muted-foreground">{footer}</footer>}
    </section>
  );
}

/** Shown in a column whose source isn't connected yet. */
export function NotYet({ title }: { title: string }) {
  return (
    <span className="text-muted-foreground" title={title}>
      —
    </span>
  );
}
