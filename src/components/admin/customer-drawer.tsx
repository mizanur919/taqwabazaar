"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { MapPin, MessageCircle, Phone, X } from "lucide-react";
import type { CustomerDetail } from "@/lib/admin/customers";
import { taka } from "@/lib/format";
import { StatusPill } from "./ui";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });

export const customerTagMeta = {
  new: { label: "নতুন", className: "bg-sky-50 text-sky-800", dot: "bg-sky-500" },
  repeat: { label: "নিয়মিত", className: "bg-green-50 text-green-800", dot: "bg-green-600" },
  risky: { label: "ঝুঁকিপূর্ণ", className: "bg-red-50 text-red-800", dot: "bg-red-500" },
} as const;

export function CustomerTag({ tag }: { tag: keyof typeof customerTagMeta | null }) {
  if (!tag) return null;
  const m = customerTagMeta[tag];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${m.className}`}>
      <span className={`size-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

/** Clickable row that opens the customer panel. */
export function CustomerRowLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr onClick={() => router.push(href, { scroll: false })} className="cursor-pointer border-b border-adm-line/70 last:border-0 hover:bg-stone-900/[0.03]">
      {children}
    </tr>
  );
}

export function CustomerDrawer({ customer, closeHref }: { customer: CustomerDetail; closeHref: string }) {
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && router.push(closeHref, { scroll: false });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeHref, router]);

  if (!mounted) return null;
  const s = customer.stats;
  const wa = `880${customer.phone.slice(1)}`;

  return createPortal(
    <div className="admin-theme fixed inset-0 z-40">
      <Link href={closeHref} scroll={false} aria-label="বন্ধ করুন" className="absolute inset-0 bg-stone-900/20" />
      <aside role="dialog" aria-label={customer.name} className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-adm-line bg-adm-surface shadow-2xl">
        <div className="flex items-start justify-between border-b border-adm-line px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-adm-accent-soft text-base font-bold text-adm-accent-strong">
              {customer.name.slice(0, 1)}
            </span>
            <div>
              <h2 className="text-lg font-bold">{customer.name}</h2>
              <div className="mt-0.5 flex items-center gap-2">
                <CustomerTag tag={customer.tag} />
                <span className="text-xs text-adm-muted">প্রথম অর্ডার {fmtDate(s.firstOrder)}</span>
              </div>
            </div>
          </div>
          <Link href={closeHref} scroll={false} aria-label="বন্ধ করুন" className="rounded-md p-1.5 text-adm-muted hover:bg-stone-900/5">
            <X className="size-5" />
          </Link>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            <a href={`tel:${customer.phone}`} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-adm-ink text-sm font-semibold text-white hover:bg-stone-800">
              <Phone className="size-4" /> কল করুন
            </a>
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-adm-line bg-white text-sm font-semibold hover:bg-stone-50"
            >
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          </div>

          <section className="rounded-xl border border-adm-line bg-white p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <Phone className="size-4 text-adm-muted" /> {customer.phone}
            </p>
            <p className="mt-2 flex gap-2 text-adm-ink-soft">
              <MapPin className="mt-0.5 size-4 shrink-0 text-adm-muted" /> {customer.address}
            </p>
            {customer.names.length > 1 && <p className="mt-2 text-xs text-adm-muted">অন্য নামেও অর্ডার করেছেন: {customer.names.slice(1).join(", ")}</p>}
          </section>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["মোট কেনাকাটা", taka(s.spent)],
              ["গড় অর্ডার", taka(s.avgOrder)],
              ["অর্ডার", `${s.orders}টি`],
              ["ডেলিভারি / বাতিল", `${s.delivered} / ${s.cancelled}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-adm-line bg-white p-3">
                <dt className="text-xs text-adm-muted">{label}</dt>
                <dd className={`mt-0.5 text-base font-bold ${label.includes("বাতিল") && s.cancelled > 0 ? "text-red-700" : ""}`}>{value}</dd>
              </div>
            ))}
          </dl>

          {customer.topProducts.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">বেশি কেনা পণ্য</h3>
              <ul className="divide-y divide-adm-line rounded-xl border border-adm-line bg-white text-sm">
                {customer.topProducts.map((p) => (
                  <li key={p.name} className="flex items-center justify-between gap-3 px-3 py-2">
                    {p.productId ? (
                      <Link href={`/admin/products/${p.productId}`} className="truncate hover:underline">
                        {p.name}
                      </Link>
                    ) : (
                      <span className="truncate">{p.name}</span>
                    )}
                    <span className="shrink-0 font-semibold tabular-nums">× {p.qty}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold">সব অর্ডার ({customer.orders.length})</h3>
            <ul className="divide-y divide-adm-line rounded-xl border border-adm-line bg-white text-sm">
              {customer.orders.map((o) => (
                <li key={o.orderNo}>
                  <Link href={`/admin/orders?order=${o.orderNo}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-stone-50">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{o.orderNo}</span>
                      <span className="block text-xs text-adm-muted">
                        {fmtDate(o.createdAt)} · {o.items}টি পণ্য
                      </span>
                    </span>
                    <StatusPill status={o.status} />
                    <span className="w-20 text-right font-semibold tabular-nums">{taka(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
