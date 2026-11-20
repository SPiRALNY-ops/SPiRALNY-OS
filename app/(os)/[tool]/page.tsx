import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CircleCheck } from "lucide-react";
import { STEP_NAMES, TOOLS, findTool } from "@/lib/tools";

/** Placeholder pages for the tools that come in later steps of the plan. */
export function generateStaticParams() {
  return TOOLS.filter((t) => !t.live).map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[tool]">): Promise<Metadata> {
  const { tool } = await params;
  return { title: findTool(tool)?.name ?? "Spiral OS" };
}

export default function ComingSoonPage({ params }: PageProps<"/[tool]">) {
  // Reading the URL sits inside Suspense, as Cache Components requires; known tools are still prerendered.
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-4 py-10" />}>
      <ComingSoon params={params} />
    </Suspense>
  );
}

async function ComingSoon({ params }: Pick<PageProps<"/[tool]">, "params">) {
  const { tool: slug } = await params;
  const tool = findTool(slug);
  if (!tool || tool.live) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:py-16">
      <span className="inline-flex items-center rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-foreground">
        Coming in Step {tool.step} · {STEP_NAMES[tool.step]}
      </span>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{tool.name}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{tool.summary}</p>
      <ul className="mt-8 space-y-3">
        {tool.points.map((point) => (
          <li key={point} className="flex gap-3">
            <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <p className="mt-8 border-t pt-4 text-sm text-muted-foreground">
        Used by: <span className="font-medium text-foreground">{tool.usedBy}</span>
      </p>
    </div>
  );
}
