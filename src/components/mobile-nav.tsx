"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, House, LayoutGrid, MessageCircle, ShoppingCart, X } from "lucide-react";
import type { NavLink } from "@/lib/layout";
import { MenuBadgePill } from "./menu-badge";
import { useStore } from "./store-provider";

/** Phone-only bar fixed to the bottom: Home, Menu (full menu drawer), Cart, WhatsApp. */
export function MobileNav({ nav }: { nav: NavLink[] }) {
  const { cartCount, contact } = useStore();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // close the drawer after navigating
  const [openedAt, setOpenedAt] = useState(pathname);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="মেনু">
          <button type="button" aria-label="বন্ধ করুন" className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-bold">মেনু</p>
              <button type="button" aria-label="বন্ধ করুন" onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-slate-100">
                <X className="size-5" />
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto py-2">
              {nav.map((l) => (
                <li key={l.key} className="border-b border-line/60">
                  <div className="flex items-center">
                    <Link href={l.href} className="flex flex-1 items-center gap-2 px-4 py-3 font-semibold">
                      {l.label}
                      <MenuBadgePill badge={l.badge} />
                    </Link>
                    {l.children.length > 0 && (
                      <button
                        type="button"
                        aria-label={`${l.label} এর সাব-ক্যাটাগরি`}
                        aria-expanded={expanded === l.key}
                        onClick={() => setExpanded((k) => (k === l.key ? null : l.key))}
                        className="px-4 py-3 text-muted"
                      >
                        <ChevronDown className={`size-4 transition ${expanded === l.key ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </div>
                  {expanded === l.key && (
                    <ul className="bg-slate-50 pb-2">
                      {l.children.map((c) => (
                        <li key={c.href}>
                          <Link href={c.href} className="block px-8 py-2 text-sm">
                            {c.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
