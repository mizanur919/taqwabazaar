"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Horizontal scroll row with the round orange arrow buttons from the reference design. */
export function Slider({
  title,
  subtitle,
  accent = false,
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="mx-auto max-w-7xl px-4">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold ${accent ? "text-brand" : "text-ink"}`}>{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex gap-2">
          {([-1, 1] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              aria-label={dir === -1 ? "আগের" : "পরের"}
              onClick={() => scroll(dir)}
              className="grid size-8 place-items-center rounded-full border border-brand text-brand transition hover:bg-brand hover:text-white"
            >
              {dir === -1 ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ))}
        </div>
      </div>
      <div ref={ref} className="no-scrollbar flex snap-x gap-3 overflow-x-auto scroll-smooth pb-1">
        {children}
      </div>
    </section>
  );
}
