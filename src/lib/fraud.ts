// Fraud check for cash-on-delivery orders: how reliably a phone number has accepted parcels before.
// Two sources: this shop's own orders (always) and BD Courier (all couriers, when a token is set).
// The result is a risk level stored on every order with that phone (Order.riskLevel) for badges and filters.
// It only ever warns; it never blocks an order by itself.
import { prisma } from "./prisma";
import type { RiskLevel } from "./risk";

// BDCOURIER_API_URL overrides the address, e.g. to test against a mock
const API_URL = process.env.BDCOURIER_API_URL || "https://api.bdcourier.com/courier-check";
const CACHE_MS = 24 * 60 * 60 * 1000;

const KEYS = {
  enabled: "fraud:enabled",
  token: "fraud:bdcourierToken",
  safeAt: "fraud:safeAt",
  riskyBelow: "fraud:riskyBelow",
  minParcels: "fraud:minParcels",
} as const;

export type FraudSettings = {
  /** BD Courier lookups on/off (own-shop history is always used) */
  enabled: boolean;
  token: string;
  /** success % at or above this is "safe" */
  safeAt: number;
  /** success % below this is "risky"; in between is "caution" */
  riskyBelow: number;
  /** fewer parcels than this = "new" customer, not enough history to judge */
  minParcels: number;
};

const DEFAULTS = { safeAt: 70, riskyBelow: 50, minParcels: 3 };

export async function readFraudSettings(): Promise<FraudSettings> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(KEYS) } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: keyof typeof DEFAULTS, min: number, max: number) => {
    const n = Number(map.get(KEYS[k]));
    return Number.isInteger(n) && n >= min && n <= max ? n : DEFAULTS[k];
  };
  return {
    enabled: map.get(KEYS.enabled) === "1",
    token: map.get(KEYS.token) ?? "",
    safeAt: num("safeAt", 1, 100),
    riskyBelow: num("riskyBelow", 0, 100),
    minParcels: num("minParcels", 1, 50),
  };
}

export async function saveFraudSettings(patch: Partial<FraudSettings>) {
  const entries = Object.entries(patch).map(([k, v]) => ({
    key: KEYS[k as keyof FraudSettings],
    value: typeof v === "boolean" ? (v ? "1" : "0") : String(v),
  }));
  await prisma.$transaction(
    entries.map(({ key, value }) => prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })),
  );
}

// ───────────── BD Courier ─────────────

type CourierRow = { name: string; total: number; success: number; cancelled: number };
type Report = { courier: string; details: string; date: string };

const int = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Looks the number up at BD Courier and caches the answer. Never throws. */
export async function fetchCourierHistory(phone: string, s: FraudSettings): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!s.token) return { ok: false, error: "BD Courier টোকেন দেওয়া নেই" };
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${s.token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ phone }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as { data?: Record<string, Record<string, unknown>>; reports?: unknown[]; message?: string; error?: string } | null;
    if (res.status === 401 || res.status === 403) return { ok: false, error: "BD Courier টোকেন সঠিক নয়" };
    if (res.status === 429) return { ok: false, error: "BD Courier-এ আজকের চেকের সীমা শেষ" };
    if (!res.ok || !json?.data || typeof json.data !== "object") {
      return { ok: false, error: json?.message ?? json?.error ?? `BD Courier থেকে তথ্য আসেনি (HTTP ${res.status})` };
    }
    const { summary, ...perCourier } = json.data;
    const couriers: CourierRow[] = Object.entries(perCourier)
      .filter(([, d]) => d && typeof d === "object")
      .map(([key, d]) => {
        const total = int(d.total_parcel);
        const success = int(d.success_parcel);
        return { name: String(d.name ?? key).slice(0, 40), total, success, cancelled: d.cancelled_parcel !== undefined ? int(d.cancelled_parcel) : Math.max(0, total - success) };
      });
    const total = summary ? int(summary.total_parcel) : couriers.reduce((n, c) => n + c.total, 0);
    const success = summary ? int(summary.success_parcel) : couriers.reduce((n, c) => n + c.success, 0);
    const cancelled = summary?.cancelled_parcel !== undefined ? int(summary.cancelled_parcel) : Math.max(0, total - success);
    const reports: Report[] = (Array.isArray(json.reports) ? json.reports : []).slice(0, 20).map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        courier: String(o.courierName ?? "").slice(0, 40),
        details: String(o.details ?? "").slice(0, 300),
        date: String(o.created_at ?? "").slice(0, 10),
      };
    });
    const data = { total, success, cancelled, couriers: JSON.stringify(couriers), reports: JSON.stringify(reports), checkedAt: new Date() };
    await prisma.fraudCheck.upsert({ where: { phone }, create: { phone, ...data }, update: data });
    return { ok: true };
  } catch (e) {
    console.error("BD Courier request failed", e);
    return { ok: false, error: "BD Courier-এর সার্ভারে পৌঁছানো যায়নি" };
  }
}

// ───────────── Risk ─────────────

export type FraudReport = {
  phone: string;
  level: RiskLevel;
  /** the parcels the level was judged on */
  basis: { source: "courier" | "shop"; total: number; success: number; cancelled: number; ratio: number | null };
  shop: { orders: number; delivered: number; cancelled: number; returned: number };
  courier: { total: number; success: number; cancelled: number; couriers: CourierRow[]; reports: Report[]; checkedAt: string } | null;
  blocked: { reason: string; by: string | null; at: string } | null;
};

const parse = <T,>(raw: string): T[] => {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export async function getFraudReport(phone: string, s?: FraudSettings): Promise<FraudReport> {
  const cfg = s ?? (await readFraudSettings());
  const [orders, cached, blocked] = await Promise.all([
    prisma.order.findMany({ where: { phone, deletedAt: null }, select: { status: true, courierStatus: true } }),
    prisma.fraudCheck.findUnique({ where: { phone } }),
    prisma.blockedPhone.findUnique({ where: { phone } }),
  ]);
  const shop = {
    orders: orders.length,
    delivered: orders.filter((o) => o.status === "DELIVERED").length,
    cancelled: orders.filter((o) => o.status === "CANCELLED").length,
    returned: orders.filter((o) => o.courierStatus?.startsWith("cancelled")).length,
  };
  const courier = cached
    ? {
        total: cached.total,
        success: cached.success,
        cancelled: cached.cancelled,
        couriers: parse<CourierRow>(cached.couriers),
        reports: parse<Report>(cached.reports),
        checkedAt: cached.checkedAt.toISOString(),
      }
    : null;

  // Courier-wide history already includes this shop's parcels, so it is preferred when available.
  // Shop history counts only finished orders: delivered vs cancelled.
  const basis =
    courier && courier.total > 0
      ? { source: "courier" as const, total: courier.total, success: courier.success, cancelled: courier.cancelled }
      : { source: "shop" as const, total: shop.delivered + shop.cancelled, success: shop.delivered, cancelled: shop.cancelled };
  const ratio = basis.total > 0 ? Math.round((basis.success / basis.total) * 1000) / 10 : null;

  let level: RiskLevel;
  if (blocked) level = "blocked";
  else if (courier && courier.reports.length > 0) level = "risky"; // other merchants reported this number
  else if (basis.total < cfg.minParcels || ratio === null) level = "new";
  else if (ratio >= cfg.safeAt) level = "safe";
  else if (ratio < cfg.riskyBelow) level = "risky";
  else level = "caution";

  return {
    phone,
    level,
    basis: { ...basis, ratio },
    shop,
    courier,
    blocked: blocked ? { reason: blocked.reason, by: blocked.blockedBy, at: blocked.createdAt.toISOString() } : null,
  };
}

/**
 * Recomputes the risk of a phone number and writes it to all of its orders.
 * lookup: "auto" looks up BD Courier only when enabled and the cache is older than a day; "force" always does.
 */
export async function refreshRisk(phone: string, lookup: "none" | "auto" | "force" = "none") {
  if (!phone) return { ok: true as const, report: null };
  const s = await readFraudSettings();
  let error: string | undefined;
  if (lookup !== "none" && s.enabled && s.token) {
    const cached = lookup === "auto" ? await prisma.fraudCheck.findUnique({ where: { phone }, select: { checkedAt: true } }) : null;
    if (!cached || Date.now() - cached.checkedAt.getTime() > CACHE_MS) {
      const r = await fetchCourierHistory(phone, s);
      if (!r.ok) error = r.error;
    }
  }
  const report = await getFraudReport(phone, s);
  await prisma.order.updateMany({ where: { phone }, data: { riskLevel: report.level } });
  return error ? { ok: false as const, error, report } : { ok: true as const, report };
}

/** Never lets a fraud lookup break the caller (order placement, status changes). */
export async function refreshRiskQuietly(phone: string, lookup: "none" | "auto" = "none") {
  try {
    await refreshRisk(phone, lookup);
  } catch (e) {
    console.error("fraud risk refresh failed", e);
  }
}

/** Orders placed before fraud check existed get a risk level from shop history, a few numbers at a time. */
export async function backfillRisk(limit = 50) {
  const rows = await prisma.order.findMany({
    where: { riskLevel: null, deletedAt: null },
    distinct: ["phone"],
    select: { phone: true },
    take: limit,
  });
  for (const r of rows) await refreshRiskQuietly(r.phone);
}
