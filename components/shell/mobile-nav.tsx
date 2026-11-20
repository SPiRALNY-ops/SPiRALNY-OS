"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandLogoClient } from "./brand-client";
import { NavLinks } from "./nav-links";

export function MobileNav({ footer }: { footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[280px] flex-col gap-0 bg-sidebar p-0">
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle className="sr-only">Spiral OS menu</SheetTitle>
          <SheetDescription className="sr-only">Go to a Spiral OS tool</SheetDescription>
          <BrandLogoClient />
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
        <div className="border-t px-3 py-3">{footer}</div>
      </SheetContent>
    </Sheet>
  );
}
