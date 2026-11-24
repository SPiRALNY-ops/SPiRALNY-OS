"use client";

import { useEffect, useRef, useState } from "react";

/**
 * For a row that scrolls sideways (chips, chapter links): which edges hide more
 * content, so the row can fade there and show that it scrolls.
 */
export function useEdgeFade<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft > 2;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);
  const fadeClass = edges.left && edges.right ? "fade-x" : edges.right ? "fade-r" : edges.left ? "fade-l" : "";
  return [ref, fadeClass] as const;
}
