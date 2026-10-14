import Link from "next/link";
import type { StoreSettings } from "@/lib/settings";
import { site } from "@/lib/site";

export function Footer({ settings }: { settings: StoreSettings }) {
  return (
    <footer className="mt-16 bg-ink text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p className="text-lg font-bold">{site.name}</p>
          <p className="mt-2 text-sm text-slate-300">
            {site.name} - {site.tagline}। পাচ্ছেন সকল প্রিমিয়াম প্রোডাক্ট মিনিমাম প্রাইজে।
          </p>
          <div className="mt-4 space-y-1 text-sm text-slate-300">
            <a href={`tel:${settings.phone}`} className="block hover:text-white">{settings.phone}</a>
            <a href={`mailto:${settings.email}`} className="block hover:text-white">{settings.email}</a>
            <p>{settings.address}</p>
          </div>
        </div>
        <div>
          <p className="text-sm font-bold tracking-wider text-brand">ABOUT</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li><Link href="/page/about-us" className="hover:text-white">About Us</Link></li>
            <li><Link href="/page/privacy-policy" className="hover:text-white">Privacy Policy</Link></li>
            <li><Link href="/page/refund-policy" className="hover:text-white">Refund Policy</Link></li>
            <li><Link href="/page/contact-us" className="hover:text-white">Contact Us</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold tracking-wider text-brand">NAVIGATION</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li><Link href="/cart" className="hover:text-white">Cart</Link></li>
            <li><Link href="/category/all" className="hover:text-white">All Products</Link></li>
            <li><Link href="/wishlist" className="hover:text-white">Wishlist</Link></li>
            <li><Link href="/track-order" className="hover:text-white">অর্ডার ট্র্যাকিং</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-slate-400">
        © {site.name}, সর্বস্বত্ব সংরক্ষিত।
      </div>
    </footer>
  );
}

export function WhatsAppButton({ number }: { number: string }) {
  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp এ মেসেজ করুন"
      className="fixed bottom-20 right-4 z-40 grid size-12 place-items-center rounded-full bg-whatsapp text-white shadow-lg transition hover:scale-105 md:bottom-6"
    >
      <svg viewBox="0 0 24 24" className="size-6 fill-current" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.96-3.48-.23-.36a9.43 9.43 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44a9.4 9.4 0 0 1 6.68 2.77 9.38 9.38 0 0 1 2.76 6.68c0 5.2-4.24 9.43-9.46 9.43m8.04-17.47A11.3 11.3 0 0 0 12.05.7C5.78.7.68 5.8.68 12.06c0 2 .52 3.96 1.52 5.68L.58 23.7l6.1-1.6a11.33 11.33 0 0 0 5.37 1.37h.01c6.26 0 11.36-5.1 11.36-11.36 0-3.03-1.18-5.89-3.33-8.03" />
      </svg>
    </a>
  );
}
