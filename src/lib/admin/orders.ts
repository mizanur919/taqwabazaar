// Admin order reads (always fresh).
import { connection } from "next/server";
import type { OrderStatus, Prisma } from "@prisma/client";
import { EDITABLE_STATUSES } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { isRiskLevel } from "@/lib/risk";

export const ORDER_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];
export const PAGE_SIZES = [20, 50, 100] as const;
export const DATE_PRESETS = ["today", "yesterday", "7d", "30d", "month", "custom"] as const;
export const SORTS = ["new", "old", "high", "low"] as const;

export type OrderFilters = {
  status?: OrderStatus;
  q?: string;
  source?: "WEB" | "PHONE";
  zone?: "inside" | "outside";
  date?: (typeof DATE_PRESETS)[number];
  from?: string; // YYYY-MM-DD, used with date=custom
  to?: string;
  sort?: (typeof SORTS)[number];
  /** only orders staff have edited */
  edited?: boolean;
  /** sent to a courier or not yet */
  courier?: "sent" | "unsent";
  /** fraud risk; "risky" also includes blocked numbers */
  risk?: "risky" | "caution" | "safe" | "new";
  perPage?: (typeof PAGE_SIZES)[number];
  page?: number;
};

// Bangladesh has no daylight saving, so day boundaries are a fixed +06:00.
const dhakaDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);
const startOfDhakaDay = (ymd: string) => new Date(`${ymd}T00:00:00+06:00`);
const DAY = 24 * 60 * 60 * 1000;

function dateRange(f: OrderFilters): { gte?: Date; lt?: Date } | undefined {
  const today = startOfDhakaDay(dhakaDate(new Date()));
  switch (f.date) {
    case "today":
      return { gte: today };
    case "yesterday":
      return { gte: new Date(today.getTime() - DAY), lt: today };
    case "7d":
      return { gte: new Date(today.getTime() - 6 * DAY) };
    case "30d":
      return { gte: new Date(today.getTime() - 29 * DAY) };
    case "month":
      return { gte: startOfDhakaDay(`${dhakaDate(new Date()).slice(0, 7)}-01`) };
    case "custom": {
      const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
      if (!ok(f.from) && !ok(f.to)) return undefined;
      return {
        ...(ok(f.from) ? { gte: startOfDhakaDay(f.from!) } : {}),
        ...(ok(f.to) ? { lt: new Date(startOfDhakaDay(f.to!).getTime() + DAY) } : {}),
      };
    }
    default:
      return undefined;
  }
}

const orderBy: Record<(typeof SORTS)[number], Prisma.OrderOrderByWithRelationInput[]> = {
  new: [{ createdAt: "desc" }],
  old: [{ createdAt: "asc" }],
  high: [{ total: "desc" }, { createdAt: "desc" }],
  low: [{ total: "asc" }, { createdAt: "desc" }],
};

export async function listOrders(f: OrderFilters) {
  await connection();
  // everything except the status, so the status dropdown can show counts per status
  const base: Prisma.OrderWhereInput = { deletedAt: null };
  if (f.q) {
    const q = f.q.trim();
    base.OR = [
      { orderNo: { contains: q } },
      { customerName: { contains: q } },
      { phone: { contains: q.replace(/[\s-]/g, "").replace(/^\+?88/, "") } },
      { address: { contains: q } },
    ];
  }
  if (f.source) base.source = f.source;
  if (f.zone) base.zone = f.zone;
  if (f.edited) base.editedAt = { not: null };
  if (f.courier === "sent") base.consignmentId = { not: null };
  if (f.courier === "unsent") base.consignmentId = null;
  if (f.risk === "risky") base.riskLevel = { in: ["risky", "blocked"] };
  else if (f.risk) base.riskLevel = f.risk;
  const created = dateRange(f);
  if (created) base.createdAt = created;

  const where = f.status ? { ...base, status: f.status } : base;
  const perPage = f.perPage ?? 20;

  const [total, grouped, sum] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    prisma.order.aggregate({ where: { ...where, status: f.status ?? { not: "CANCELLED" } }, _sum: { total: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, f.page ?? 1), pages);

  const rows = await prisma.order.findMany({
    where,
    orderBy: orderBy[f.sort ?? "new"],
    skip: (page - 1) * perPage,
    take: perPage,
    include: { _count: { select: { items: true } } },
  });

  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const g of grouped) counts[g.status] = g._count._all;
  const now = Date.now();

  return {
    total,
    page,
    pages,
    perPage,
    counts,
    all: Object.values(counts).reduce((a, b) => a + b, 0),
    totalValue: Number(sum._sum.total ?? 0),
    rows: rows.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      customerName: o.customerName,
      phone: o.phone,
      zone: o.zone,
      items: o._count.items,
      total: Number(o.total),
      status: o.status,
      source: o.source,
      edited: !!o.editedAt,
      trackingCode: o.trackingCode,
      courierStatus: o.courierStatus,
      sent: !!o.consignmentId,
      riskLevel: isRiskLevel(o.riskLevel) ? o.riskLevel : null,
      createdAt: o.createdAt.toISOString(),
      minutesAgo: Math.max(0, Math.round((now - o.createdAt.getTime()) / 60000)),
    })),
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

export async function getOrderDetail(orderNo: string) {
  await connection();
  const o = await prisma.order.findUnique({
    where: { orderNo: orderNo.toUpperCase() },
    include: { items: { orderBy: { id: "asc" } }, history: { orderBy: { createdAt: "desc" } } },
  });
  if (!o) return null;
  // how many orders this phone number has placed / cancelled (helps spot fake orders)
  const [previous, cancelled] = await Promise.all([
    prisma.order.count({ where: { phone: o.phone, id: { not: o.id }, deletedAt: null } }),
    prisma.order.count({ where: { phone: o.phone, id: { not: o.id }, status: "CANCELLED", deletedAt: null } }),
  ]);
  return {
    id: o.id,
    orderNo: o.orderNo,
    customerName: o.customerName,
    phone: o.phone,
    address: o.address,
    zone: o.zone,
    note: o.note === "DEMO" ? null : o.note,
    isDemo: o.note === "DEMO",
    adminNote: o.adminNote ?? "",
    subtotal: Number(o.subtotal),
    shippingFee: Number(o.shippingFee),
    total: Number(o.total),
    payment: o.payment,
    status: o.status,
    source: o.source,
    createdAt: o.createdAt.toISOString(),
    /** for the edit form: rejects the save if someone changed the order meanwhile */
    version: o.updatedAt.toISOString(),
    editedAt: o.editedAt?.toISOString() ?? null,
    editable: EDITABLE_STATUSES.includes(o.status) && !o.deletedAt,
    deletedAt: o.deletedAt?.toISOString() ?? null,
    deletedBy: o.deletedBy,
    courier: o.consignmentId
      ? {
          name: o.courier ?? "steadfast",
          consignmentId: o.consignmentId,
          trackingCode: o.trackingCode,
          status: o.courierStatus,
          cod: o.courierCod === null ? null : Number(o.courierCod),
          sentAt: o.courierSentAt?.toISOString() ?? null,
          sentBy: o.courierSentBy,
          checkedAt: o.courierCheckedAt?.toISOString() ?? null,
        }
      : null,
    customerHistory: { previous, cancelled },
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      name: i.name,
      variantName: i.variantName,
      image: i.image,
      unitPrice: Number(i.unitPrice),
      quantity: i.quantity,
    })),
    history: o.history.map((h) => ({
      id: h.id,
      status: h.status,
      message: h.message,
      details: parseDetails(h.details),
      adminName: h.adminName,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

function parseDetails(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

// ───────────── Trash ─────────────

export async function listTrash() {
  await connection();
  const rows = await prisma.order.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    take: 500,
    include: { items: { select: { name: true, variantName: true, quantity: true } } },
  });
  return rows.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    customerName: o.customerName,
    phone: o.phone,
    total: Number(o.total),
    status: o.status,
    items: o.items.map((i) => `${i.name}${i.variantName ? ` (${i.variantName})` : ""} ×${i.quantity}`),
    restocked: o.trashRestocked,
    createdAt: o.createdAt.toISOString(),
    deletedAt: o.deletedAt!.toISOString(),
    deletedBy: o.deletedBy,
  }));
}

export async function countTrash() {
  await connection();
  return prisma.order.count({ where: { deletedAt: { not: null } } });
}
