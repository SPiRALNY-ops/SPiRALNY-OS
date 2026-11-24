"use client";

import { useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { Popover } from "radix-ui";

/**
 * A small "?" that explains a term in plain words. It opens on hover with a
 * mouse, and on tap or Enter everywhere else (a tooltip alone never opens on a
 * phone). Escape or a tap elsewhere closes it.
 */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const byHover = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  // Mouse only: touch and pen open the tip by tapping it.
  function onEnter(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      byHover.current = true;
      setOpen(true);
    }, 60);
  }
  function onLeave(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      byHover.current = false;
      setOpen(false);
    }, 150);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        byHover.current = false;
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
          // A click on a tip the mouse already opened keeps it open (instead of toggling it shut).
          onClick={(e) => {
            if (byHover.current && open) e.preventDefault();
            byHover.current = false;
          }}
          // A 24px target (WCAG 2.5.8) drawn like the old 16px one: the 4px padding is taken back by
          // negative margins, so the icon and the text around it don't move. The ::before widens taps to 36px.
          className="relative -my-1 -mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full p-1 align-[-3px] text-muted-foreground/80 transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:text-foreground"
        >
          <CircleHelp aria-hidden className="size-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
          className="z-50 max-w-[min(18rem,calc(100vw-24px))] rounded-lg bg-foreground px-3 py-2 text-left text-xs leading-relaxed font-normal text-background shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {children}
          <Popover.Arrow className="fill-foreground" width={10} height={5} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** A label whose "?" stays on the same line as its last word, so it never wraps onto a line of its own. */
export function TipLabel({ label, info }: { label: string; info?: React.ReactNode }) {
  if (!info) return <>{label}</>;
  const cut = label.lastIndexOf(" ");
  return (
    <>
      {cut >= 0 ? label.slice(0, cut + 1) : ""}
      <span className="whitespace-nowrap">
        {cut >= 0 ? label.slice(cut + 1) : label}
        <InfoTip label={label}>{info}</InfoTip>
      </span>
    </>
  );
}
