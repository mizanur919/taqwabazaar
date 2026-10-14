"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { useStore } from "@/components/store-provider";

export default function WishlistPage() {
  const { ready, wishlist } = useStore();

  return (
    <div className="mx-auto min-h-[50vh] max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold">উইশলিস্ট</h1>
      {ready && wishlist.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <Heart className="size-14 text-slate-300" />
          <p className="mt-4 text-muted">আপনার উইশলিস্টে কোনো পণ্য নেই</p>
          <Link href="/category/all" className="mt-6 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white">
            পণ্য দেখুন
          </Link>
        </div>
      )}
      {wishlist.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {wishlist.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
