import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { brandOf, type LayoutSettings, type NavLink } from "@/lib/layout";
import { site } from "@/lib/site";
import { HeaderIcons } from "./header-icons";
import { HeaderMenuButton } from "./menu-drawer";
import { MenuBadgePill } from "./menu-badge";
import { SearchBox } from "./search-box";

export function Logo({ src, name = site.name }: { src?: string; name?: string }) {
  return (
    <Link href="/" className="shrink-0 text-xl font-bold tracking-tight text-ink">
      {src ? (
        <Image src={src} alt={name} width={160} height={40} priority className="h-9 w-auto max-w-40 object-contain" />
      ) : name === site.name ? (
        <>
          Taqwa<span className="text-brand">Bazaar</span>
        </>
      ) : (
        <span className="text-brand">{name}</span>
      )}
    </Link>
  );
}

const announcementColors: Record<LayoutSettings["announcement"]["color"], string> = {
  brand: "bg-brand text-white",
  dark: "bg-ink text-white",
  green: "bg-green-600 text-white",
  red: "bg-red-600 text-white",
};

function Announcement({ a }: { a: LayoutSettings["announcement"] }) {
  if (!a.enabled || !a.text) return null;
  const cls = `block px-4 py-2 text-center text-sm font-semibold ${announcementColors[a.color] ?? announcementColors.brand}`;
  return a.link ? (
    <Link href={a.link} className={`${cls} hover:opacity-90`}>
      {a.text}
    </Link>
  ) : (
    <p className={cls}>{a.text}</p>
  );
}

export function Header({ phone, nav, layout }: { phone: string; nav: NavLink[]; layout: LayoutSettings }) {
  return (
    <header className="sticky top-0 z-30 bg-white">
      <Announcement a={layout.announcement} />
      <div className="bg-ink text-xs text-white">
        <div className="mx-auto flex max-w-7xl justify-end gap-3 px-4 py-1.5">
          <span>Cash On Delivery</span>
          <span className="opacity-50">|</span>
          <span>24/7 Support</span>
          <span className="hidden opacity-50 sm:inline">|</span>
          <a href={`tel:${phone}`} className="hidden sm:inline">
            {phone}
          </a>
        </div>
      </div>

      <div className="border-b border-line">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <HeaderMenuButton nav={nav} />
          <Logo src={layout.logo} name={brandOf(layout).name} />
          <div className="mx-auto hidden w-full max-w-xl md:block">
            <SearchBox />
          </div>
          <HeaderIcons />
        </div>
        <div className="px-4 pb-3 md:hidden">
          <SearchBox />
        </div>
      </div>

      {/* phones use the ☰ button instead of this row */}
      <nav className="hidden border-b border-line md:block">
        {/* scrolls sideways on phones; on desktop it wraps so dropdowns are not clipped */}
        <ul className="no-scrollbar mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-2.5 text-sm font-semibold whitespace-nowrap md:flex-wrap md:justify-center md:overflow-visible">
          {nav.map((l) => (
            <li key={l.key} className="group relative">
              <Link href={l.href} className="flex items-center gap-1 hover:text-brand">
                {l.label}
                <MenuBadgePill badge={l.badge} />
                {l.children.length > 0 && <ChevronDown className="hidden size-3.5 md:block" />}
              </Link>
              {l.children.length > 0 && (
                <div className="invisible absolute left-1/2 top-full z-40 hidden -translate-x-1/2 pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 md:block">
                  <ul className="min-w-48 rounded-xl border border-line bg-white py-2 text-sm font-medium shadow-xl">
                    {l.children.map((c) => (
                      <li key={c.href}>
                        <Link href={c.href} className="block px-4 py-2 hover:bg-slate-50 hover:text-brand">
                          {c.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
