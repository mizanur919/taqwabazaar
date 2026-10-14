import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ColumnChart, Heatmap, PrintReportButton } from "@/components/admin/report-charts";
import { Card, CardHeader, DeltaBadge } from "@/components/admin/ui";
import { getReport, HOUR_BLOCKS, REPORT_WEEKS, WEEKDAYS, type Report, type ReportWeeks } from "@/lib/admin/reports";
import { requireAdmin } from "@/lib/auth";
import { taka } from "@/lib/format";
import { statusLabels } from "@/lib/orders";

export const metadata: Metadata = { title: "Reports" };

const TABS = [
  { id: "revenue", label: "Revenue" },
  { id: "orders", label: "Orders" },
  { id: "returns", label: "Returns" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const dayNames: Record<string, string> = { Sat: "শনি", Sun: "রবি", Mon: "সোম", Tue: "মঙ্গল", Wed: "বুধ", Thu: "বৃহঃ", Fri: "শুক্র" };

export default function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-900/5" />}>
      {searchParams.then((sp) => {
        const weeks = (REPORT_WEEKS.find((w) => String(w) === sp.weeks) ?? 12) as ReportWeeks;
        const tab = (TABS.find((t) => t.id === sp.tab)?.id ?? "revenue") as Tab;
        return <ReportContent weeks={weeks} tab={tab} />;
      })}
    </Suspense>
  );
}

async function ReportContent({ weeks, tab }: { weeks: ReportWeeks; tab: Tab }) {
  await requireAdmin();
  const r = await getReport(weeks);
  const href = (patch: { weeks?: number; tab?: Tab }) => {
    const next = { weeks: weeks === 12 ? undefined : weeks, tab: tab === "revenue" ? undefined : tab, ...patch };
    const params = new URLSearchParams();
    if (next.weeks && next.weeks !== 12) params.set("weeks", String(next.weeks));
    if (next.tab && next.tab !== "revenue") params.set("tab", next.tab);
    const s = params.toString();
    return `/admin/reports${s ? `?${s}` : ""}`;
  };
  const vs = `আগের ${weeks} সপ্তাহের তুলনায়`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-adm-muted">
            শেষ {weeks} সপ্তাহ ({r.range}), আগের {weeks} সপ্তাহের সাথে তুলনা
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="print-hide flex rounded-lg bg-stone-900/5 p-0.5 text-xs">
            {REPORT_WEEKS.map((w) => (
              <Link key={w} href={href({ weeks: w })} scroll={false} className={`rounded-md px-3 py-1.5 ${w === weeks ? "bg-adm-ink font-semibold text-white" : "text-adm-ink-soft hover:text-adm-ink"}`}>
                {w} weeks
              </Link>
            ))}
          </div>
          <PrintReportButton />
        </div>
      </div>

      <nav className="print-hide flex gap-1 border-b border-adm-line">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={href({ tab: t.id })}
            scroll={false}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === t.id ? "border-adm-ink text-adm-ink" : "border-transparent text-adm-muted hover:text-adm-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat title={`Revenue, ${weeks} weeks`} value={taka(r.summary.revenue.value)}>
          <DeltaBadge change={r.summary.revenue.change} label={vs} />
        </Stat>
        <Stat title="Best week" value={taka(r.summary.bestWeek.value)}>
          <p className="text-xs text-adm-muted">সপ্তাহ শুরু {r.summary.bestWeek.label}</p>
        </Stat>
        <Stat title="Average order" value={taka(r.summary.avgOrder.value)}>
          <DeltaBadge change={r.summary.avgOrder.change} label={vs} />
        </Stat>
        <Stat title="Cancelled" value={pct(r.summary.cancelRate.value)}>
          <p className="text-xs text-adm-muted">
            অর্ডারের মধ্যে বাতিল · আগে ছিল {pct(r.summary.cancelRate.previous)}
          </p>
        </Stat>
      </div>

      {tab === "revenue" && <RevenueTab r={r} />}
      {tab === "orders" && <OrdersTab r={r} />}
      {tab === "returns" && <ReturnsTab r={r} />}
    </div>
  );
}

function Stat({ title, value, children }: { title: string; value: string; children?: React.ReactNode }) {
  return (
    <Card className="!p-4">
      <p className="text-xs font-medium text-adm-muted">{title}</p>
      <p className="mt-1.5 text-2xl font-bold">{value}</p>
      <div className="mt-1">{children}</div>
    </Card>
  );
}

function Meter({ rows, format = taka }: { rows: { name: string; value: number; sub?: string }[]; format?: (n: number) => string }) {
  const top = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-adm-muted">এই সময়ে কোনো ডেটা নেই</p>;
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.name} className="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-adm-ink-soft">{row.name}</span>
          <span className="h-2 rounded-full bg-adm-accent-soft">
            <span className="block h-2 rounded-full bg-adm-accent" style={{ width: `${(row.value / top) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">
            <span className="block text-xs font-semibold">{format(row.value)}</span>
            {row.sub && <span className="block text-[11px] text-adm-muted">{row.sub}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function RevenueTab({ r }: { r: Report }) {
  const total = r.byCategory.reduce((n, c) => n + c.value, 0) || 1;
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardHeader title="Weekly revenue" subtitle="প্রতি সপ্তাহের আয় (বাতিল বাদে), আগের সময়ের একই সপ্তাহের পাশে" />
          <ColumnChart data={r.weekly.map((w) => ({ label: w.label, current: w.current, previous: w.previous }))} />
        </Card>
        <Card>
          <CardHeader title="Revenue by category" subtitle={`শেষ ${r.weeks} সপ্তাহ`} />
          <Meter rows={r.byCategory.map((c) => ({ name: c.name, value: c.value, sub: `${((c.value / total) * 100).toFixed(0)}%` }))} />
        </Card>
      </div>
      <Card>
        <CardHeader title="When orders arrive" subtitle={`সপ্তাহের কোন দিন, কোন সময়ে অর্ডার আসে (বাংলাদেশ সময়, শেষ ${r.weeks} সপ্তাহ)`} />
        <Heatmap rows={WEEKDAYS.map((d) => dayNames[d])} cols={HOUR_BLOCKS} values={r.heat} />
      </Card>
    </>
  );
}

function OrdersTab({ r }: { r: Report }) {
  const statuses = (Object.keys(r.statusCounts) as (keyof typeof r.statusCounts)[]).map((s) => ({ name: statusLabels[s], value: r.statusCounts[s] }));
  const split = (m: Record<string, { orders: number; revenue: number }>, labels: Record<string, string>) =>
    Object.entries(m).map(([k, v]) => ({ name: labels[k] ?? k, value: v.orders, sub: taka(v.revenue) }));
  const count = (n: number) => `${n}টি`;

  return (
    <>
      <Card>
        <CardHeader title="Orders per week" subtitle="প্রতি সপ্তাহে কয়টি অর্ডার এসেছে (বাতিলসহ)" />
        <ColumnChart data={r.weekly.map((w) => ({ label: w.label, current: w.orders }))} unit="count" />
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="By status" subtitle="এই সময়ের অর্ডার, এখনকার অবস্থা" />
          <Meter rows={statuses} format={count} />
        </Card>
        <Card>
          <CardHeader title="Website vs phone" subtitle="অর্ডার সংখ্যা ও আয়" />
          <Meter rows={split(r.source, { WEB: "ওয়েবসাইট", PHONE: "ফোন" })} format={count} />
        </Card>
        <Card>
          <CardHeader title="Delivery zone" subtitle="অর্ডার সংখ্যা ও আয়" />
          <Meter rows={split(r.zone, { inside: "ঢাকার ভিতরে", outside: "ঢাকার বাহিরে" })} format={count} />
        </Card>
      </div>
    </>
  );
}

function ReturnsTab({ r }: { r: Report }) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardHeader title="Cancelled orders per week" subtitle={`মোট ${r.cancelled.count}টি বাতিল, মূল্য ${taka(r.cancelled.value)}`} />
          <ColumnChart
            data={r.weekly.map((w) => ({ label: w.label, current: w.cancelled }))}
            unit="count"
            color="#c2410c"
          />
        </Card>
        <Card>
          <CardHeader title="Most cancelled products" subtitle="বাতিল অর্ডারে সবচেয়ে বেশি থাকা পণ্য" />
          <Meter rows={r.cancelled.products.map((p) => ({ name: p.name, value: p.qty, sub: taka(p.value) }))} format={(n) => `${n}টি`} />
        </Card>
      </div>
    </>
  );
}
