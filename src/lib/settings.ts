// Admin-editable store settings, stored as key/value rows in the Setting table.
// Values in src/lib/site.ts are only the defaults used until an admin saves something.
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "./prisma";
import { deliveryZones, site, staticPages, type DeliveryZoneId } from "./site";

export type BuyNowMode = "popup" | "checkout";

export type StoreSettings = {
  /** What "Buy Now" does: open the quick-order popup, or go to the checkout page. */
  buyNowMode: BuyNowMode;
  phone: string;
  whatsapp: string; // digits with country code, e.g. 8801712345678
  email: string;
  address: string;
  insideFee: number;
  outsideFee: number;
};

export const defaultSettings: StoreSettings = {
  buyNowMode: "popup",
  phone: site.phone,
  whatsapp: site.whatsapp,
  email: site.email,
  address: site.address,
  insideFee: deliveryZones.find((z) => z.id === "inside")!.fee,
  outsideFee: deliveryZones.find((z) => z.id === "outside")!.fee,
};

const SETTING_KEYS = Object.keys(defaultSettings) as (keyof StoreSettings)[];

function parse(rows: { key: string; value: string }[]): StoreSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const str = (k: keyof StoreSettings) => map.get(k) ?? (defaultSettings[k] as string);
  const fee = (k: "insideFee" | "outsideFee") => {
    const n = Number(map.get(k));
    return Number.isFinite(n) && n >= 0 ? n : defaultSettings[k];
  };
  const mode = map.get("buyNowMode");
  return {
    buyNowMode: mode === "checkout" || mode === "popup" ? mode : defaultSettings.buyNowMode,
    phone: str("phone"),
    whatsapp: str("whatsapp"),
    email: str("email"),
    address: str("address"),
    insideFee: fee("insideFee"),
    outsideFee: fee("outsideFee"),
  };
}

/** Cached for the storefront; saving in the admin panel refreshes it via updateTag("settings"). */
export async function getStoreSettings(): Promise<StoreSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag("settings");
  return parse(await prisma.setting.findMany({ where: { key: { in: SETTING_KEYS } } }));
}

/** Uncached read for admin forms, so they always show what is saved. */
export async function readStoreSettings(): Promise<StoreSettings> {
  return parse(await prisma.setting.findMany({ where: { key: { in: SETTING_KEYS } } }));
}

export async function saveStoreSettings(patch: Partial<StoreSettings>) {
  const entries = Object.entries(patch).filter(([k]) => SETTING_KEYS.includes(k as keyof StoreSettings));
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } }),
    ),
  );
}

export type Zone = { id: DeliveryZoneId; label: string; fee: number };

export const zonesFor = (s: Pick<StoreSettings, "insideFee" | "outsideFee">): Zone[] =>
  deliveryZones.map((z) => ({ id: z.id, label: z.label, fee: z.id === "inside" ? s.insideFee : s.outsideFee }));

// ───────────── Info pages (About, Privacy, Refund, Contact) ─────────────

export type InfoPage = { title: string; body: string };
export const PAGE_SLUGS = Object.keys(staticPages);

const defaultPage = (slug: string): InfoPage | null => {
  const p = staticPages[slug];
  return p ? { title: p.title, body: p.body.join("\n\n") } : null;
};

async function readPage(slug: string): Promise<InfoPage | null> {
  if (!PAGE_SLUGS.includes(slug)) return null;
  const row = await prisma.setting.findUnique({ where: { key: `page:${slug}` } });
  if (row) {
    try {
      const v = JSON.parse(row.value) as InfoPage;
      if (typeof v.title === "string" && typeof v.body === "string") return v;
    } catch {
      // fall back to the default text
    }
  }
  return defaultPage(slug);
}

export async function getInfoPage(slug: string): Promise<InfoPage | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("settings");
  return readPage(slug);
}

export async function readAllInfoPages() {
  return Promise.all(PAGE_SLUGS.map(async (slug) => ({ slug, ...(await readPage(slug))! })));
}

export async function saveInfoPage(slug: string, page: InfoPage) {
  await prisma.setting.upsert({
    where: { key: `page:${slug}` },
    create: { key: `page:${slug}`, value: JSON.stringify(page) },
    update: { value: JSON.stringify(page) },
  });
}

// ───────────── Homepage banners ─────────────

export type BannerItem = { id: number; image: string; title: string | null; link: string | null };

export async function getBanners(): Promise<{ main: BannerItem[]; side: BannerItem[] }> {
  "use cache";
  cacheLife("hours");
  cacheTag("banners");
  const rows = await prisma.banner.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, image: true, title: true, link: true, position: true },
  });
  const pick = (pos: string) =>
    rows.filter((r) => r.position === pos).map((b) => ({ id: b.id, image: b.image, title: b.title, link: b.link }));
  return { main: pick("main"), side: pick("side").slice(0, 2) };
}
