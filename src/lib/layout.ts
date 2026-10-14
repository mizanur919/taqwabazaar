// Storefront header/footer layout, edited in Admin → Settings → Menus / Header & Footer.
// Everything lives as one JSON value in the Setting table (key "layout"); until an admin saves,
// the defaults below reproduce the original hard-coded header and footer.
import { cacheLife, cacheTag } from "next/cache";
import { getCategories, type CategoryItem } from "./catalog";
import { prisma } from "./prisma";
import { staticPages } from "./site";

const KEY = "layout";

// ───────────── Types ─────────────

export type MenuKind = "category" | "system" | "page" | "custom";
export type MenuBadge = "" | "hot" | "new" | "sale";

export type MenuItem = {
  id: string;
  kind: MenuKind;
  /** category id, system page key, info page slug, or the URL of a custom link */
  ref: string;
  /** empty = use the category/page name */
  label: string;
  hidden: boolean;
  badge: MenuBadge;
  /** categories only: show subcategories as a dropdown */
  dropdown: boolean;
};

export type FooterColumn = { id: string; title: string; items: MenuItem[] };

export type AnnouncementColor = "brand" | "dark" | "green" | "red";

export type LayoutSettings = {
  headerMenu: MenuItem[] | null; // null = default (Home, All Products, first categories, Track order)
  footerColumns: FooterColumn[];
  announcement: { enabled: boolean; text: string; link: string; color: AnnouncementColor };
  logo: string;
  favicon: string;
  footerAbout: string;
  copyright: string;
  license: string;
  social: Record<"facebook" | "instagram" | "youtube" | "tiktok", string>;
  badges: string[];
  mobileNav: boolean;
};

export const SYSTEM_LINKS: Record<string, { label: string; href: string }> = {
  home: { label: "Home", href: "/" },
  all: { label: "All Products", href: "/category/all" },
  track: { label: "অর্ডার ট্র্যাকিং", href: "/track-order" },
  wishlist: { label: "Wishlist", href: "/wishlist" },
  cart: { label: "Cart", href: "/cart" },
};

/** Trust badges shown in the footer (text only; no third-party logos). */
export const PAYMENT_BADGES: Record<string, string> = {
  cod: "ক্যাশ অন ডেলিভারি",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  card: "Visa / Mastercard",
  steadfast: "Steadfast Courier",
  pathao: "Pathao Courier",
  redx: "RedX",
};

let seq = 0;
const item = (kind: MenuKind, ref: string, extra: Partial<MenuItem> = {}): MenuItem => ({
  id: `d${++seq}`,
  kind,
  ref,
  label: "",
  hidden: false,
  badge: "",
  dropdown: false,
  ...extra,
});

export const defaultLayout = (): LayoutSettings => ({
  headerMenu: null,
  footerColumns: [
    {
      id: "about",
      title: "ABOUT",
      items: ["about-us", "privacy-policy", "refund-policy", "contact-us"].map((s) => item("page", s)),
    },
    {
      id: "nav",
      title: "NAVIGATION",
      items: ["cart", "all", "wishlist", "track"].map((s) => item("system", s)),
    },
  ],
  announcement: { enabled: false, text: "", link: "", color: "brand" },
  logo: "",
  favicon: "",
  footerAbout: "",
  copyright: "",
  license: "",
  social: { facebook: "", instagram: "", youtube: "", tiktok: "" },
  badges: ["cod"],
  mobileNav: true,
});

/** The original header: Home, All Products, the first 5 categories that have products, Track order. */
export function defaultHeaderMenu(categories: CategoryItem[]): MenuItem[] {
  const top = categories.filter((c) => c.productCount > 0 && !c.parentId).slice(0, 5);
  return [item("system", "home"), item("system", "all"), ...top.map((c) => item("category", String(c.id), { dropdown: true })), item("system", "track")];
}

// ───────────── Read / write ─────────────

function parse(raw: string | undefined): LayoutSettings {
  const d = defaultLayout();
  if (!raw) return d;
  try {
    const v = JSON.parse(raw) as Partial<LayoutSettings>;
    return {
      ...d,
      ...v,
      announcement: { ...d.announcement, ...(v.announcement ?? {}) },
      social: { ...d.social, ...(v.social ?? {}) },
      footerColumns: Array.isArray(v.footerColumns) ? v.footerColumns : d.footerColumns,
      headerMenu: Array.isArray(v.headerMenu) ? v.headerMenu : null,
      badges: Array.isArray(v.badges) ? v.badges : d.badges,
    };
  } catch {
    return d;
  }
}

/** Uncached, for the admin forms. */
export async function readLayout(): Promise<LayoutSettings> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  return parse(row?.value);
}

/** Cached for the storefront; saving calls updateTag("settings"). */
export async function getLayout(): Promise<LayoutSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag("settings");
  return readLayout();
}

export async function saveLayout(patch: Partial<LayoutSettings>) {
  const next = { ...(await readLayout()), ...patch };
  const value = JSON.stringify(next);
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
  return next;
}

// ───────────── Sanitizing (admin input) ─────────────

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** Only links inside this site or full https links, so a menu can't carry javascript: URLs. */
export const safeLink = (v: unknown) => {
  const s = str(v, 300);
  return /^\/(?!\/)/.test(s) || /^https:\/\/[^\s]+$/.test(s) ? s : "";
};

export function cleanItems(raw: unknown, max = 30): MenuItem[] {
  if (!Array.isArray(raw)) return [];
  const out: MenuItem[] = [];
  for (const r of raw.slice(0, max)) {
    const o = (r ?? {}) as Record<string, unknown>;
    const kind = ["category", "system", "page", "custom"].includes(String(o.kind)) ? (o.kind as MenuKind) : null;
    if (!kind) continue;
    let ref = str(o.ref, 300);
    if (kind === "category" && !/^\d+$/.test(ref)) continue;
    if (kind === "system" && !(ref in SYSTEM_LINKS)) continue;
    if (kind === "page" && !(ref in staticPages)) continue;
    if (kind === "custom") {
      ref = safeLink(ref);
      if (!ref) continue;
    }
    const label = str(o.label, 60);
    if (kind === "custom" && !label) continue; // a custom link needs a name
    out.push({
      id: str(o.id, 40) || `i${Date.now().toString(36)}${out.length}`,
      kind,
      ref,
      label,
      hidden: !!o.hidden,
      badge: ["hot", "new", "sale"].includes(String(o.badge)) ? (o.badge as MenuBadge) : "",
      dropdown: kind === "category" && !!o.dropdown,
    });
  }
  return out;
}

// ───────────── Resolving for the storefront ─────────────

export type NavLink = { key: string; label: string; href: string; badge: MenuBadge; children: { label: string; href: string }[] };

/** Turns saved items into links. Hidden items and deleted/disabled categories are dropped. */
export function resolveMenu(items: MenuItem[], categories: CategoryItem[]): NavLink[] {
  const byId = new Map(categories.map((c) => [String(c.id), c]));
  const out: NavLink[] = [];
  for (const i of items) {
    if (i.hidden) continue;
    if (i.kind === "category") {
      const c = byId.get(i.ref);
      if (!c) continue; // category deleted or switched off
      const children = i.dropdown
        ? categories.filter((s) => s.parentId === c.id).map((s) => ({ label: s.name, href: `/category/${s.slug}` }))
        : [];
      out.push({ key: i.id, label: i.label || c.name, href: `/category/${c.slug}`, badge: i.badge, children });
    } else if (i.kind === "system") {
      const s = SYSTEM_LINKS[i.ref];
      if (s) out.push({ key: i.id, label: i.label || s.label, href: s.href, badge: i.badge, children: [] });
    } else if (i.kind === "page") {
      const p = staticPages[i.ref];
      if (p) out.push({ key: i.id, label: i.label || p.title, href: `/page/${i.ref}`, badge: i.badge, children: [] });
    } else {
      const href = safeLink(i.ref);
      if (href && i.label) out.push({ key: i.id, label: i.label, href, badge: i.badge, children: [] });
    }
  }
  return out;
}

/** Everything the store layout needs, in one cached call. */
export async function getStoreLayout() {
  const [layout, categories] = await Promise.all([getLayout(), getCategories()]);
  return {
    layout,
    header: resolveMenu(layout.headerMenu ?? defaultHeaderMenu(categories), categories),
    footer: layout.footerColumns
      .map((col) => ({ id: col.id, title: col.title, links: resolveMenu(col.items, categories) }))
      .filter((col) => col.links.length > 0 || col.title),
  };
}
