"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import type { NavLink } from "@/lib/layout";
import { MenuBadgePill } from "./menu-badge";

/** Phone menu sliding in from the left: every header item, with expandable subcategories. */
export function MenuDrawer({ nav, open, onClose }: { nav: NavLink[]; open: boolean; onClose: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // lock page scroll and close on Escape while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="মেনু">
      <button type="button" aria-label="বন্ধ করুন" className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="font-bold">মেনু</p>
          <button type="button" aria-label="বন্ধ করুন" onClick={onClose} className="rounded-md p-1 hover:bg-slate-100">
            <X className="size-5" />
          </button>
        </div>
        {/* any link closes the drawer, so it is gone when the next page shows */}
        <ul className="flex-1 overflow-y-auto py-2">
          {nav.map((l) => (
            <li key={l.key} className="border-b border-line/60">
              <div className="flex items-center">
                <Link href={l.href} onClick={onClose} className="flex flex-1 items-center gap-2 px-4 py-3 font-semibold">
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
                      <Link href={c.href} onClick={onClose} className="block px-8 py-2 text-sm">
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
  );
}

/** ☰ button in the header on phones (the header menu row is hidden there). */
export function HeaderMenuButton({ nav }: { nav: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" aria-label="মেনু খুলুন" aria-expanded={open} onClick={() => setOpen(true)} className="-ml-1 rounded-md p-1 text-ink hover:text-brand md:hidden">
        <Menu className="size-6" />
      </button>
      <MenuDrawer nav={nav} open={open} onClose={close} />
    </>
  );
}
