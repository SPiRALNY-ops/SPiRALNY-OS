/**
 * The frame every Analytics page shares. Static on purpose: it reads nothing about the visitor or
 * the period, so it's part of the prerendered shell. The pages (and their period picker) stream in.
 */
export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="mb-6">
        <h1 className="brand-underline text-[1.75rem] leading-tight font-bold tracking-tight sm:text-[2rem]">Analytics</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Know what is working: where sign-ups come from and what brings them in.</p>
      </header>
      {children}
    </div>
  );
}
