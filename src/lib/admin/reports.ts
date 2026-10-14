// Reports: the last N weeks against the N weeks before. All dates in Bangladesh time.
import { connection } from "next/server";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const REPORT_WEEKS = [4, 12, 26] as const;
export type ReportWeeks = (typeof REPORT_WEEKS)[number];

const DAY = 24 * 60 * 60 * 1000;
const dhakaParts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dhaka", weekday: "short", hour: "numeric", hourCycle: "h23" });
// Bangladesh week starts on Saturday
export const WEEKDAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"] as const;
export const HOUR_BLOCKS = ["12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p"] as const;

const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });

export async function getReport(weeks: ReportWeeks) {
  await connection();
  const now = Date.now();
  const span = weeks * 7 * DAY;
  const start = new Date(now - span);
  const prevStart = new Date(now - 2 * span);

  const [orders, categories] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: prevStart }, deletedAt: null },
      select: {
        total: true,
        status: true,
        source: true,
        zone: true,
        createdAt: true,
        items: { select: { name: true, quantity: true, unitPrice: true, productId: true, product: { select: { categoryId: true } } } },
      },
    }),
    prisma.category.findMany({ select: { id: true, name: true } }),
  ]);

  const current = orders.filter((o) => o.createdAt >= start);
  const previous = orders.filter((o) => o.createdAt < start);
  const live = (list: typeof orders) => list.filter((o) => o.status !== "CANCELLED");
  const revenue = (list: typeof orders) => live(list).reduce((n, o) => n + Number(o.total), 0);

  // weekly buckets: index 0 = oldest week of the period
  const weekIndex = (d: Date, from: Date) => Math.min(weeks - 1, Math.floor((d.getTime() - from.getTime()) / (7 * DAY)));
  const weekly = Array.from({ length: weeks }, (_, i) => ({
    label: shortDate(new Date(start.getTime() + i * 7 * DAY)),
    current: 0,
    previous: 0,
    orders: 0,
    cancelled: 0,
  }));
  for (const o of current) {
    const w = weekly[weekIndex(o.createdAt, start)];
    w.orders++;
    if (o.status === "CANCELLED") w.cancelled++;
    else w.current += Number(o.total);
  }
  for (const o of live(previous)) weekly[weekIndex(o.createdAt, prevStart)].previous += Number(o.total);

  const best = weekly.reduce((a, b) => (b.current > a.current ? b : a), weekly[0]);

  // revenue by category (item subtotals of non-cancelled orders)
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const byCat = new Map<string, number>();
  for (const o of live(current))
    for (const i of o.items) {
      const name = (i.product && catName.get(i.product.categoryId)) ?? "Other";
      byCat.set(name, (byCat.get(name) ?? 0) + Number(i.unitPrice) * i.quantity);
    }

  // when orders arrive: weekday × 3-hour block (all orders, cancelled included)
  const heat = WEEKDAYS.map(() => HOUR_BLOCKS.map(() => 0));
  for (const o of current) {
    const parts = dhakaParts.formatToParts(o.createdAt);
    const day = WEEKDAYS.indexOf(parts.find((p) => p.type === "weekday")!.value as (typeof WEEKDAYS)[number]);
    const hour = Number(parts.find((p) => p.type === "hour")!.value);
    if (day >= 0) heat[day][Math.floor(hour / 3)]++;
  }

  // orders tab
  const statusCounts: Record<OrderStatus, number> = { PENDING: 0, CONFIRMED: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 };
  for (const o of current) statusCounts[o.status]++;
  const split = (key: "source" | "zone") => {
    const m = new Map<string, { orders: number; revenue: number }>();
    for (const o of current) {
      const cur = m.get(o[key]) ?? { orders: 0, revenue: 0 };
      cur.orders++;
      if (o.status !== "CANCELLED") cur.revenue += Number(o.total);
      m.set(o[key], cur);
    }
    return Object.fromEntries(m);
  };

  // returns tab: most cancelled products
  const cancelledProducts = new Map<string, { name: string; qty: number; value: number }>();
  for (const o of current.filter((o) => o.status === "CANCELLED"))
    for (const i of o.items) {
      const key = String(i.productId ?? i.name);
      const cur = cancelledProducts.get(key) ?? { name: i.name, qty: 0, value: 0 };
      cur.qty += i.quantity;
      cur.value += Number(i.unitPrice) * i.quantity;
      cancelledProducts.set(key, cur);
    }

  const cancelRate = (list: typeof orders) => (list.length ? (list.length - live(list).length) / list.length : 0);
  const avg = (list: typeof orders) => (live(list).length ? revenue(list) / live(list).length : 0);
  const change = (a: number, b: number) => (b > 0 ? (a - b) / b : null);

  return {
    weeks,
    range: `${shortDate(start)} – ${shortDate(new Date(now))}`,
    summary: {
      revenue: { value: revenue(current), change: change(revenue(current), revenue(previous)) },
      bestWeek: { value: best?.current ?? 0, label: best?.label ?? "" },
      avgOrder: { value: avg(current), change: change(avg(current), avg(previous)) },
      cancelRate: { value: cancelRate(current), previous: cancelRate(previous) },
      orders: { value: current.length, change: change(current.length, previous.length) },
    },
    weekly,
    byCategory: [...byCat.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    heat,
    statusCounts,
    source: split("source"),
    zone: split("zone"),
    cancelled: {
      count: current.length - live(current).length,
      value: current.filter((o) => o.status === "CANCELLED").reduce((n, o) => n + Number(o.total), 0),
      products: [...cancelledProducts.values()].sort((a, b) => b.qty - a.qty).slice(0, 8),
    },
  };
}

export type Report = Awaited<ReturnType<typeof getReport>>;
