import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { OrderStatus } from "@prisma/client";

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-white bg-adm-surface/90 p-5 shadow-sm shadow-stone-900/5 ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-adm-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Signed percent change vs the previous period. Up is good for every metric we show. */
export function DeltaBadge({ change, label }: { change: number | null; label: string }) {
  if (change === null) return <p className="text-xs text-adm-muted">{label}: আগের ডেটা নেই</p>;
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className="flex items-center gap-1 text-xs text-adm-muted">
      <span className={`flex items-center font-semibold ${up ? "text-green-700" : "text-red-700"}`}>
        <Icon className="size-3.5" />
        {Math.abs(change * 100).toFixed(1)}%
      </span>
      {label}
    </p>
  );
}

export function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 1);
  const n = Math.max(values.length - 1, 1);
  const points = values.map((v, i) => `${(i / n) * 100},${30 - (v / max) * 26 - 2}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={`h-8 w-full ${className}`} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="var(--adm-accent-strong)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export const statusMeta: Record<OrderStatus, { label: string; className: string; dot: string }> = {
  PENDING: { label: "New", className: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  CONFIRMED: { label: "Confirmed", className: "bg-sky-50 text-sky-800", dot: "bg-sky-500" },
  SHIPPED: { label: "Shipped", className: "bg-violet-50 text-violet-800", dot: "bg-violet-500" },
  DELIVERED: { label: "Delivered", className: "bg-green-50 text-green-800", dot: "bg-green-600" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-800", dot: "bg-red-500" },
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const meta = statusMeta[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

/** ৳1,21,630 → ৳122k for axes and tight spaces. */
export const compactTaka = (n: number) =>
  n >= 1_000_000 ? `৳${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `৳${Math.round(n / 1000)}k` : `৳${Math.round(n)}`;

export const timeAgo = (minutes: number) => {
  if (minutes < 1) return "এইমাত্র";
  if (minutes < 60) return `${minutes} মিনিট আগে`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ঘণ্টা আগে`;
  return `${Math.round(hours / 24)} দিন আগে`;
};
