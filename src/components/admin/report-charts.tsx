"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { taka } from "@/lib/format";
import { compactTaka } from "./ui";

// Comparison colours, validated: current = amber, previous = light warm grey (ΔE 20 apart, CVD-safe).
const CURRENT = "#dd9216";
const PREVIOUS = "#d8d3cb";
const H = 220;

function niceMax(max: number) {
  if (max <= 0) return 1;
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / step) * step;
}

type Bar = { label: string; current: number; previous?: number };

/**
 * Grouped columns (current vs previous period) or single columns when `previous` is absent.
 * Hover shows both values; a table view lists every number.
 */
const formats = {
  money: { value: taka, axis: compactTaka },
  count: { value: (n: number) => `${n}টি`, axis: (n: number) => String(Math.round(n)) },
};

export function ColumnChart({
  data,
  unit = "money",
  currentLabel = "এই সময়",
  previousLabel = "আগের সময়",
  color = CURRENT,
}: {
  data: Bar[];
  /** functions can't be passed from server components, so the format is picked by name */
  unit?: keyof typeof formats;
  currentLabel?: string;
  previousLabel?: string;
  color?: string;
}) {
  const format = formats[unit].value;
  const axisFormat = formats[unit].axis;
  const [hover, setHover] = useState<number | null>(null);
  const grouped = data.some((d) => d.previous !== undefined);
  const top = niceMax(Math.max(...data.flatMap((d) => [d.current, d.previous ?? 0])));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  const y = (v: number) => (v / top) * H;
  const labelEvery = Math.ceil(data.length / 13);

  return (
    <div>
      {grouped && (
        <div className="mb-3 flex justify-end gap-4 text-xs text-adm-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: color }} /> {currentLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: PREVIOUS }} /> {previousLabel}
          </span>
        </div>
      )}
      <div className="flex gap-2">
        <div className="relative w-10 shrink-0 text-right text-[10px] tabular-nums text-adm-muted" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: y(t) }}>
              {axisFormat(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height: H }} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px bg-adm-line" style={{ bottom: y(t) }} />
          ))}
          <div className="absolute inset-0 flex items-end">
            {data.map((d, i) => (
              <div
                key={d.label + i}
                className={`relative flex h-full flex-1 items-end justify-center gap-0.5 ${hover === i ? "bg-stone-900/[0.04]" : ""}`}
                onMouseEnter={() => setHover(i)}
              >
                <div className="w-full max-w-6 rounded-t" style={{ height: Math.max(y(d.current), d.current ? 2 : 0), background: color }} />
                {grouped && <div className="w-full max-w-6 rounded-t" style={{ height: Math.max(y(d.previous ?? 0), d.previous ? 2 : 0), background: PREVIOUS }} />}
              </div>
            ))}
          </div>
          {hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 rounded-lg bg-adm-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
              style={{ left: `${((hover + 0.5) / data.length) * 100}%`, transform: `translateX(${hover / data.length > 0.7 ? "-100%" : "-50%"})` }}
            >
              <p className="text-white/70">{data[hover].label}</p>
              <p className="font-semibold">
                {grouped && `${currentLabel}: `}
                {format(data[hover].current)}
              </p>
              {grouped && (
                <p>
                  {previousLabel}: {format(data[hover].previous ?? 0)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 ml-12 flex text-[10px] text-adm-muted">
        {data.map((d, i) => (
          <span key={d.label + i} className="flex-1 text-center whitespace-nowrap">
            {i % labelEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-adm-muted hover:text-adm-ink">টেবিল আকারে দেখুন</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead>
            <tr className="border-b border-adm-line text-left text-adm-muted">
              <th className="py-1 font-medium">সপ্তাহ শুরু</th>
              <th className="py-1 text-right font-medium">{grouped ? currentLabel : "মান"}</th>
              {grouped && <th className="py-1 text-right font-medium">{previousLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.label + i} className="border-b border-adm-line/60 last:border-0">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right">{format(d.current)}</td>
                {grouped && <td className="py-1 text-right">{format(d.previous ?? 0)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

// Single-hue sequential ramp (light → dark amber) for the heatmap.
const RAMP = ["#fbf0d6", "#f6d991", "#ecb94d", "#d9951a", "#a86d0c", "#6f4706"];

export function Heatmap({ rows, cols, values }: { rows: readonly string[]; cols: readonly string[]; values: number[][] }) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const max = Math.max(1, ...values.flat());
  const step = (v: number) => (v === 0 ? -1 : Math.min(RAMP.length - 1, Math.floor((v / max) * (RAMP.length - 1) + 0.0001)));
  const total = values.flat().reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate" style={{ borderSpacing: 3 }}>
          <thead>
            <tr>
              <th />
              {cols.map((c) => (
                <th key={c} className="pb-1 text-center text-[10px] font-medium text-adm-muted">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r}>
                <th className="pr-2 text-right text-[11px] font-medium text-adm-muted">{r}</th>
                {cols.map((c, ci) => {
                  const v = values[ri][ci];
                  const s = step(v);
                  return (
                    <td
                      key={c}
                      onMouseEnter={() => setHover({ r: ri, c: ci })}
                      onMouseLeave={() => setHover(null)}
                      className={`h-8 rounded-[4px] text-center text-[11px] font-semibold tabular-nums ${hover?.r === ri && hover?.c === ci ? "ring-2 ring-adm-ink" : ""}`}
                      style={{ background: s < 0 ? "rgb(28 25 23 / 0.04)" : RAMP[s], color: s >= 3 ? "#fff" : "var(--adm-ink)" }}
                      aria-label={`${r} ${c}: ${v}টি অর্ডার`}
                    >
                      {v || ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-adm-muted">
        <span>
          {hover ? `${rows[hover.r]}, ${cols[hover.c]}: ${values[hover.r][hover.c]}টি অর্ডার` : `মোট ${total}টি অর্ডার · ঘরে মাউস রাখলে বিস্তারিত দেখাবে`}
        </span>
        <span className="flex items-center gap-1.5">
          কম
          {RAMP.map((c) => (
            <span key={c} className="h-2.5 w-4 rounded-sm" style={{ background: c }} />
          ))}
          বেশি
        </span>
      </div>
    </div>
  );
}

export function PrintReportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print-hide flex items-center gap-1.5 rounded-lg border border-adm-line bg-white px-3 py-2 text-sm font-medium hover:bg-stone-50"
    >
      <Printer className="size-4" /> Download PDF
    </button>
  );
}
