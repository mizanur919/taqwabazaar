import Link from "next/link";
import { brandOf, PAYMENT_BADGES, type LayoutSettings, type NavLink } from "@/lib/layout";
import type { StoreSettings } from "@/lib/settings";
import { MenuBadgePill } from "./menu-badge";
import { SocialIcon, type SocialNetwork } from "./social-icons";

export function Footer({
  settings,
  columns,
  layout,
}: {
  settings: StoreSettings;
  columns: { id: string; title: string; links: NavLink[] }[];
  layout: LayoutSettings;
}) {
  const social = (Object.keys(layout.social) as SocialNetwork[]).filter((n) => layout.social[n]);
  const badges = layout.badges.filter((b) => b in PAYMENT_BADGES);
  const brand = brandOf(layout);
  return (
    <footer className="mt-16 bg-ink text-white">
      <div
        className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 md:grid-cols-(--footer-cols) md:gap-10"
        style={{ "--footer-cols": `2fr repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))` } as React.CSSProperties}
      >
        {/* phones: shop info full width, menu columns two per row */}
        <div className="col-span-2 md:col-span-1">
          <p className="text-lg font-bold">{brand.name}</p>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-300">
            {layout.footerAbout || `${brand.name} - ${brand.tagline}। পাচ্ছেন সকল প্রিমিয়াম প্রোডাক্ট মিনিমাম প্রাইজে।`}
          </p>
          <div className="mt-4 space-y-1 text-sm text-slate-300">
            <a href={`tel:${settings.phone}`} className="block hover:text-white">{settings.phone}</a>
            <a href={`mailto:${settings.email}`} className="block hover:text-white">{settings.email}</a>
            <p>{settings.address}</p>
          </div>
          {social.length > 0 && (
            <div className="mt-5 flex gap-2">
              {social.map((n) => (
                <a
                  key={n}
                  href={layout.social[n]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={n}
                  className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-brand"
                >
                  <SocialIcon network={n} />
                </a>
              ))}
            </div>
          )}
        </div>
        {columns.map((col) => (
          <div key={col.id}>
            <p className="text-sm font-bold tracking-wider text-brand">{col.title}</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {col.links.map((l) => (
                <li key={l.key}>
                  <Link href={l.href} className="inline-flex items-center gap-1.5 hover:text-white">
                    {l.label}
                    <MenuBadgePill badge={l.badge} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {badges.length > 0 && (
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-4 text-xs">
            <span className="mr-1 text-slate-400">পেমেন্ট ও ডেলিভারি:</span>
            {badges.map((b) => (
              <span key={b} className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 font-semibold text-slate-200">
                {PAYMENT_BADGES[b]}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="border-t border-white/10 py-5 text-center text-xs text-slate-400">
        <p>{layout.copyright || `© ${brand.name}, সর্বস্বত্ব সংরক্ষিত।`}</p>
        {layout.license && <p className="mt-1">{layout.license}</p>}
      </div>
    </footer>
  );
}

export function WhatsAppButton({ number, hideOnMobile = false }: { number: string; hideOnMobile?: boolean }) {
  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp এ মেসেজ করুন"
      className={`fixed bottom-20 right-4 z-40 size-12 place-items-center ${hideOnMobile ? "hidden md:grid" : "grid"} rounded-full bg-whatsapp text-white shadow-lg transition hover:scale-105 md:bottom-6`}
    >
      <svg viewBox="0 0 24 24" className="size-6 fill-current" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.96-3.48-.23-.36a9.43 9.43 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44a9.4 9.4 0 0 1 6.68 2.77 9.38 9.38 0 0 1 2.76 6.68c0 5.2-4.24 9.43-9.46 9.43m8.04-17.47A11.3 11.3 0 0 0 12.05.7C5.78.7.68 5.8.68 12.06c0 2 .52 3.96 1.52 5.68L.58 23.7l6.1-1.6a11.33 11.33 0 0 0 5.37 1.37h.01c6.26 0 11.36-5.1 11.36-11.36 0-3.03-1.18-5.89-3.33-8.03" />
      </svg>
    </a>
  );
}
