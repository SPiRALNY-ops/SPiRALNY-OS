"use client";

import Image from "next/image";

/** Logo inside the phone menu (client side of the Sheet). */
export function BrandLogoClient() {
  return (
    <div>
      <Image
        src="/brand/spiralny-logo@2x.png"
        alt="SPiRALNY Real Estate"
        width={2048}
        height={698}
        className="h-auto w-[160px]"
      />
      <span className="mt-1 block pl-[56px] text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        Spiral OS
      </span>
    </div>
  );
}
