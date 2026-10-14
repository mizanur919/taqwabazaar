"use client";

import { useState } from "react";
import { Heart, MessageCircle, Minus, Phone, Plus, ShoppingCart } from "lucide-react";
import type { ProductCard } from "@/lib/catalog";
import { taka } from "@/lib/format";
import { useStore } from "./store-provider";

export function WishButton({ product }: { product: ProductCard }) {
  const { isWished, toggleWish } = useStore();
  const wished = isWished(product.id);
  return (
    <button
      type="button"
      onClick={() => toggleWish(product)}
      aria-label={wished ? "উইশলিস্ট থেকে সরান" : "উইশলিস্টে যোগ করুন"}
      className="shrink-0 text-muted hover:text-brand"
    >
      <Heart className={`size-5 ${wished ? "fill-brand text-brand" : ""}`} />
    </button>
  );
}

type Variant = { id: number; name: string; price: number | null; stock: number };

export function ProductActions({
  product,
  stock,
  variants = [],
}: {
  product: ProductCard;
  stock: number;
  variants?: Variant[];
}) {
  const { addToCart, buyNow, contact } = useStore();
  const [qty, setQty] = useState(1);
  const [variantId, setVariantId] = useState<number | null>(variants.length === 1 ? variants[0].id : null);
  const [needVariant, setNeedVariant] = useState(false);
  const variant = variants.find((v) => v.id === variantId);
  const available = variant ? variant.stock : stock;
  const soldOut = available <= 0;
  const max = Math.max(1, Math.min(available, 20));

  const whatsappText = encodeURIComponent(
    `আমি এই পণ্যটি অর্ডার করতে চাই: ${product.name}${variant ? ` (${variant.name})` : ""}`,
  );

  const add = () => {
    if (variants.length && !variant) {
      setNeedVariant(true);
      return false;
    }
    addToCart(product, qty, variant ? { id: variant.id, name: variant.name, price: variant.price } : undefined);
    return true;
  };

  return (
    <div className="space-y-3">
      {variants.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">
            অপশন বাছাই করুন{" "}
            {variant?.price != null && <span className="font-normal text-muted">· এই অপশনের দাম {taka(variant.price)}</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={v.stock <= 0}
                onClick={() => {
                  setVariantId(v.id);
                  setNeedVariant(false);
                  setQty(1);
                }}
                className={`rounded-lg border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${
                  v.id === variantId ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line hover:border-brand"
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
          {needVariant && <p className="mt-2 text-sm text-red-600">আগে একটি অপশন বাছাই করুন</p>}
        </div>
      )}
      <div className="flex gap-3">
        <div className="flex h-11 items-center rounded-lg border border-line">
          <button
            type="button"
            aria-label="কমান"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="grid h-full w-10 place-items-center hover:text-brand"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-8 text-center text-sm font-semibold">{qty}</span>
          <button
            type="button"
            aria-label="বাড়ান"
            onClick={() => setQty((q) => Math.min(max, q + 1))}
            className="grid h-full w-10 place-items-center hover:text-brand"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <button
          type="button"
          disabled={soldOut}
          onClick={add}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-ink text-sm font-semibold text-white hover:bg-ink-soft disabled:opacity-50"
        >
          <ShoppingCart className="size-4" /> Add to Cart
        </button>
      </div>

      <button
        type="button"
        disabled={soldOut}
        onClick={() => {
          if (variants.length && !variant) return setNeedVariant(true);
          buyNow(product, qty, variant ? { id: variant.id, name: variant.name, price: variant.price } : undefined, available);
        }}
        className="h-11 w-full rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {soldOut ? "স্টক শেষ" : "Buy Now"}
      </button>

      <div className="grid grid-cols-2 gap-3">
        <a
          href={`tel:${contact.phone}`}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-brand text-sm font-semibold text-brand hover:bg-brand-soft"
        >
          <Phone className="size-4" /> কল করুন
        </a>
        <a
          href={`https://wa.me/${contact.whatsapp}?text=${whatsappText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-whatsapp text-sm font-semibold text-white hover:opacity-90"
        >
          <MessageCircle className="size-4" /> WhatsApp
        </a>
      </div>
    </div>
  );
}

export function ProductTabs({ description }: { description: string | null }) {
  const [tab, setTab] = useState<"desc" | "reviews">("desc");
  return (
    <div>
      <div className="flex gap-2 border-b border-line">
        {(
          [
            ["desc", "Description"],
            ["reviews", "Reviews (0)"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${
              tab === id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="prose-desc py-5 text-[15px] text-ink-soft">
        {tab === "desc" ? (
          description ? (
            description.split(/\n+/).map((para, i) => <p key={i}>{para}</p>)
          ) : (
            <p>বিবরণ শীঘ্রই যোগ করা হবে।</p>
          )
        ) : (
          <p>এই পণ্যের এখনো কোনো রিভিউ নেই।</p>
        )}
      </div>
    </div>
  );
}
