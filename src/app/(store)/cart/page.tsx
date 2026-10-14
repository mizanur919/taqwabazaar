"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { CartLine } from "@/components/cart-line";
import { useStore } from "@/components/store-provider";
import { taka } from "@/lib/format";

export default function CartPage() {
  const { ready, cart, subtotal } = useStore();

  if (!ready) return <div className="mx-auto min-h-[50vh] max-w-7xl px-4 py-8" />;

  if (cart.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-20 text-center">
        <ShoppingCart className="size-14 text-slate-300" />
        <h1 className="mt-4 text-2xl font-bold">আপনার কার্ট খালি</h1>
        <p className="mt-1 text-sm text-muted">পছন্দের পণ্য কার্টে যোগ করুন</p>
        <Link href="/category/all" className="mt-6 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
          কেনাকাটা শুরু করুন
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-8">
      <h1 className="mb-5 text-2xl font-bold">কার্ট</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {cart.map((item) => (
            <CartLine key={item.key} item={item} />
          ))}
        </div>

        <aside className="h-fit rounded-xl bg-slate-100 p-5">
          <h2 className="text-lg font-bold">অর্ডার সামারি</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>সাবটোটাল</dt>
              <dd className="font-semibold">{taka(subtotal)}</dd>
            </div>
            <div className="flex justify-between text-muted">
              <dt>ডেলিভারি চার্জ</dt>
              <dd>চেকআউটে দেখুন</dd>
            </div>
          </dl>
          <Link
            href="/checkout"
            className="mt-5 hidden h-11 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brand-dark lg:flex"
          >
            চেকআউট করুন
          </Link>
        </aside>
      </div>

      {/* sticky bottom bar, like the reference site */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-xs text-muted">মোট মূল্য</p>
            <p className="text-lg font-bold">{taka(subtotal)}</p>
          </div>
          <Link href="/checkout" className="flex h-11 flex-1 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white sm:max-w-xs">
            চেকআউট করুন
          </Link>
        </div>
      </div>
    </div>
  );
}
