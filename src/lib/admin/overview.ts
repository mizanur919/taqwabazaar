// Admin dashboard queries. Always fresh (no "use cache"): admins need live numbers.
import { connection } from "next/server";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// each product has its own threshold (Product.lowStockAt)
const lowStockWhere = () => ({ isActive: true, stock: { lte: prisma.product.fields.lowStockAt } });
export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

const DAY = 24 * 60 * 60 * 1000;
const dhakaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" });
const dayKey = (d: Date) => dhakaDay.format(d); // YYYY-MM-DD in Bangladesh time

export async function getSidebarCounts() {
  await connection();
  const [pendingOrders, lowStock] = await Promise.all([
    prisma.order.count({ where: { status: "PENDING", deletedAt: null } }),
    prisma.product.count({ where: lowStockWhere() }),
  ]);
  return { pendingOrders, lowStock };
}

type Delta = { value: number; previous: number; change: number | null };
const delta = (value: number, previous: number): Delta => ({
  value,
  previous,
  change: previous > 0 ? (value - previous) / previous : null,
});

export type OverviewData = Awaited<ReturnType<typeof getOverview>>;

export async function getOverview(range: RangeDays) {
  await connection();
  const now = Date.now();
  const start = new Date(now - range * DAY);
  const prevStart = new Date(now - 2 * range * DAY);

  const [orders, lowStockProducts, outOfStock, recent, categories] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: prevStart }, deletedAt: null },
      select: {
        total: true,
        status: true,
        createdAt: true,
        items: { select: { productId: true, name: true, quantity: true, unitPrice: true, product: { select: { categoryId: true } } } },
      },
    }),
    prisma.product.findMany({
      where: lowStockWhere(),
      orderBy: { stock: "asc" },
      select: { id: true, name: true, stock: true },
    }),
    prisma.product.count({ where: { isActive: true, stock: { lte: 0 } } }),
    prisma.order.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, orderNo: true, customerName: true, total: true, status: true, createdAt: true, _count: { select: { items: true } } },
    }),
    prisma.category.findMany({ select: { id: true, name: true } }),
  ]);

  const inRange = orders.filter((o) => o.createdAt >= start);
  const inPrev = orders.filter((o) => o.createdAt < start);
  const sold = (list: typeof orders) => list.filter((o) => o.status !== "CANCELLED");
  const revenueOf = (list: typeof orders) => sold(list).reduce((n, o) => n + Number(o.total), 0);
  const itemsOf = (list: typeof orders) =>
    sold(list).reduce((n, o) => n + o.items.reduce((m, i) => m + i.quantity, 0), 0);

  // daily buckets for the chart and sparklines
  const days: string[] = [];
  for (let t = now - (range - 1) * DAY; t <= now; t += DAY) days.push(dayKey(new Date(t)));
  const revenueByDay = new Map(days.map((d) => [d, 0]));
  const ordersByDay = new Map(days.map((d) => [d, 0]));
  for (const o of inRange) {
    const key = dayKey(o.createdAt);
    ordersByDay.set(key, (ordersByDay.get(key) ?? 0) + 1);
    if (o.status !== "CANCELLED") revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(o.total));
  }

  const revenue = revenueOf(inRange);
  const orderCount = inRange.length;
  const soldCount = sold(inRange).length;
  const prevSoldCount = sold(inPrev).length;

  // pipeline across all orders placed in range
  const pipeline: Record<OrderStatus, number> = { PENDING: 0, CONFIRMED: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 };
  for (const o of inRange) pipeline[o.status]++;

  // revenue by category + top sellers (item subtotals, excluding cancelled orders)
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const byCategory = new Map<string, number>();
  const bySeller = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of sold(inRange)) {
    for (const i of o.items) {
      const amount = Number(i.unitPrice) * i.quantity;
      const cat = (i.product && categoryName.get(i.product.categoryId)) ?? "Other";
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + amount);
      const key = String(i.productId ?? i.name);
      const cur = bySeller.get(key) ?? { name: i.name, qty: 0, revenue: 0 };
      cur.qty += i.quantity;
      cur.revenue += amount;
      bySeller.set(key, cur);
    }
  }

  return {
    range,
    revenue: delta(revenue, revenueOf(inPrev)),
    orders: delta(orderCount, inPrev.length),
    itemsSold: delta(itemsOf(inRange), itemsOf(inPrev)),
    avgOrder: delta(soldCount ? revenue / soldCount : 0, prevSoldCount ? revenueOf(inPrev) / prevSoldCount : 0),
    revenueSeries: days.map((d) => ({ date: d, value: revenueByDay.get(d) ?? 0 })),
    ordersSeries: days.map((d) => ordersByDay.get(d) ?? 0),
    lowStock: { count: lowStockProducts.length, outOfStock, items: lowStockProducts.slice(0, 3) },
    pipeline,
    revenueByCategory: [...byCategory.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5),
    topSellers: [...bySeller.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 5),
    recent: recent.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      customerName: o.customerName,
      total: Number(o.total),
      status: o.status,
      items: o._count.items,
      minutesAgo: Math.max(0, Math.round((now - o.createdAt.getTime()) / 60000)),
    })),
  };
}
