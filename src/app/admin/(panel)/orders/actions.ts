"use server";

import { updateTag } from "next/cache";
import { after } from "next/server";
import type { OrderStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { refreshRisk, refreshRiskQuietly } from "@/lib/fraud";
import { isRiskLevel, type RiskLevel } from "@/lib/risk";
import { isReady, readSteadfastSettings, refreshCourierStatus, sendBlocker, sendOrder, type SendInput, type SendResult } from "@/lib/courier";
import { ORDER_STATUSES } from "@/lib/admin/orders";
import {
  changeOrderStatus,
  createOrder,
  editOrder,
  normalizePhone,
  purgeOrders,
  restoreOrder,
  trashOrder,
  type CreateOrderResult,
  type EditOrderInput,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export async function updateOrderStatus(orderId: number, status: OrderStatus) {
  const admin = await requireAdmin();
  if (!ORDER_STATUSES.includes(status)) return { ok: false as const, error: "অজানা স্ট্যাটাস" };
  const result = await changeOrderStatus(Number(orderId), status, admin.name);
  if (result.ok) updateTag("catalog"); // stock may have changed
  return result;
}

export async function saveAdminNote(orderId: number, note: string) {
  const admin = await requireAdmin();
  const text = String(note ?? "").trim().slice(0, 1000);
  const order = await prisma.order.findUnique({ where: { id: Number(orderId) }, select: { id: true, adminNote: true, deletedAt: true } });
  if (!order || order.deletedAt) return { ok: false as const, error: "অর্ডার পাওয়া যায়নি" };
  if ((order.adminNote ?? "") === text) return { ok: true as const };
  await prisma.order.update({ where: { id: order.id }, data: { adminNote: text || null } });
  await prisma.orderStatusLog.create({
    data: { orderId: order.id, message: text ? "অ্যাডমিন নোট আপডেট হয়েছে" : "অ্যাডমিন নোট মুছে ফেলা হয়েছে", adminName: admin.name },
  });
  return { ok: true as const };
}

export type PickerProduct = {
  id: number;
  name: string;
  image: string | null;
  price: number;
  stock: number;
  variants: { id: number; name: string; price: number; stock: number }[];
};

/** Product search for the manual (phone) order form. */
export async function findProductsForOrder(query: string): Promise<PickerProduct[]> {
  await requireAdmin();
  const q = String(query ?? "").trim().slice(0, 80);
  if (q.length < 2) return [];
  const rows = await prisma.product.findMany({
    where: { isActive: true, OR: [{ name: { contains: q } }, { nameBn: { contains: q } }, { sku: { contains: q } }] },
    take: 8,
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      variants: { where: { isActive: true }, orderBy: { id: "asc" } },
    },
  });
  return rows.map((p) => {
    const price = Number(p.salePrice ?? p.price);
    return {
      id: p.id,
      name: p.name,
      image: p.images[0]?.url ?? null,
      price,
      stock: p.stock,
      variants: p.variants.map((v) => ({ id: v.id, name: v.name, price: v.price === null ? price : Number(v.price), stock: v.stock })),
    };
  });
}

export type ManualOrderInput = {
  name: string;
  phone: string;
  address: string;
  zone: string;
  note: string;
  shippingFee: string;
  status: "PENDING" | "CONFIRMED";
  items: { productId: number; variantId: number | null; qty: number }[];
};

export async function createManualOrder(input: ManualOrderInput): Promise<CreateOrderResult> {
  const admin = await requireAdmin();
  const fee = String(input?.shippingFee ?? "").trim();
  const result = await createOrder({
    name: input?.name,
    phone: input?.phone,
    address: input?.address,
    zone: input?.zone,
    note: input?.note,
    items: Array.isArray(input?.items) ? input.items : [],
    source: "PHONE",
    status: input?.status === "PENDING" ? "PENDING" : "CONFIRMED",
    adminName: admin.name,
    shippingFee: fee === "" ? undefined : Number(fee),
  });
  if (result.ok) {
    updateTag("catalog");
    after(() => refreshRiskQuietly(normalizePhone(input.phone), "auto"));
  }
  return result;
}

// ───────────── Edit ─────────────

export async function saveOrderEdit(orderId: number, input: EditOrderInput) {
  const admin = await requireAdmin();
  const result = await editOrder(Number(orderId), input, admin.name);
  if (result.ok) updateTag("catalog"); // stock may have changed
  return result;
}

// ───────────── Trash ─────────────

type TrashResult = { ok: true; message?: string } | { ok: false; error: string };

const ownerOnly = { ok: false as const, error: "শুধু Administrator এটা করতে পারবেন" };

/** Anyone on the team can move an order to the Trash. */
export async function moveOrderToTrash(orderId: number): Promise<TrashResult> {
  const admin = await requireAdmin();
  const result = await trashOrder(Number(orderId), admin.name);
  if (result.ok) updateTag("catalog");
  return result;
}

/** Administrator only. Restores each order on its own, so one out-of-stock order doesn't block the rest. */
export async function restoreOrders(ids: number[]): Promise<TrashResult> {
  const admin = await requireAdmin();
  if (admin.role !== "ADMIN") return ownerOnly;
  const list = (Array.isArray(ids) ? ids : []).slice(0, 500);
  let restored = 0;
  const errors: string[] = [];
  for (const id of list) {
    const r = await restoreOrder(Number(id), admin.name);
    if (r.ok) restored++;
    else errors.push(r.error);
  }
  if (restored) updateTag("catalog");
  if (errors.length) return { ok: false, error: `${restored}টি ফেরত আনা হয়েছে। ${errors.join(" · ")}` };
  return { ok: true, message: `${restored}টি অর্ডার ফেরত আনা হয়েছে` };
}

/** Administrator only. ids = null empties the whole Trash. */
export async function deleteOrdersForever(ids: number[] | null): Promise<TrashResult> {
  const admin = await requireAdmin();
  if (admin.role !== "ADMIN") return ownerOnly;
  const list = ids === null ? (await prisma.order.findMany({ where: { deletedAt: { not: null } }, select: { id: true } })).map((o) => o.id) : ids;
  const count = await purgeOrders((Array.isArray(list) ? list : []).slice(0, 5000));
  return { ok: true, message: `${count}টি অর্ডার চিরতরে মুছে ফেলা হয়েছে` };
}

// ───────────── Courier (Steadfast) ─────────────

export type CourierPreviewRow = {
  id: number;
  orderNo: string;
  customerName: string;
  phone: string;
  address: string;
  total: number;
  items: string;
  blocker: string | null;
  riskLevel: RiskLevel | null;
};

const MAX_SEND = 100;

/** What will be sent, so staff can check COD amounts before booking. */
export async function getCourierPreview(ids: number[]): Promise<{ ok: true; rows: CourierPreviewRow[] } | { ok: false; error: string }> {
  await requireAdmin();
  const s = await readSteadfastSettings();
  if (!isReady(s)) return { ok: false, error: "Steadfast চালু করা নেই। Settings → Courier থেকে API Key দিয়ে চালু করুন।" };
  const list = (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger).slice(0, MAX_SEND);
  const orders = await prisma.order.findMany({ where: { id: { in: list } }, include: { items: true }, orderBy: { id: "asc" } });
  return {
    ok: true,
    rows: orders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      customerName: o.customerName,
      phone: o.phone,
      address: o.address,
      total: Number(o.total),
      items: o.items.map((i) => `${i.name}${i.variantName ? ` (${i.variantName})` : ""} ×${i.quantity}`).join(", "),
      blocker: sendBlocker(o),
      riskLevel: isRiskLevel(o.riskLevel) ? o.riskLevel : null,
    })),
  };
}

/** Books the orders with Steadfast, a few at a time; every order gets its own success or error. */
export async function sendToCourier(input: SendInput[]): Promise<{ ok: true; results: SendResult[] } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  const s = await readSteadfastSettings();
  if (!isReady(s)) return { ok: false, error: "Steadfast চালু করা নেই" };
  const list = (Array.isArray(input) ? input : []).slice(0, MAX_SEND);
  const results: SendResult[] = [];
  for (let i = 0; i < list.length; i += 4) {
    results.push(...(await Promise.all(list.slice(i, i + 4).map((x) => sendOrder(s, x, admin.name)))));
  }
  if (results.some((r) => r.ok)) updateTag("catalog");
  return { ok: true, results };
}

/** Asks Steadfast for the latest status of the given (already sent) orders. */
export async function refreshCourierStatuses(ids: number[]): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const s = await readSteadfastSettings();
  if (!s.apiKey || !s.secretKey) return { ok: false, message: "Steadfast-এর API Key দেওয়া নেই" };
  const list = (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger).slice(0, MAX_SEND);
  let done = 0;
  const errors: string[] = [];
  for (let i = 0; i < list.length; i += 4) {
    const batch = await Promise.all(list.slice(i, i + 4).map((id) => refreshCourierStatus(s, id)));
    for (const r of batch) {
      if (r.ok) done++;
      else errors.push(r.error);
    }
  }
  return errors.length
    ? { ok: false, message: `${done}টি আপডেট হয়েছে। ${[...new Set(errors)].join(" · ")}` }
    : { ok: true, message: `${done}টি অর্ডারের স্ট্যাটাস আপডেট হয়েছে` };
}

/** The returned parcel is back in hand: cancel the order and put the items back on the shelf. */
export async function confirmCourierReturn(orderId: number) {
  const admin = await requireAdmin();
  const order = await prisma.order.findUnique({ where: { id: Number(orderId) }, select: { id: true, consignmentId: true, status: true } });
  if (!order?.consignmentId) return { ok: false as const, error: "অর্ডারটি কুরিয়ারে পাঠানো হয়নি" };
  if (order.status === "CANCELLED") return { ok: true as const };
  await prisma.orderStatusLog.create({ data: { orderId: order.id, message: "কুরিয়ার থেকে পার্সেল ফেরত পাওয়া গেছে", adminName: admin.name } });
  const result = await changeOrderStatus(order.id, "CANCELLED", admin.name);
  if (result.ok) updateTag("catalog");
  return result;
}

// ───────────── Fraud check ─────────────

/** Looks the number up at BD Courier now (ignoring the one-day cache) and updates its risk. */
export async function runFraudCheck(phone: string) {
  await requireAdmin();
  const p = normalizePhone(phone);
  if (!/^01[3-9]\d{8}$/.test(p)) return { ok: false as const, error: "সঠিক মোবাইল নাম্বার নয়" };
  const r = await refreshRisk(p, "force");
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
}

/** Marks a number as fake. Orders from it are still accepted, but flagged. */
export async function blockPhone(phone: string, reason: string) {
  const admin = await requireAdmin();
  const p = normalizePhone(phone);
  if (!/^01[3-9]\d{8}$/.test(p)) return { ok: false as const, error: "সঠিক মোবাইল নাম্বার দিন" };
  const why = String(reason ?? "").trim().slice(0, 255);
  if (why.length < 3) return { ok: false as const, error: "কেন ব্লক করছেন তা লিখুন" };
  await prisma.blockedPhone.upsert({
    where: { phone: p },
    create: { phone: p, reason: why, blockedBy: admin.name },
    update: { reason: why, blockedBy: admin.name },
  });
  await refreshRiskQuietly(p);
  return { ok: true as const };
}

export async function unblockPhone(phone: string) {
  await requireAdmin();
  const p = normalizePhone(phone);
  await prisma.blockedPhone.deleteMany({ where: { phone: p } });
  await refreshRiskQuietly(p);
  return { ok: true as const };
}
