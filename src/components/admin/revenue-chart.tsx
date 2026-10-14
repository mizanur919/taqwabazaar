"use client";

import { useState } from "react";
import { taka } from "@/lib/format";
import { compactTaka } from "./ui";

const H = 200; // plot height in px (viewBox units == px vertically)

function niceMax(max: number) {
  if (max <= 0) return 1000;
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / step) * step;
}

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Single-series area chart with crosshair + tooltip. */
export function RevenueChart({ points }: { points: { date: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = niceMax(Math.max(...points.map((p) => p.value)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  const n = Math.max(points.length - 1, 1);
  const x = (i: number) => (i / n) * 100;
  const y = (v: number) => H - (v / top) * H;

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${line} L100,${H} L0,${H} Z`;
  const labelEvery = Math.ceil(points.length / 7);
  const active = hover !== null ? points[hover] : null;

  return (
    <div className="flex gap-2">
      <div className="relative w-10 shrink-0 text-right text-[10px] tabular-nums text-adm-muted" style={{ height: H }}>
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: y(t) }}>
            {compactTaka(t)}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className="relative"
          style={{ height: H }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover(Math.round(((e.clientX - r.left) / r.width) * n));
          }}
        >
          <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            {ticks.map((t) => (
              <line key={t} x1="0" x2="100" y1={y(t)} y2={y(t)} stroke="var(--adm-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={area} fill="var(--adm-accent)" fillOpacity="0.28" />
            <path d={line} fill="none" stroke="var(--adm-ink)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>

          {active && hover !== null && (
            <>
              <div className="pointer-events-none absolute inset-y-0 w-px bg-adm-ink/30" style={{ left: `${x(hover)}%` }} />
              <div
                className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-adm-ink ring-2 ring-white"
                style={{ left: `${x(hover)}%`, top: y(active.value) }}
              />
              <div
                className="pointer-events-none absolute z-10 rounded-lg bg-adm-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
                style={{
                  left: `${x(hover)}%`,
                  top: Math.max(y(active.value) - 10, 30),
                  transform: `translate(${x(hover) > 70 ? "-100%" : "-50%"}, -100%)`,
                }}
              >
                <p className="font-semibold">{taka(active.value)}</p>
                <p className="text-white/70">{shortDate(active.date)}</p>
              </div>
            </>
          )}
        </div>

        <div className="relative mt-2 h-4 text-[10px] text-adm-muted">
          {points.map((p, i) =>
            i % labelEvery === 0 ? (
              <span key={p.date} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(i)}%` }}>
                {shortDate(p.date)}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}
