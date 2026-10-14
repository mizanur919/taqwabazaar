"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, ShoppingCart } from "lucide-react";
import type { ProductCard as Product } from "@/lib/catalog";
import { taka } from "@/lib/format";
import { useStore } from "./store-provider";

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, buyNow, isWished, toggleWish } = useStore();
  const router = useRouter();
  const save = product.salePrice !== null ? product.price - product.salePrice : 0;
  const wished = isWished(product.id);

  return (
    <div className="group relative flex h-full flex-col rounded-xl border border-line bg-white p-2.5 transition hover:border-brand/60 hover:shadow-md">
      {save > 0 && (
        <span className="absolute left-0 top-2 z-10 rounded-r-full bg-brand px-2.5 py-0.5 text-[11px] font-semibold text-white">
          Save {taka(save)}
        </span>
      )}
      <button
        type="button"
        aria-label={wished ? "উইশলিস্ট থেকে সরান" : "উইশলিস্টে যোগ করুন"}
        onClick={() => toggleWish(product)}
        className="absolute right-3 top-2.5 z-10 text-muted hover:text-brand"
      >
        <Heart className={`size-4 ${wished ? "fill-brand text-brand" : ""}`} />
      </button>

      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-lg border border-line/70 bg-white">
          {product.image && (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-contain p-3 transition duration-300 group-hover:scale-105"
            />
          )}
        </div>
        <h3 className="mt-3 line-clamp-2 min-h-[2.75rem] text-[15px] font-semibold leading-snug text-ink">
          {product.name}
        </h3>
      </Link>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-lg font-bold text-brand">{taka(product.salePrice ?? product.price)}</span>
        {save > 0 && <span className="text-xs text-muted line-through">{taka(product.price)}</span>}
      </div>

      <div className="mt-auto flex gap-2 pt-3">
        <button
          type="button"
          aria-label={product.hasVariants ? "অপশন বাছাই করুন" : "কার্টে যোগ করুন"}
          title={product.hasVariants ? "অপশন বাছাই করুন" : undefined}
          onClick={() => (product.hasVariants ? router.push(`/product/${product.slug}`) : addToCart(product))}
          className="grid size-9 shrink-0 place-items-center rounded-md border border-brand text-brand transition hover:bg-brand hover:text-white"
        >
          <ShoppingCart className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            // products with variants need a choice first, made on the product page
            if (product.hasVariants) return router.push(`/product/${product.slug}`);
            buyNow(product);
          }}
          className="h-9 flex-1 rounded-md bg-ink text-sm font-semibold text-white transition hover:bg-ink-soft"
        >
          Buy Now
        </button>
      </div>
    </div>
  );
}
