// Customers = everyone who has ordered, grouped by phone number (there are no customer accounts yet).
import { connection } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const CUSTOMER_PAGE_SIZE = 20;
export const CUSTOMER_TABS = ["all", "new", "repeat", "risky"] as const;
export const CUSTOMER_SORTS = ["recent", "spent", "orders"] as const;
export type CustomerTab = (typeof CUSTOMER_TABS)[number];
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export type CustomerRow = {
  phone: string;
  name: string;
  address: string;
  orders: number;
  delivered: number;
  cancelled: number;
  spent: number; // excluding cancelled orders
  firstOrder: string;
  lastOrder: string;
  minutesAgo: number; // since the last order
  tag: "new" | "repeat" | "risky" | null;
};

/** Repeat = 3+ orders. Risky = 2+ cancellations, or at least half of 2+ orders cancelled. */
const tagOf = (orders: number, cancelled: number): CustomerRow["tag"] => {
  if (cancelled >= 2 || (orders >= 2 && cancelled / orders >= 0.5)) return "risky";
  if (orders >= 3) return "repeat";
  if (orders === 1) return "new";
  return null;
};

async function aggregate(filter: Prisma.OrderWhereInput) {
  const where: Prisma.OrderWhereInput = { ...filter, deletedAt: null };
  const [all, notCancelled, cancelled, delivered] = await Promise.all([
    prisma.order.groupBy({
      by: ["phone"],
      where,
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
    prisma.order.groupBy({ by: ["phone"], where: { ...where, status: { not: "CANCELLED" } }, _sum: { total: true } }),
    prisma.order.groupBy({ by: ["phone"], where: { ...where, status: "CANCELLED" }, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["phone"], where: { ...where, status: "DELIVERED" }, _count: { _all: true } }),
  ]);
  const spent = new Map(notCancelled.map((g) => [g.phone, Number(g._sum.total ?? 0)]));
  const cancels = new Map(cancelled.map((g) => [g.phone, g._count._all]));
  const delivers = new Map(delivered.map((g) => [g.phone, g._count._all]));
  return all.map((g) => {
    const orders = g._count._all;
    const c = cancels.get(g.phone) ?? 0;
    return {
      phone: g.phone,
      orders,
      cancelled: c,
      delivered: delivers.get(g.phone) ?? 0,
      spent: spent.get(g.phone) ?? 0,
      firstOrder: g._min.createdAt!,
      lastOrder: g._max.createdAt!,
      tag: tagOf(orders, c),
    };
  });
}

/** Latest name and address each phone used. */
async function latestDetails(phones: string[]) {
  if (!phones.length) return new Map<string, { name: string; address: string }>();
  const rows = await prisma.order.findMany({
    where: { phone: { in: phones }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { phone: true, customerName: true, address: true },
  });
  const map = new Map<string, { name: string; address: string }>();
  for (const r of rows) if (!map.has(r.phone)) map.set(r.phone, { name: r.customerName, address: r.address });
  return map;
}

export async function listCustomers(f: { tab?: CustomerTab; q?: string; sort?: CustomerSort; page?: number }) {
  await connection();
  const where: Prisma.OrderWhereInput = {};
  if (f.q) {
    const q = f.q.trim();
    where.OR = [{ customerName: { contains: q } }, { phone: { contains: q.replace(/[\s-]/g, "").replace(/^\+?88/, "") } }];
  }
  const everyone = await aggregate(where);

  const counts = {
    all: everyone.length,
    new: everyone.filter((c) => c.tag === "new").length,
    repeat: everyone.filter((c) => c.tag === "repeat").length,
    risky: everyone.filter((c) => c.tag === "risky").length,
  };

  const tab = f.tab ?? "all";
  const filtered = tab === "all" ? everyone : everyone.filter((c) => c.tag === tab);
  const sort = f.sort ?? "recent";
  filtered.sort((a, b) =>
    sort === "spent"
      ? b.spent - a.spent
      : sort === "orders"
        ? b.orders - a.orders || b.spent - a.spent
        : b.lastOrder.getTime() - a.lastOrder.getTime(),
  );

  const pages = Math.max(1, Math.ceil(filtered.length / CUSTOMER_PAGE_SIZE));
  const page = Math.min(Math.max(1, f.page ?? 1), pages);
  const slice = filtered.slice((page - 1) * CUSTOMER_PAGE_SIZE, page * CUSTOMER_PAGE_SIZE);
  const details = await latestDetails(slice.map((c) => c.phone));
  const now = Date.now();

  const rows: CustomerRow[] = slice.map((c) => ({
    ...c,
    name: details.get(c.phone)?.name ?? "",
    address: details.get(c.phone)?.address ?? "",
    firstOrder: c.firstOrder.toISOString(),
    lastOrder: c.lastOrder.toISOString(),
    minutesAgo: Math.max(0, Math.round((now - c.lastOrder.getTime()) / 60000)),
  }));

  return { rows, counts, total: filtered.length, page, pages };
}

/** Every customer matching the filters, for CSV export. */
export async function exportCustomers(f: { tab?: CustomerTab; q?: string }) {
  const where: Prisma.OrderWhereInput = {};
  if (f.q) where.OR = [{ customerName: { contains: f.q } }, { phone: { contains: f.q } }];
  const everyone = (await aggregate(where)).filter((c) => !f.tab || f.tab === "all" || c.tag === f.tab);
  everyone.sort((a, b) => b.spent - a.spent);
  const details = await latestDetails(everyone.map((c) => c.phone));
  return everyone.map((c) => ({ ...c, name: details.get(c.phone)?.name ?? "", address: details.get(c.phone)?.address ?? "" }));
}

export type CustomerDetail = NonNullable<Awaited<ReturnType<typeof getCustomer>>>;

export async function getCustomer(phone: string) {
  await connection();
  const orders = await prisma.order.findMany({
    where: { phone, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { name: true, variantName: true, quantity: true, unitPrice: true, productId: true } } },
  });
  if (!orders.length) return null;

  const products = new Map<string, { name: string; qty: number; productId: number | null }>();
  for (const o of orders) {
    if (o.status === "CANCELLED") continue;
    for (const i of o.items) {
      const key = `${i.productId ?? i.name}`;
      const cur = products.get(key) ?? { name: i.name, qty: 0, productId: i.productId };
      cur.qty += i.quantity;
      products.set(key, cur);
    }
  }
  const live = orders.filter((o) => o.status !== "CANCELLED");
  const cancelled = orders.length - live.length;
  const spent = live.reduce((n, o) => n + Number(o.total), 0);

  return {
    phone,
    name: orders[0].customerName,
    address: orders[0].address,
    names: [...new Set(orders.map((o) => o.customerName))],
    stats: {
      orders: orders.length,
      delivered: orders.filter((o) => o.status === "DELIVERED").length,
      cancelled,
      spent,
      avgOrder: live.length ? spent / live.length : 0,
      firstOrder: orders.at(-1)!.createdAt.toISOString(),
      lastOrder: orders[0].createdAt.toISOString(),
    },
    tag: tagOf(orders.length, cancelled),
    topProducts: [...products.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
    orders: orders.map((o) => ({
      orderNo: o.orderNo,
      status: o.status,
      total: Number(o.total),
      items: o.items.reduce((n, i) => n + i.quantity, 0),
      createdAt: o.createdAt.toISOString(),
    })),
  };
}
