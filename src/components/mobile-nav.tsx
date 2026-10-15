"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { House, LayoutGrid, MessageCircle, ShoppingCart } from "lucide-react";
import type { NavLink } from "@/lib/layout";
import { MenuDrawer } from "./menu-drawer";
import { useStore } from "./store-provider";

/** Phone-only bar fixed to the bottom: Home, Menu (full menu drawer), Cart, WhatsApp. */
export function MobileNav({ nav }: { nav: NavLink[] }) {
  const { cartCount, contact } = useStore();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  // cart and checkout have their own sticky action bar (checkout / confirm order) in the same spot
  if (pathname === "/cart" || pathname === "/checkout") return null;

  const item = "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold";
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="মোবাইল মেনু">
        <Link href="/" className={`${item} ${pathname === "/" ? "text-brand" : "text-ink"}`}>
          <House className="size-5" /> হোম
        </Link>
        <button type="button" onClick={() => setOpen(true)} className={`${item} ${open ? "text-brand" : "text-ink"}`}>
          <LayoutGrid className="size-5" /> মেনু
        </button>
        <Link href="/cart" className={`${item} relative ${pathname === "/cart" ? "text-brand" : "text-ink"}`}>
          <span className="relative">
            <ShoppingCart className="size-5" />
            {cartCount > 0 && (
              <span className="absolute -right-2.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-white">
                {cartCount}
              </span>
            )}
          </span>
          কার্ট
        </Link>
        <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className={`${item} text-whatsapp`}>
          <MessageCircle className="size-5" /> WhatsApp
        </a>
      </nav>

      <MenuDrawer nav={nav} open={open} onClose={close} />
    </>
  );
}
