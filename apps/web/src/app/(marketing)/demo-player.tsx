"use client";
import { useEffect, useRef } from "react";

/**
 * Lance les animations de démonstration quand elles entrent à l'écran
 * (en pause jusque-là : le visiteur voit la catégorisation se faire).
 */
export function DemoPlayer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) return void el.setAttribute("data-play", "");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.setAttribute("data-play", "");
          io.disconnect();
        }
      },
      { threshold: 0.85 },
    );
    // Point de repère : la liste des mouvements, qui doit être bien visible.
    io.observe(el.querySelector("[data-demo-anchor]") ?? el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-demo="">
      <noscript><style>{"[data-demo] *{animation-play-state:running!important}"}</style></noscript>
      {children}
    </div>
  );
}
