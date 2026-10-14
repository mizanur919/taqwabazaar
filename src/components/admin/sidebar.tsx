"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Boxes,
  ExternalLink,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  Store,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/admin/auth-actions";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number; badgeTone?: "accent" | "warn" };

export function AdminSidebar({
  user,
  pendingOrders,
  lowStock,
}: {
  user: { name: string; role: string };
  pendingOrders: number;
  lowStock: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const sections: { title: string; items: NavItem[] }[] = [
    {
      title: "Operations",
      items: [
        { href: "/admin", label: "Overview", icon: LayoutDashboard },
        { href: "/admin/orders", label: "Orders", icon: ShoppingBag, badge: pendingOrders, badgeTone: "accent" },
        { href: "/admin/stock", label: "Stock", icon: Boxes, badge: lowStock, badgeTone: "warn" },
        { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      ],
    },
    {
      title: "Records",
      items: [
        { href: "/admin/products", label: "Products", icon: Package },
        { href: "/admin/categories", label: "Categories", icon: FolderTree },
        { href: "/admin/customers", label: "Customers", icon: Users },
      ],
    },
    {
      title: "Account",
      items: [{ href: "/admin/settings", label: "Settings", icon: Settings }],
    },
  ];

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const nav = (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-2">
        <Link href="/admin" className="flex items-center gap-2 font-bold">
          <span className="grid size-7 place-items-center rounded-lg bg-adm-accent text-adm-ink">
            <Store className="size-4" />
          </span>
          TaqwaBazaar
        </Link>
        <button type="button" aria-label="মেনু বন্ধ করুন" onClick={() => setOpen(false)} className="lg:hidden">
          <X className="size-5" />
        </button>
      </div>

      <nav className="mt-6 flex-1 space-y-5 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-2 text-[11px] font-medium text-adm-muted">{section.title}</p>
            <ul className="mt-1 space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                        active ? "bg-adm-ink font-semibold text-white" : "text-adm-ink-soft hover:bg-stone-900/5"
                      }`}
                    >
                      <Icon className="size-4" />
                      <span className="flex-1">{item.label}</span>
                      {!!item.badge && (
                        <span
                          className={`grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold leading-5 ${
                            item.badgeTone === "warn" ? "bg-orange-500 text-white" : "bg-adm-accent text-adm-ink"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <a
          href="/"
          target="_blank"
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-adm-ink-soft hover:bg-stone-900/5"
        >
          <ExternalLink className="size-4" /> View store
        </a>
      </nav>

      <div className="mt-4 space-y-3">
        <div className="rounded-xl bg-adm-accent-soft p-3 text-xs">
          <p className="font-semibold">নতুন অর্ডার</p>
          <p className="mt-0.5 text-adm-ink-soft">{pendingOrders} টি অর্ডার কনফার্ম করার অপেক্ষায়</p>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl px-1 py-1">
          <span className="grid size-8 place-items-center rounded-full bg-adm-accent-soft text-xs font-bold text-adm-accent-strong">
            {initials}
          </span>
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="text-adm-muted">{user.role === "ADMIN" ? "Administrator" : "Staff"}</p>
          </div>
          <form action={logout}>
            <button type="submit" aria-label="লগআউট" title="লগআউট" className="rounded-md p-1.5 text-adm-muted hover:bg-stone-900/5 hover:text-adm-ink">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="print-hide sticky top-0 z-30 flex items-center justify-between border-b border-adm-line bg-adm-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <button type="button" aria-label="মেনু খুলুন" onClick={() => setOpen(true)}>
          <Menu className="size-5" />
        </button>
        <span className="font-bold">TaqwaBazaar</span>
        <span className="size-5" />
      </div>

      <aside className="print-hide hidden w-60 shrink-0 border-r border-adm-line lg:block">
        <div className="sticky top-0 h-screen p-4">{nav}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="মেনু বন্ধ করুন" className="absolute inset-0 bg-stone-900/30" onClick={() => setOpen(false)} />
          <aside className="admin-theme absolute inset-y-0 left-0 flex w-64 flex-col bg-adm-surface p-4 shadow-xl">{nav}</aside>
        </div>
      )}
    </>
  );
}
