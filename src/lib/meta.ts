// Facebook (Meta) Pixel + Conversions API. Server-only: the access token never reaches the browser.
// Settings live in the Setting table under "meta:*" keys (Admin → Settings → Marketing).
import { createHash } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "./prisma";

const GRAPH_VERSION = "v25.0";

const KEYS = {
  enabled: "meta:enabled",
  pixelId: "meta:pixelId",
  token: "meta:capiToken",
  testCode: "meta:testCode",
} as const;

export type MetaSettings = { enabled: boolean; pixelId: string; token: string; testCode: string };

/** What the storefront needs: the Pixel ID (null = Pixel off) and whether server events are on. */
export type PixelConfig = { pixelId: string | null; capi: boolean };

export const PIXEL_ID = /^\d{10,20}$/;

async function readRaw(): Promise<MetaSettings> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(KEYS) } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    enabled: map.get(KEYS.enabled) === "1",
    pixelId: map.get(KEYS.pixelId) ?? "",
    token: map.get(KEYS.token) ?? "",
    testCode: map.get(KEYS.testCode) ?? "",
  };
}

/** Uncached, for the admin form and the "send test event" button. */
export const readMetaSettings = readRaw;

/** Cached; saving in the admin panel refreshes it via updateTag("settings"). */
async function getMetaSettings(): Promise<MetaSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag("settings");
  return readRaw();
}

export async function getPixelConfig(): Promise<PixelConfig> {
  const s = await getMetaSettings();
  const on = s.enabled && PIXEL_ID.test(s.pixelId);
  return { pixelId: on ? s.pixelId : null, capi: on && !!s.token };
}

export async function saveMetaSettings(patch: Partial<MetaSettings>) {
  const entries = Object.entries(patch).map(([k, v]) => ({
    key: KEYS[k as keyof MetaSettings],
    value: typeof v === "boolean" ? (v ? "1" : "0") : String(v),
  }));
  await prisma.$transaction(
    entries.map(({ key, value }) => prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })),
  );
}

// ───────────── Conversions API ─────────────

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** Customer details as Meta wants them: normalized, then SHA-256 hashed. Only hashes leave the server. */
export function hashedCustomer(c: { phone?: string; name?: string }) {
  const out: Record<string, string[]> = { country: [sha256("bd")] };
  const digits = String(c.phone ?? "").replace(/\D/g, "");
  if (/^01\d{9}$/.test(digits)) {
    const e164 = `88${digits}`; // 01XXXXXXXXX → 8801XXXXXXXXX
    out.ph = [sha256(e164)];
    out.external_id = [sha256(e164)];
  }
  const parts = String(c.name ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length) out.fn = [sha256(parts[0])];
  if (parts.length > 1) out.ln = [sha256(parts[parts.length - 1])];
  return out;
}

export type ServerEvent = {
  event_name: string;
  event_id: string;
  event_source_url?: string;
  custom_data?: Record<string, unknown>;
  /** Hashed customer fields from hashedCustomer() plus browser ids (fbp/fbc), IP and user agent. */
  user_data: Record<string, unknown>;
};

/** Browser identifiers Meta uses to match a server event to the person who saw the ad. */
export function browserIds(cookies: { get(name: string): { value: string } | undefined }, headers: Headers) {
  const ip = (headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || headers.get("x-real-ip") || undefined;
  return {
    fbp: cookies.get("_fbp")?.value,
    fbc: cookies.get("_fbc")?.value,
    client_ip_address: ip,
    client_user_agent: headers.get("user-agent") ?? undefined,
  };
}

export type CapiResult = { ok: true; received: number } | { ok: false; error: string };

/** Sends events to Meta. Never throws: a slow or failing Meta must not break the store. */
export async function sendServerEvents(events: ServerEvent[], s?: MetaSettings): Promise<CapiResult> {
  const cfg = s ?? (await getMetaSettings());
  if (!cfg.enabled || !PIXEL_ID.test(cfg.pixelId) || !cfg.token) return { ok: false, error: "Conversions API চালু নেই" };
  const body = {
    data: events.map((e) => ({ ...e, event_time: Math.floor(Date.now() / 1000), action_source: "website" })),
    ...(cfg.testCode ? { test_event_code: cfg.testCode } : {}),
  };
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${cfg.pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string } };
    if (!res.ok) {
      console.error("Meta CAPI error", res.status, json.error?.message);
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, received: json.events_received ?? 0 };
  } catch (e) {
    console.error("Meta CAPI request failed", e);
    return { ok: false, error: "Facebook-এর সার্ভারে পৌঁছানো যায়নি" };
  }
}
