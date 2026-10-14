"use server";

import { updateTag } from "next/cache";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { searchProducts, type ProductCard } from "@/lib/catalog";
import { refreshRiskQuietly } from "@/lib/fraud";
import { browserIds, getPixelConfig, hashedCustomer, sendServerEvents } from "@/lib/meta";
import type { MetaEventData, MetaEventName } from "@/lib/meta-pixel";
import { createOrder, normalizePhone } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export async function searchSuggestions(query: string): Promise<ProductCard[]> {
  if (typeof query !== "string" || query.trim().length < 2) return [];
  return searchProducts(query.slice(0, 80), 6);
}

// ───────────── Checkout ─────────────

export type CheckoutState = { error?: string; fieldErrors?: Record<string, string> } | null;

/** purchase: what the browser Pixel reports for this order (the server sends the same event itself). */
export type CheckoutResult =
  | { ok: true; orderNo: string; purchase: MetaEventData }
  | { ok: false; state: CheckoutState };

type CheckoutInput = {
  name: string;
  phone: string;
  address: string;
  zone: string;
  note?: string;
  items: { id: number; variantId?: number; qty: number }[];
};

export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const result = await createOrder({
    name: input?.name,
    phone: input?.phone,
    address: input?.address,
    zone: input?.zone,
    note: input?.note,
    items: (Array.isArray(input?.items) ? input.items : []).map((i) => ({
      productId: i?.id,
      variantId: i?.variantId,
      qty: i?.qty,
    })),
    source: "WEB",
  });
  if (!result.ok) {
    const fieldErrors = result.fieldErrors && { ...result.fieldErrors };
    if (fieldErrors?.name) fieldErrors.name = "আপনার নাম লিখুন";
    return { ok: false, state: { error: result.error, fieldErrors } };
  }
  updateTag("catalog"); // stock changed
  after(() => refreshRiskQuietly(normalizePhone(input.phone), "auto")); // fraud check, never delays the customer

  const purchase: MetaEventData = {
    content_type: "product",
    content_ids: [...new Set(result.lines.map((l) => String(l.productId)))],
    contents: result.lines.map((l) => ({ id: String(l.productId), quantity: l.quantity, item_price: l.unitPrice })),
    num_items: result.lines.reduce((n, l) => n + l.quantity, 0),
    value: result.total,
    currency: "BDT",
    order_id: result.orderNo,
  };
  // Purchase through the Conversions API, after the response so the customer never waits on Facebook.
  // Same event_id as the browser Pixel's Purchase, so Meta counts it once.
  after(async () => {
    if (!(await getPixelConfig()).capi) return;
    const [c, h] = await Promise.all([cookies(), headers()]);
    await sendServerEvents([
      {
        event_name: "Purchase",
        event_id: `purchase_${result.orderNo}`,
        event_source_url: h.get("referer") ?? undefined,
        custom_data: purchase,
        user_data: { ...hashedCustomer({ phone: input.phone, name: input.name }), ...browserIds(c, h) },
      },
    ]);
  });
  return { ok: true, orderNo: result.orderNo, purchase };
}

// ───────────── Facebook Conversions API (browser events mirrored from the server) ─────────────

const SERVER_EVENTS: MetaEventName[] = ["ViewContent", "Search", "AddToCart", "AddToWishlist", "InitiateCheckout", "Contact"];

/** Mirrors a browser Pixel event through the Conversions API (Purchase is sent by placeOrder instead). */
export async function trackMetaEvent(input: { name: MetaEventName; eventId: string; data: MetaEventData; url: string }) {
  if (!SERVER_EVENTS.includes(input?.name)) return;
  const eventId = String(input.eventId ?? "").slice(0, 64);
  if (!eventId) return;
  if (!(await getPixelConfig()).capi) return;
  const [c, h] = await Promise.all([cookies(), headers()]);
  const user = browserIds(c, h);
  after(() =>
    sendServerEvents([
      {
        event_name: input.name,
        event_id: eventId,
        event_source_url: String(input.url ?? "").slice(0, 500) || undefined,
        custom_data: cleanEventData(input.data),
        user_data: { ...hashedCustomer({}), ...user },
      },
    ]),
  );
}

/** Keeps only known fields with sane types from browser-sent event data. */
function cleanEventData(d: MetaEventData): MetaEventData {
  const out: MetaEventData = {};
  const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : undefined);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);
  if (Array.isArray(d?.content_ids)) out.content_ids = d.content_ids.slice(0, 50).map(String);
  if (Array.isArray(d?.contents)) {
    out.contents = d.contents
      .slice(0, 50)
      .map((x) => ({ id: String(x?.id), quantity: num(x?.quantity) ?? 1, item_price: num(x?.item_price) ?? 0 }));
  }
  out.content_name = str(d?.content_name);
  out.content_category = str(d?.content_category);
  out.search_string = str(d?.search_string, 100);
  out.value = num(d?.value);
  out.num_items = num(d?.num_items);
  if (out.value !== undefined) out.currency = "BDT";
  if (out.content_ids || out.contents) out.content_type = "product";
  return out;
}

// ───────────── Order tracking ─────────────

export type TrackResult =
  | { found: false }
  | {
      found: true;
      orderNo: string;
      status: string;
      total: number;
      createdAt: string;
      items: { name: string; quantity: number }[];
    };

export async function trackOrder(orderNo: string, phone: string): Promise<TrackResult> {
  const no = String(orderNo ?? "").trim().toUpperCase();
  const ph = normalizePhone(phone);
  if (!no || !ph) return { found: false };
  // Require both order number and phone so strangers can't look up orders.
  const order = await prisma.order.findFirst({
    where: { orderNo: no, phone: ph, deletedAt: null },
    include: { items: true },
  });
  if (!order) return { found: false };
  return {
    found: true,
    orderNo: order.orderNo,
    status: order.status,
    total: Number(order.total),
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((i) => ({ name: i.variantName ? `${i.name} (${i.variantName})` : i.name, quantity: i.quantity })),
  };
}
