import { Suspense } from "react";
import { BrandLogo, BrandMark } from "@/components/shell/brand";
import { MobileNav } from "@/components/shell/mobile-nav";
import { NavLinks } from "@/components/shell/nav-links";
import { UserMenu, UserMenuSkeleton } from "@/components/shell/user-menu";

/**
 * The Spiral OS shell: sidebar with all ten tools on desktop, a header with a
 * slide-out menu on phones. The shell itself is static; anything that reads
 * the session (the user menu, each page's content) streams in behind Suspense.
 */
export default function OsLayout({ children }: { children: React.ReactNode }) {
  const userMenu = (
    <Suspense fallback={<UserMenuSkeleton />}>
      <UserMenu />
    </Suspense>
  );

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 hidden h-svh flex-col border-r bg-sidebar lg:flex">
        <div className="px-5 pt-6 pb-5">
          <BrandLogo />
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <NavLinks />
        </div>
        <div className="border-t px-4 py-3">{userMenu}</div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-2 backdrop-blur lg:hidden">
          <MobileNav footer={userMenu} />
          <BrandMark />
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
