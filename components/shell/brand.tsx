import Image from "next/image";
import Link from "next/link";

/** Spiral NY logo from spiralny.com, with the product name under it. */
export function BrandLogo() {
  return (
    <Link href="/analytics" className="block rounded-md focus-visible:outline-2 focus-visible:outline-ring">
      <Image
        src="/brand/spiralny-logo@2x.png"
        alt="SPiRALNY Real Estate"
        width={2048}
        height={698}
        priority
        className="h-auto w-[176px]"
      />
      <span className="mt-1.5 block pl-[62px] text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        Spiral OS
      </span>
    </Link>
  );
}

/** Compact mark for the phone header: the lion icon from spiralny.com. */
export function BrandMark() {
  return (
    <Link href="/analytics" className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-ring">
      <Image src="/brand/lion-icon-192.png" alt="" width={192} height={192} className="size-8 rounded-full" />
      <span className="text-sm font-semibold">
        Spiral <span className="text-brand">OS</span>
      </span>
    </Link>
  );
}
