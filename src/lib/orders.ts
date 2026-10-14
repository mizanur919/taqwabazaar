// Order creation and status changes, shared by the storefront checkout and the admin panel.
// Prices and stock are always re-read from the database here; client values are never trusted.
import type { OrderStatus, Prisma } from "@prisma/client";
import { refreshRiskQuietly } from "./fraud";
import { taka } from "./format";
import { statusLabels } from "./order-status";
import { prisma } from "./prisma";
import { getStoreSettings, zonesFor } from "./settings";
import { deliveryZones } from "./site";
import { moveStock, StockError } from "./stock";

export const BD_PHONE = /^01[3-9]\d{8}$/;
export const normalizePhone = (v: unknown) =>
  String(v ?? "")
    .replace(/[\s-]/g, "")
    .replace(/^\+?88/, "");

export type OrderLineInput = { productId: number; variantId?: number | null; qty: number };

export type CreateOrderInput = {
  name: string;
  phone: string;
  address: string;
  zone: string;
  note?: string | null;
  items: OrderLineInput[];
  source: "WEB" | "PHONE";
  status?: OrderStatus;
  adminName?: string | null;
  shippingFee?: number; // staff may override the zone fee for phone orders
};

export type CreateOrderResult =
  | { ok: true; orderNo: string; total: number; lines: { productId: number; quantity: number; unitPrice: number }[] }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const name = String(input.name ?? "").trim();
  const phone = normalizePhone(input.phone);
  const address = String(input.address ?? "").trim();
  const note =
    String(input.note ?? "")
      .trim()
      .slice(0, 500) || null;
  const zone = zonesFor(await getStoreSettings()).find((z) => z.id === input.zone);

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "নাম লিখুন";
  if (!BD_PHONE.test(phone)) fieldErrors.phone = "সঠিক ১১ ডিজিটের মোবাইল নাম্বার দিন";
  if (address.length < 8) fieldErrors.address = "সম্পূর্ণ ঠিকানা লিখুন";
  if (!zone) fieldErrors.zone = "ডেলিভারি জোন নির্বাচন করুন";
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  // merge duplicate lines, cap quantities
  const wanted = new Map<string, { productId: number; variantId: number | null; qty: number }>();
  for (const item of Array.isArray(input.items) ? input.items.slice(0, 50) : []) {
    const productId = Number(item?.productId);
    const variantId = item?.variantId ? Number(item.variantId) : null;
    const qty = Math.floor(Number(item?.qty));
    if (!Number.isInteger(productId) || !(qty > 0) || (variantId !== null && !Number.isInteger(variantId))) continue;
    const key = `${productId}:${variantId ?? 0}`;
    const prev = wanted.get(key);
    wanted.set(key, { productId, variantId, qty: Math.min((prev?.qty ?? 0) + qty, 50) });
  }
  if (wanted.size === 0) return { ok: false, error: "কোনো পণ্য নেই" };

  const lines = [...wanted.values()];
  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(lines.map((l) => l.productId))] }, isActive: true },
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, variants: { where: { isActive: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const stale = { ok: false as const, error: "কিছু পণ্য আর পাওয়া যাচ্ছে না। কার্ট আপডেট করে আবার চেষ্টা করুন।" };

  const items: Prisma.OrderItemCreateWithoutOrderInput[] = [];
  for (const line of lines) {
    const p = byId.get(line.productId);
    if (!p) return stale;
    const variant = line.variantId ? p.variants.find((v) => v.id === line.variantId) : undefined;
    if (line.variantId && !variant) return stale;
    if (!variant && p.variants.length > 0) return stale; // product now needs a variant choice
    const label = variant ? `${p.name} (${variant.name})` : p.name;
    if ((variant ? variant.stock : p.stock) < line.qty) return { ok: false, error: `"${label}" পর্যাপ্ত স্টকে নেই` };

    items.push({
      product: { connect: { id: p.id } },
      variantId: variant?.id ?? null,
      name: p.name,
      variantName: variant?.name ?? null,
      image: p.images[0]?.url ?? null,
      unitPrice: Number(variant?.price ?? p.salePrice ?? p.price),
      quantity: line.qty,
    });
  }

  const subtotal = items.reduce((n, i) => n + Number(i.unitPrice) * i.quantity, 0);
  const override = Number(input.shippingFee);
  const shippingFee =
    input.shippingFee !== undefined && Number.isFinite(override) && override >= 0 ? override : zone!.fee;
  const status = input.status ?? "PENDING";

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNo: `TMP-${crypto.randomUUID().slice(0, 12)}`,
          customerName: name.slice(0, 120),
          phone,
          address: address.slice(0, 500),
          zone: zone!.id,
          note,
          subtotal,
          shippingFee,
          total: subtotal + shippingFee,
          status,
          source: input.source,
          items: { create: items },
          history: {
            create: {
              status,
              message: input.source === "PHONE" ? "ফোন অর্ডার এন্ট্রি করা হয়েছে" : "ওয়েবসাইট থেকে অর্ডার করা হয়েছে",
              adminName: input.adminName ?? null,
            },
          },
        },
      });
      const final = await tx.order.update({ where: { id: created.id }, data: { orderNo: `TB${100000 + created.id}` } });
      for (const line of lines) {
        await moveStock(tx, {
          productId: line.productId,
          variantId: line.variantId,
          change: -line.qty,
          reason: "ORDER",
          reference: final.orderNo,
          adminName: input.adminName ?? null,
        });
      }
      return final;
    });
  } catch (e) {
    // someone else bought the last piece between our check and the write
    if (e instanceof StockError) return { ok: false, error: e.message };
    throw e;
  }

  return {
    ok: true,
    orderNo: order.orderNo,
    total: subtotal + shippingFee,
    lines: lines.map((l, n) => ({ productId: l.productId, quantity: l.qty, unitPrice: Number(items[n].unitPrice) })),
  };
}

export { statusLabels };

/**
 * Moves an order to a new status. Cancelling returns the items to stock;
 * re-opening a cancelled order takes them out again (if still available).
 */
export async function changeOrderStatus(
  orderId: number,
  next: OrderStatus,
  adminName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let phone = "";
  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || order.deletedAt) return { ok: false as const, error: "অর্ডার পাওয়া যায়নি" };
      phone = order.phone;
      if (order.status === next) return { ok: true as const };

      const isDemo = order.note === "DEMO"; // demo orders never touched stock
      let stockDeducted = order.stockDeducted;
      let stockMessage = "";

      if (next === "CANCELLED" && order.stockDeducted && !isDemo) {
        for (const item of order.items) {
          if (!item.productId) continue; // product deleted since
          await moveStock(tx, {
            productId: item.productId,
            variantId: item.variantId,
            change: item.quantity,
            reason: "ORDER_CANCELLED",
            reference: order.orderNo,
            adminName,
          });
        }
        stockDeducted = false;
        stockMessage = " · স্টক ফেরত দেওয়া হয়েছে";
      }

      if (order.status === "CANCELLED" && next !== "CANCELLED" && !order.stockDeducted && !isDemo) {
        for (const item of order.items) {
          if (!item.productId) continue; // product deleted since; nothing to take
          try {
            await moveStock(tx, {
              productId: item.productId,
              variantId: item.variantId,
              change: -item.quantity,
              reason: "ORDER",
              reference: order.orderNo,
              note: "বাতিল অর্ডার আবার চালু",
              adminName,
            });
          } catch (e) {
            if (!(e instanceof StockError)) throw e;
            // throwing rolls back the whole transaction, including earlier items
            throw new StockError(`"${item.name}" এখন পর্যাপ্ত স্টকে নেই, তাই অর্ডারটি আবার চালু করা যাচ্ছে না`);
          }
        }
        stockDeducted = true;
        stockMessage = " · স্টক থেকে আবার কাটা হয়েছে";
      }

      await tx.order.update({ where: { id: order.id }, data: { status: next, stockDeducted } });
      await tx.orderStatusLog.create({
        data: {
          orderId: order.id,
          status: next,
          message: `${statusLabels[order.status]} → ${statusLabels[next]}${stockMessage}`,
          adminName,
        },
      });
      return { ok: true as const };
    });
    // delivered / cancelled orders change this number's track record
    if (result.ok && phone) await refreshRiskQuietly(phone);
    return result;
  } catch (e) {
    if (e instanceof StockError) return { ok: false, error: e.message };
    throw e;
  }
}

// ───────────── Editing ─────────────

/** Parcels that have left (Shipped/Delivered) or cancelled orders are locked. */
export const EDITABLE_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED"];

export type EditLineInput = {
  /** existing order item; omit for a newly added product */
  itemId?: number | null;
  productId?: number;
  variantId?: number | null;
  qty: number;
  unitPrice: number;
};

export type EditOrderInput = {
  name: string;
  phone: string;
  address: string;
  zone: string;
  note: string;
  shippingFee: number;
  items: EditLineInput[];
  /** updatedAt the form was opened with, so two people can't overwrite each other */
  version: string;
};

type Result = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const zoneLabel = (id: string) => deliveryZones.find((z) => z.id === id)?.label ?? id;
const lineLabel = (name: string, variantName: string | null) => (variantName ? `${name} (${variantName})` : name);

/**
 * Edits customer details, delivery and items of a New/Confirmed order.
 * Stock moves by the difference only, and every change is written to the order history.
 */
export async function editOrder(orderId: number, input: EditOrderInput, adminName: string): Promise<Result> {
  const name = String(input?.name ?? "").trim().slice(0, 120);
  const phone = normalizePhone(input?.phone);
  const address = String(input?.address ?? "").trim().slice(0, 500);
  const note = String(input?.note ?? "").trim().slice(0, 500) || null;
  const zone = deliveryZones.find((z) => z.id === input?.zone)?.id;
  const shippingFee = Number(input?.shippingFee);

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "নাম লিখুন";
  if (!BD_PHONE.test(phone)) fieldErrors.phone = "সঠিক ১১ ডিজিটের মোবাইল নাম্বার দিন";
  if (address.length < 8) fieldErrors.address = "সম্পূর্ণ ঠিকানা লিখুন";
  if (!zone) fieldErrors.zone = "ডেলিভারি জোন নির্বাচন করুন";
  if (!Number.isFinite(shippingFee) || shippingFee < 0 || shippingFee > 100000) fieldErrors.shippingFee = "০ বা তার বেশি সংখ্যা দিন";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "কিছু তথ্য ঠিক করতে হবে", fieldErrors };

  const raw = Array.isArray(input?.items) ? input.items.slice(0, 50) : [];
  if (raw.length === 0) return { ok: false, error: "অর্ডারে অন্তত একটি পণ্য রাখতে হবে" };
  for (const l of raw) {
    const qty = Number(l?.qty);
    const price = Number(l?.unitPrice);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) return { ok: false, error: "পরিমাণ ১ থেকে ৫০ এর মধ্যে হতে হবে" };
    if (!Number.isFinite(price) || price < 0 || price > 10_000_000) return { ok: false, error: "পণ্যের দাম ঠিক করুন" };
  }

  let oldPhone = "";
  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: Number(orderId) }, include: { items: { orderBy: { id: "asc" } } } });
      oldPhone = order?.phone ?? "";
      if (!order || order.deletedAt) return { ok: false as const, error: "অর্ডার পাওয়া যায়নি" };
      if (!EDITABLE_STATUSES.includes(order.status)) {
        return { ok: false as const, error: "শুধু New বা Confirmed অর্ডার এডিট করা যায়" };
      }
      if (input.version && order.updatedAt.toISOString() !== input.version) {
        return { ok: false as const, error: "এর মধ্যে অর্ডারটি অন্য কেউ বদলেছেন। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।" };
      }

      // resolve every line to a product snapshot
      const byItem = new Map(order.items.map((i) => [i.id, i]));
      const seen = new Set<number>();
      type Next = {
        itemId: number | null;
        productId: number | null;
        variantId: number | null;
        name: string;
        variantName: string | null;
        image: string | null;
        qty: number;
        unitPrice: number;
      };
      const next: Next[] = [];
      const newIds = raw.filter((l) => !l.itemId).map((l) => Number(l.productId));
      const products = newIds.length
        ? await tx.product.findMany({
            where: { id: { in: newIds }, isActive: true },
            include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, variants: { where: { isActive: true } } },
          })
        : [];
      for (const l of raw) {
        const qty = Number(l.qty);
        const unitPrice = Math.round(Number(l.unitPrice) * 100) / 100;
        if (l.itemId) {
          const item = byItem.get(Number(l.itemId));
          if (!item || seen.has(item.id)) return { ok: false as const, error: "পণ্যের তালিকা পুরনো হয়ে গেছে। পেজ রিফ্রেশ করুন।" };
          seen.add(item.id);
          next.push({ itemId: item.id, productId: item.productId, variantId: item.variantId, name: item.name, variantName: item.variantName, image: item.image, qty, unitPrice });
        } else {
          const p = products.find((x) => x.id === Number(l.productId));
          if (!p) return { ok: false as const, error: "একটি পণ্য আর পাওয়া যাচ্ছে না" };
          const variant = l.variantId ? p.variants.find((v) => v.id === Number(l.variantId)) : undefined;
          if (l.variantId && !variant) return { ok: false as const, error: `"${p.name}" এর এই ভ্যারিয়েন্ট আর পাওয়া যাচ্ছে না` };
          if (!variant && p.variants.length > 0) return { ok: false as const, error: `"${p.name}" এর ভ্যারিয়েন্ট বাছাই করুন` };
          next.push({ itemId: null, productId: p.id, variantId: variant?.id ?? null, name: p.name, variantName: variant?.name ?? null, image: p.images[0]?.url ?? null, qty, unitPrice });
        }
      }

      // what changed, in words, for the history
      const changes: string[] = [];
      const diff = (label: string, a: string, b: string) => {
        if (a !== b) changes.push(`${label}: ${a || "—"} → ${b || "—"}`);
      };
      diff("নাম", order.customerName, name);
      diff("ফোন", order.phone, phone);
      diff("ঠিকানা", order.address, address);
      diff("ডেলিভারি জোন", zoneLabel(order.zone), zoneLabel(zone!));
      const keepNote = order.note === "DEMO"; // demo orders keep their marker
      if (!keepNote) diff("কাস্টমারের নোট", order.note ?? "", note ?? "");
      diff("ডেলিভারি চার্জ", taka(Number(order.shippingFee)), taka(shippingFee));
      for (const item of order.items) {
        const n = next.find((x) => x.itemId === item.id);
        const label = lineLabel(item.name, item.variantName);
        if (!n) changes.push(`বাদ: ${label} ×${item.quantity}`);
        else {
          if (n.qty !== item.quantity) changes.push(`${label}: পরিমাণ ${item.quantity} → ${n.qty}`);
          if (n.unitPrice !== Number(item.unitPrice)) changes.push(`${label}: দাম ${taka(Number(item.unitPrice))} → ${taka(n.unitPrice)}`);
        }
      }
      for (const n of next.filter((x) => !x.itemId)) changes.push(`যোগ: ${lineLabel(n.name, n.variantName)} ×${n.qty} (${taka(n.unitPrice)})`);
      const subtotal = next.reduce((sum, n) => sum + n.unitPrice * n.qty, 0);
      const total = subtotal + shippingFee;
      diff("মোট", taka(Number(order.total)), taka(total));
      if (changes.length === 0) return { ok: true as const };

      // stock: move only the difference per product/variant, returns first so swaps work
      let stockMoved = false;
      if (order.stockDeducted) {
        const delta = new Map<string, { productId: number; variantId: number | null; name: string; qty: number }>();
        const add = (productId: number | null, variantId: number | null, label: string, qty: number) => {
          if (!productId) return; // product deleted since: nothing on the shelf to move
          const k = `${productId}:${variantId ?? 0}`;
          const d = delta.get(k) ?? { productId, variantId, name: label, qty: 0 };
          d.qty += qty;
          delta.set(k, d);
        };
        for (const i of order.items) add(i.productId, i.variantId, lineLabel(i.name, i.variantName), -i.quantity);
        for (const n of next) add(n.productId, n.variantId, lineLabel(n.name, n.variantName), n.qty);
        const moves = [...delta.values()].filter((d) => d.qty !== 0).sort((a, b) => a.qty - b.qty);
        for (const d of moves) {
          try {
            await moveStock(tx, { productId: d.productId, variantId: d.variantId, change: -d.qty, reason: "ORDER_EDIT", reference: order.orderNo, adminName });
          } catch (e) {
            if (e instanceof StockError) throw new StockError(`পর্যাপ্ত স্টক নেই: ${e.message}`);
            throw e;
          }
          stockMoved = true;
        }
      }

      const removed = order.items.filter((i) => !next.some((n) => n.itemId === i.id)).map((i) => i.id);
      if (removed.length) await tx.orderItem.deleteMany({ where: { id: { in: removed } } });
      for (const n of next) {
        if (n.itemId) {
          const old = byItem.get(n.itemId)!;
          if (old.quantity !== n.qty || Number(old.unitPrice) !== n.unitPrice) {
            await tx.orderItem.update({ where: { id: n.itemId }, data: { quantity: n.qty, unitPrice: n.unitPrice } });
          }
        } else {
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: n.productId,
              variantId: n.variantId,
              name: n.name,
              variantName: n.variantName,
              image: n.image,
              unitPrice: n.unitPrice,
              quantity: n.qty,
            },
          });
        }
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          customerName: name,
          phone,
          address,
          zone: zone!,
          ...(keepNote ? {} : { note }),
          shippingFee,
          subtotal,
          total,
          editedAt: new Date(),
        },
      });
      await tx.orderStatusLog.create({
        data: {
          orderId: order.id,
          message: `অর্ডার এডিট করা হয়েছে${stockMoved ? " · স্টক মিলিয়ে নেওয়া হয়েছে" : ""}`,
          details: JSON.stringify(changes.map((c) => c.slice(0, 300)).slice(0, 60)),
          adminName,
        },
      });
      return { ok: true as const };
    });
    if (result.ok && oldPhone && oldPhone !== phone) {
      await refreshRiskQuietly(oldPhone);
      await refreshRiskQuietly(phone, "auto");
    }
    return result;
  } catch (e) {
    if (e instanceof StockError) return { ok: false, error: e.message };
    throw e;
  }
}

// ───────────── Trash ─────────────

export const TRASH_DAYS = 30;

/** Moves an order to the Trash. New/Confirmed orders give their items back to stock. */
export async function trashOrder(orderId: number, adminName: string): Promise<Result> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: Number(orderId) }, include: { items: true } });
    if (!order || order.deletedAt) return { ok: false as const, error: "অর্ডার পাওয়া যায়নি" };
    const restock = order.stockDeducted && EDITABLE_STATUSES.includes(order.status);
    if (restock) {
      for (const item of order.items) {
        if (!item.productId) continue;
        await moveStock(tx, { productId: item.productId, variantId: item.variantId, change: item.quantity, reason: "ORDER_DELETED", reference: order.orderNo, adminName });
      }
    }
    await tx.order.update({
      where: { id: order.id },
      data: { deletedAt: new Date(), deletedBy: adminName, trashRestocked: restock, ...(restock ? { stockDeducted: false } : {}) },
    });
    await tx.orderStatusLog.create({
      data: { orderId: order.id, message: `Trash-এ পাঠানো হয়েছে${restock ? " · স্টক ফেরত দেওয়া হয়েছে" : ""}`, adminName },
    });
    return { ok: true as const };
  });
}

/** Brings an order back from the Trash, taking its items out of stock again if Trash had returned them. */
export async function restoreOrder(orderId: number, adminName: string): Promise<Result> {
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: Number(orderId) }, include: { items: true } });
      if (!order?.deletedAt) return { ok: false as const, error: "অর্ডারটি Trash-এ নেই" };
      if (order.trashRestocked) {
        for (const item of order.items) {
          if (!item.productId) continue;
          try {
            await moveStock(tx, {
              productId: item.productId,
              variantId: item.variantId,
              change: -item.quantity,
              reason: "ORDER",
              reference: order.orderNo,
              note: "Trash থেকে ফেরত",
              adminName,
            });
          } catch (e) {
            if (!(e instanceof StockError)) throw e;
            throw new StockError(`${order.orderNo}: "${lineLabel(item.name, item.variantName)}" এখন পর্যাপ্ত স্টকে নেই, তাই ফেরত আনা যাচ্ছে না`);
          }
        }
      }
      await tx.order.update({
        where: { id: order.id },
        data: { deletedAt: null, deletedBy: null, trashRestocked: false, ...(order.trashRestocked ? { stockDeducted: true } : {}) },
      });
      await tx.orderStatusLog.create({
        data: { orderId: order.id, message: `Trash থেকে ফেরত আনা হয়েছে${order.trashRestocked ? " · স্টক থেকে আবার কাটা হয়েছে" : ""}`, adminName },
      });
      return { ok: true as const };
    });
  } catch (e) {
    if (e instanceof StockError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Permanently deletes orders that are in the Trash (items and history go with them; stock logs stay). */
export async function purgeOrders(ids: number[]) {
  const { count } = await prisma.order.deleteMany({
    where: { id: { in: ids.map(Number).filter(Number.isInteger) }, deletedAt: { not: null } },
  });
  return count;
}

/** Orders in the Trash longer than TRASH_DAYS are deleted for good. */
export async function purgeOldTrash() {
  const cutoff = new Date(Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000);
  await prisma.order.deleteMany({ where: { deletedAt: { lt: cutoff } } });
}
