"use client";

import { useState } from "react";
import Image from "next/image";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavLinks } from "./nav-links";

/** Phone menu: the same charcoal sidebar, sliding in from the left. */
export function MobileNav({ footer }: { footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[288px] flex-col gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:text-sidebar-muted">
        <SheetHeader className="border-b border-sidebar-border px-5 py-5">
          <SheetTitle className="sr-only">Spiral OS menu</SheetTitle>
          <SheetDescription className="sr-only">Go to a Spiral OS tool</SheetDescription>
          <Image src="/brand/spiralny-logo@2x.png" alt="SPiRALNY Real Estate" width={156} height={53} style={{ width: 156, height: "auto" }} />
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
        <div className="border-t border-sidebar-border px-4 py-3">{footer}</div>
      </SheetContent>
    </Sheet>
  );
}
