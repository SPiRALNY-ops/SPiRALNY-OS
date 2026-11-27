"use client";

import dynamic from "next/dynamic";

/** Holds the plot's exact height while Recharts loads, so nothing on the page moves. */
function PlotSpace({ height }: { height: number }) {
  return <div aria-hidden className="animate-pulse rounded-md bg-muted/50" style={{ height }} />;
}

export const SourcePlot = dynamic(() => import("./plots").then((m) => m.SourcePlot), {
  ssr: false,
  loading: () => <PlotSpace height={240} />,
});

export const TrendPlot = dynamic(() => import("./plots").then((m) => m.TrendPlot), {
  ssr: false,
  loading: () => <PlotSpace height={180} />,
});

export const StackPlot = dynamic(() => import("./plots").then((m) => m.StackPlot), {
  ssr: false,
  loading: () => <PlotSpace height={240} />,
});

export const BarsPlot = dynamic(() => import("./plots").then((m) => m.BarsPlot), {
  ssr: false,
  loading: () => <PlotSpace height={200} />,
});

export const RatePlot = dynamic(() => import("./plots").then((m) => m.RatePlot), {
  ssr: false,
  loading: () => <PlotSpace height={200} />,
});
