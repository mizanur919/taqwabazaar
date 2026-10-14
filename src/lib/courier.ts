// Courier booking. Only Steadfast for now; the Order columns (courier, consignmentId...) are courier-neutral
// so Pathao/RedX can be added later. Credentials live in the Setting table under "courier:steadfast:*".
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { courierStatusLabels } from "./courier-status";
import { refreshRiskQuietly } from "./fraud";
import { changeOrderStatus } from "./orders";

// STEADFAST_BASE_URL overrides the address (same option as Steadfast's own SDK), e.g. to test against a mock
const BASE_URL = process.env.STEADFAST_BASE_URL || "https://portal.packzy.com/api/v1";

const KEYS = {
  enabled: "courier:steadfast:enabled",
  apiKey: "courier:steadfast:apiKey",
  secretKey: "courier:steadfast:secretKey",
  webhookToken: "courier:steadfast:webhookToken",
  lastWebhookAt: "courier:steadfast:lastWebhookAt",
} as const;

export type SteadfastSettings = {
  enabled: boolean;
  apiKey: string;
  secretKey: string;
  webhookToken: string;
  lastWebhookAt: string;
};

export async function readSteadfastSettings(): Promise<SteadfastSettings> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(KEYS) } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    enabled: map.get(KEYS.enabled) === "1",
    apiKey: map.get(KEYS.apiKey) ?? "",
    secretKey: map.get(KEYS.secretKey) ?? "",
    webhookToken: map.get(KEYS.webhookToken) ?? "",
    lastWebhookAt: map.get(KEYS.lastWebhookAt) ?? "",
  };
}

export async function saveSteadfastSettings(patch: Partial<SteadfastSettings>) {
  const entries = Object.entries(patch).map(([k, v]) => ({
    key: KEYS[k as keyof SteadfastSettings],
    value: typeof v === "boolean" ? (v ? "1" : "0") : String(v),
  }));
  await prisma.$transaction(
    entries.map(({ key, value }) => prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })),
  );
}

export const newWebhookToken = () => randomBytes(24).toString("base64url");

export const isReady = (s: SteadfastSettings) => s.enabled && !!s.apiKey && !!s.secretKey;

// ───────────── API ─────────────

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(s: Pick<SteadfastSettings, "apiKey" | "secretKey">, path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Api-Key": s.apiKey, "Secret-Key": s.secretKey, "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as
      | (Record<string, unknown> & { status?: number; message?: string; errors?: Record<string, string[]>; attempts_left?: number })
      | null;
    if (!json) return { ok: false, error: `Steadfast থেকে বোঝা যায় এমন উত্তর আসেনি (HTTP ${res.status})` };
    const status = Number(json.status ?? res.status);
    if (status === 401) {
      const left = typeof json.attempts_left === "number" ? ` আর ${json.attempts_left} বার ভুল হলে Steadfast সাময়িকভাবে আটকে দেবে।` : "";
      return { ok: false, error: `API Key বা Secret Key সঠিক নয়।${left}` };
    }
    if (status !== 200) {
      const first = json.errors ? Object.values(json.errors).flat()[0] : undefined;
      return { ok: false, error: first ?? json.message ?? `Steadfast ত্রুটি (HTTP ${status})` };
    }
    return { ok: true, data: json as T };
  } catch (e) {
    console.error("Steadfast request failed", path, e);
    return { ok: false, error: "Steadfast-এর সার্ভারে পৌঁছানো যায়নি। একটু পরে আবার চেষ্টা করুন।" };
  }
}

export async function getBalance(s: SteadfastSettings) {
  return call<{ current_balance: number }>(s, "/get_balance");
}

// ───────────── Sending orders ─────────────

/** Why an order can't be sent, or null if it can. */
export function sendBlocker(o: { status: string; deletedAt: Date | null; consignmentId: string | null }) {
  if (o.deletedAt) return "অর্ডারটি Trash-এ আছে";
  if (o.consignmentId) return "আগেই কুরিয়ারে পাঠানো হয়েছে";
  if (o.status !== "CONFIRMED") return "শুধু Confirmed অর্ডার পাঠানো যায়";
  return null;
}

export type SendInput = { id: number; cod: number; note: string };
export type SendResult = { id: number; orderNo: string; ok: boolean; trackingCode?: string; error?: string };

const LOCK_MS = 2 * 60 * 1000;

/**
 * Books one order with Steadfast. A row-level claim (courierLockAt) makes concurrent clicks safe,
 * and the order number is sent as Steadfast's invoice, which Steadfast itself never accepts twice.
 */
export async function sendOrder(s: SteadfastSettings, input: SendInput, adminName: string): Promise<SendResult> {
  const order = await prisma.order.findUnique({ where: { id: Number(input.id) }, include: { items: true } });
  if (!order) return { id: input.id, orderNo: "?", ok: false, error: "অর্ডার পাওয়া যায়নি" };
  const fail = (error: string): SendResult => ({ id: order.id, orderNo: order.orderNo, ok: false, error });

  const blocked = sendBlocker(order);
  if (blocked) return fail(blocked);
  const cod = Math.round(Number(input.cod));
  if (!Number.isFinite(cod) || cod < 0 || cod > 1_000_000) return fail("COD টাকা ঠিক করুন");

  // claim the order; a second click (or another staff member) finds it already claimed
  const claim = await prisma.order.updateMany({
    where: {
      id: order.id,
      consignmentId: null,
      deletedAt: null,
      status: "CONFIRMED",
      OR: [{ courierLockAt: null }, { courierLockAt: { lt: new Date(Date.now() - LOCK_MS) } }],
    },
    data: { courierLockAt: new Date() },
  });
  if (claim.count !== 1) return fail("অর্ডারটি এই মুহূর্তে অন্য কেউ পাঠাচ্ছেন");

  const items = order.items.map((i) => `${i.name}${i.variantName ? ` (${i.variantName})` : ""} x${i.quantity}`).join(", ");
  const note = (String(input.note ?? "").trim() || items).slice(0, 250);
  const res = await call<{ consignment?: { consignment_id: number | string; tracking_code: string; status: string } }>(s, "/create_order", {
    invoice: order.orderNo,
    recipient_name: order.customerName.slice(0, 100),
    recipient_phone: order.phone,
    recipient_address: order.address.slice(0, 250),
    cod_amount: cod,
    note,
  });

  if (!res.ok || !res.data.consignment?.consignment_id) {
    await prisma.order.update({ where: { id: order.id }, data: { courierLockAt: null } });
    return fail(res.ok ? "Steadfast কনসাইনমেন্ট নম্বর দেয়নি" : res.error);
  }

  const c = res.data.consignment;
  await prisma.order.update({
    where: { id: order.id },
    data: {
      courier: "steadfast",
      consignmentId: String(c.consignment_id),
      trackingCode: c.tracking_code ?? null,
      courierStatus: c.status ?? "in_review",
      courierCod: cod,
      courierSentAt: new Date(),
      courierSentBy: adminName,
      courierCheckedAt: new Date(),
      courierLockAt: null,
    },
  });
  await prisma.orderStatusLog.create({
    data: {
      orderId: order.id,
      message: `Steadfast-এ পাঠানো হয়েছে · Tracking ${c.tracking_code ?? "—"} · COD ৳${cod.toLocaleString("en-IN")}`,
      adminName,
    },
  });
  await changeOrderStatus(order.id, "SHIPPED", adminName);
  return { id: order.id, orderNo: order.orderNo, ok: true, trackingCode: c.tracking_code };
}

// ───────────── Delivery status ─────────────


/**
 * Saves a status reported by Steadfast (status check or webhook).
 * Delivered parcels mark the order Delivered; returns are only flagged, staff confirm them by hand.
 */
export async function applyCourierStatus(orderId: number, status: string, source: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, phone: true, status: true, courierStatus: true, deletedAt: true } });
  if (!order || order.deletedAt) return;
  const clean = status.trim().toLowerCase().slice(0, 50);
  if (clean === order.courierStatus) {
    await prisma.order.update({ where: { id: order.id }, data: { courierCheckedAt: new Date() } });
    return;
  }
  await prisma.order.update({ where: { id: order.id }, data: { courierStatus: clean, courierCheckedAt: new Date() } });
  await prisma.orderStatusLog.create({
    data: { orderId: order.id, message: `Steadfast: ${courierStatusLabels[clean] ?? clean}`, adminName: source },
  });
  if ((clean === "delivered" || clean === "delivered_approval_pending") && order.status === "SHIPPED") {
    await changeOrderStatus(order.id, "DELIVERED", source);
  } else if (clean.startsWith("cancelled")) {
    await refreshRiskQuietly(order.phone);
  }
}

/** Asks Steadfast for the current status of a sent order. */
export async function refreshCourierStatus(s: SteadfastSettings, orderId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, orderNo: true, consignmentId: true } });
  if (!order?.consignmentId) return { ok: false as const, error: "অর্ডারটি কুরিয়ারে পাঠানো হয়নি" };
  const res = await call<{ delivery_status?: string }>(s, `/status_by_cid/${encodeURIComponent(order.consignmentId)}`);
  if (!res.ok) return res;
  if (!res.data.delivery_status) return { ok: false as const, error: "Steadfast স্ট্যাটাস দেয়নি" };
  await applyCourierStatus(order.id, res.data.delivery_status, "Steadfast");
  return { ok: true as const, status: res.data.delivery_status };
}
