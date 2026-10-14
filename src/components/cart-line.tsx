"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { taka } from "@/lib/format";
import { useStore, type CartItem } from "./store-provider";

export function QtyStepper({ item }: { item: CartItem }) {
  const { setQty } = useStore();
  return (
    <div className="flex h-7 items-center rounded-md border border-line text-sm">
      <button
        type="button"
        aria-label="কমান"
        onClick={() => setQty(item.key, item.qty - 1)}
        className="grid h-full w-7 place-items-center hover:text-brand"
      >
        <Minus className="size-3" />
      </button>
      <span className="w-6 text-center">{item.qty}</span>
      <button
        type="button"
        aria-label="বাড়ান"
        onClick={() => setQty(item.key, Math.min(20, item.qty + 1))}
        className="grid h-full w-7 place-items-center hover:text-brand"
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}

export function CartLine({ item, compact = false }: { item: CartItem; compact?: boolean }) {
  const { removeFromCart } = useStore();
  return (
    <div className={`flex gap-3 ${compact ? "rounded-lg bg-slate-50 p-3" : "rounded-xl border border-line bg-white p-3"}`}>
      <Link href={`/product/${item.slug}`} className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
        {item.image && <Image src={item.image} alt={item.name} fill sizes="64px" className="object-contain p-1" />}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/product/${item.slug}`} className="line-clamp-1 text-sm font-semibold hover:text-brand">
          {item.name}
        </Link>
        {item.variantName && <p className="text-xs text-muted">{item.variantName}</p>}
        <p className="mt-0.5 text-xs text-muted">
          প্রতি পিস <span className="font-semibold text-ink">{taka(item.price)}</span>
          {item.regularPrice > item.price && <span className="ml-1 line-through">{taka(item.regularPrice)}</span>}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <QtyStepper item={item} />
          <button
            type="button"
            aria-label="সরান"
            onClick={() => removeFromCart(item.key)}
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted">মোট ({item.qty} পিস)</p>
        <p className="font-bold">{taka(item.price * item.qty)}</p>
      </div>
    </div>
  );
}
