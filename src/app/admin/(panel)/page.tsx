import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, Download, Package, ShoppingBag, Wallet } from "lucide-react";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { Card, CardHeader, DeltaBadge, Sparkline, StatusPill, timeAgo } from "@/components/admin/ui";
import { getOverview, RANGES, type RangeDays } from "@/lib/admin/overview";
import { requireAdmin } from "@/lib/auth";
import { taka } from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      {searchParams.then(({ range }) => (
        <OverviewContent range={(RANGES.find((r) => String(r) === range) ?? 30) as RangeDays} />
      ))}
    </Suspense>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-12 w-72 animate-pulse rounded-lg bg-stone-900/5" />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="h-80 animate-pulse rounded-2xl bg-stone-900/5" />
        <div className="h-80 animate-pulse rounded-2xl bg-stone-900/5" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl bg-stone-900/5" />
        ))}
      </div>
    </div>
  );
}

async function OverviewContent({ range }: { range: RangeDays }) {
  await requireAdmin();
  const data = await getOverview(range);
  const vs = `আগের ${range} দিনের তুলনায়`;

  const stages = [
    { key: "PENDING", label: "New", color: "var(--adm-stage-1)" },
    { key: "CONFIRMED", label: "Confirmed", color: "var(--adm-stage-2)" },
    { key: "SHIPPED", label: "Shipped", color: "var(--adm-stage-3)" },
    { key: "DELIVERED", label: "Delivered", color: "var(--adm-stage-4)" },
  ] as const;
  const stageTotal = stages.reduce((n, s) => n + data.pipeline[s.key], 0);
  const topCategory = Math.max(...data.revenueByCategory.map((c) => c.value), 1);
  const topSeller = Math.max(...data.topSellers.map((s) => s.qty), 1);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-adm-muted">কী বিক্রি হচ্ছে, কী শেষ হয়ে আসছে, আর কোন অর্ডার অপেক্ষায় আছে</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/admin/export?range=${range}`}
            className="flex items-center gap-1.5 rounded-lg border border-adm-line bg-white px-3 py-2 text-sm font-medium hover:bg-stone-50"
          >
            <Download className="size-4" /> Export
          </a>
          <Link href="/admin/orders" className="flex items-center gap-1.5 rounded-lg bg-adm-ink px-3 py-2 text-sm font-semibold text-white hover:bg-stone-800">
            <ShoppingBag className="size-4" /> Orders
          </Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Revenue</h2>
              <p className="text-xs text-adm-muted">বাতিল অর্ডার বাদে, ডেলিভারি চার্জসহ</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <span className="text-4xl font-bold">{taka(data.revenue.value)}</span>
                <DeltaBadge change={data.revenue.change} label={vs} />
              </div>
            </div>
            <div className="flex rounded-lg bg-stone-900/5 p-0.5 text-xs">
              {RANGES.map((r) => (
                <Link
                  key={r}
                  href={`/admin?range=${r}`}
                  scroll={false}
                  className={`rounded-md px-3 py-1.5 ${r === range ? "bg-adm-ink font-semibold text-white" : "text-adm-ink-soft hover:text-adm-ink"}`}
                >
                  {r} days
                </Link>
              ))}
            </div>
          </div>
          <RevenueChart points={data.revenueSeries} />
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard icon={ShoppingBag} title="Orders" value={data.orders.value.toLocaleString("en-IN")}>
            <DeltaBadge change={data.orders.change} label={vs} />
            <Sparkline values={data.ordersSeries} className="mt-2" />
          </StatCard>
          <StatCard icon={Package} title="Items sold" value={data.itemsSold.value.toLocaleString("en-IN")}>
            <DeltaBadge change={data.itemsSold.change} label={vs} />
          </StatCard>
          <StatCard icon={AlertTriangle} title="Running low" value={String(data.lowStock.count)} tone="warn">
            <p className="text-xs text-adm-muted">{data.lowStock.outOfStock} টি স্টক শেষ</p>
            <ul className="mt-2 space-y-1 text-xs">
              {data.lowStock.items.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="truncate">{p.name}</span>
                  <span className={`shrink-0 font-semibold ${p.stock <= 0 ? "text-red-700" : "text-orange-700"}`}>
                    {p.stock <= 0 ? "Out" : `${p.stock} left`}
                  </span>
                </li>
              ))}
              {data.lowStock.items.length === 0 && <li className="text-adm-muted">সব প্রোডাক্টের পর্যাপ্ত স্টক আছে</li>}
            </ul>
          </StatCard>
          <StatCard icon={Wallet} title="Average order" value={taka(data.avgOrder.value)}>
            <DeltaBadge change={data.avgOrder.change} label={vs} />
          </StatCard>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Order pipeline" subtitle={`গত ${range} দিনের অর্ডার, ধাপ অনুযায়ী`} action={<Link href="/admin/orders" className="text-xs font-semibold text-adm-accent-strong hover:underline">All orders</Link>} />
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-stone-900/5" role="img" aria-label="Order pipeline">
            {stageTotal > 0 &&
              stages.map((s) =>
                data.pipeline[s.key] ? (
                  <div key={s.key} style={{ width: `${(data.pipeline[s.key] / stageTotal) * 100}%`, background: s.color }} title={`${s.label}: ${data.pipeline[s.key]}`} />
                ) : null,
              )}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {stages.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
                <span className="flex-1 text-adm-ink-soft">{s.label}</span>
                <span className="font-semibold tabular-nums">{data.pipeline[s.key]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-adm-muted">{data.pipeline.CANCELLED} টি অর্ডার বাতিল হয়েছে</p>
        </Card>

        <Card>
          <CardHeader title="Revenue by category" subtitle={`গত ${range} দিন`} />
          <ul className="space-y-3">
            {data.revenueByCategory.map((c) => (
              <li key={c.name} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate text-adm-ink-soft">{c.name}</span>
                <span className="h-2 rounded-full bg-adm-accent-soft">
                  <span className="block h-2 rounded-full bg-adm-accent" style={{ width: `${(c.value / topCategory) * 100}%` }} />
                </span>
                <span className="w-16 text-right text-xs font-semibold tabular-nums">{taka(c.value)}</span>
              </li>
            ))}
            {data.revenueByCategory.length === 0 && <li className="text-sm text-adm-muted">এই সময়ে কোনো বিক্রি নেই</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Top sellers" subtitle={`বিক্রিত ইউনিট, গত ${range} দিন`} action={<Link href="/admin/products" className="text-xs font-semibold text-adm-accent-strong hover:underline">Catalogue</Link>} />
          <ol className="space-y-3">
            {data.topSellers.map((s, i) => (
              <li key={s.name} className="flex items-center gap-3 text-sm">
                <span className="w-4 text-xs text-adm-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name}</p>
                  <span className="mt-1 block h-1.5 rounded-full bg-adm-accent-soft">
                    <span className="block h-1.5 rounded-full bg-adm-accent" style={{ width: `${(s.qty / topSeller) * 100}%` }} />
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{s.qty}</p>
                  <p className="text-[11px] text-adm-muted">{taka(s.revenue)}</p>
                </div>
              </li>
            ))}
            {data.topSellers.length === 0 && <li className="text-sm text-adm-muted">এই সময়ে কোনো বিক্রি নেই</li>}
          </ol>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent orders" subtitle="সর্বশেষ ৮টি অর্ডার" action={<Link href="/admin/orders" className="text-xs font-semibold text-adm-accent-strong hover:underline">সব দেখুন</Link>} />
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-adm-line text-left text-xs text-adm-muted">
                <th className="px-5 py-2 font-medium">When</th>
                <th className="px-2 py-2 font-medium">Order</th>
                <th className="px-2 py-2 font-medium">Customer</th>
                <th className="px-2 py-2 text-right font-medium">Items</th>
                <th className="px-2 py-2 text-right font-medium">Total</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((o) => (
                <tr key={o.id} className="border-b border-adm-line/70 last:border-0 hover:bg-stone-900/[0.02]">
                  <td className="px-5 py-2.5 text-xs text-adm-muted">{timeAgo(o.minutesAgo)}</td>
                  <td className="px-2 py-2.5 font-semibold">
                    <Link href={`/admin/orders?order=${o.orderNo}`} className="hover:underline">
                      {o.orderNo}
                    </Link>
                  </td>
                  <td className="px-2 py-2.5">{o.customerName}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{o.items}</td>
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{taka(o.total)}</td>
                  <td className="px-5 py-2.5">
                    <StatusPill status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  tone,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  tone?: "warn";
  children?: React.ReactNode;
}) {
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className={`grid size-7 place-items-center rounded-lg ${tone === "warn" ? "bg-orange-50 text-orange-600" : "bg-adm-accent-soft text-adm-accent-strong"}`}>
          <Icon className="size-4" />
        </span>
        {title}
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <div className="mt-1">{children}</div>
    </Card>
  );
}
