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
        width={width}
        height={Math.round((width * 698) / 2048)}
        loading="eager"
        // An exact box, with the logo fitted inside: no sub-pixel stretch, no layout shift.
        style={{ width, height: Math.round((width * 698) / 2048), objectFit: "contain" }}
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
      <Image src="/brand/spiralny-logo@2x.png" alt="SPiRALNY Real Estate" width={94} height={32} loading="eager" style={{ width: 94, height: 32, objectFit: "contain" }} />
      <span className="border-l border-sidebar-border pl-2.5 text-[13px] font-semibold text-sidebar-muted">
        Spiral OS
      </span>
    </Link>
  );
}
