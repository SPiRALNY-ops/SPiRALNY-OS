import { Suspense } from "react";
import { BrandBar, BrandLogo } from "@/components/shell/brand";
import { MobileNav } from "@/components/shell/mobile-nav";
import { NavLinks } from "@/components/shell/nav-links";
import { UserMenu, UserMenuSkeleton } from "@/components/shell/user-menu";

/**
 * The Spiral OS shell, in spiralny.com's look: a charcoal bar carrying the
 * logo (a sidebar on desktop, a top bar with a slide-out menu on phones).
 * The shell is static; anything that reads the session streams in behind Suspense.
 */
export default function OsLayout({ children }: { children: React.ReactNode }) {
  const userMenu = (
    <Suspense fallback={<UserMenuSkeleton />}>
      <UserMenu />
    </Suspense>
  );

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-svh flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="px-6 pt-7 pb-6">
          <BrandLogo />
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <NavLinks />
        </div>
        <div className="border-t border-sidebar-border px-4 py-3.5">{userMenu}</div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-1.5 bg-sidebar px-2 text-sidebar-foreground shadow-sm lg:hidden">
          <MobileNav footer={userMenu} />
          <BrandBar />
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
