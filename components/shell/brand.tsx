import Image from "next/image";
import Link from "next/link";

/**
 * The SPiRALNY logo exactly as spiralny.com shows it in its charcoal header bar
 * (orange "SPiRAL", grey "NY"), with the product name under it.
 */
export function BrandLogo({ width = 172, href = "/analytics" }: { width?: number; href?: string }) {
  return (
    <Link href={href} className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
      <Image
        src="/brand/spiralny-logo@2x.png"
        alt="SPiRALNY Real Estate"
        width={2048}
        height={698}
        priority
        style={{ width, height: "auto" }}
      />
      <span
        className="mt-2 flex items-center gap-2 text-[13px] font-semibold text-sidebar-muted"
        style={{ paddingLeft: Math.round(width * 0.355) }}
      >
        Spiral OS
      </span>
    </Link>
  );
}

/** Logo for the phone header bar (charcoal, like the site's). */
export function BrandBar() {
  return (
    <Link href="/analytics" className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-ring">
      <Image src="/brand/spiralny-logo@2x.png" alt="SPiRALNY Real Estate" width={2048} height={698} priority className="h-8 w-auto" />
      <span className="border-l border-sidebar-border pl-2.5 text-[13px] font-semibold text-sidebar-muted">
        Spiral OS
      </span>
    </Link>
  );
}
