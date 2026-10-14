"use client";

import Link from "next/link";
import { Heart, ShoppingCart, User } from "lucide-react";
import { useStore } from "./store-provider";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-2 -top-2 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-white">
      {count}
    </span>
  );
}

export function HeaderIcons() {
  const { cartCount, wishlist } = useStore();
  return (
    <div className="ml-auto flex items-center gap-5 md:ml-0">
      <Link href="/wishlist" aria-label="উইশলিস্ট" className="relative hover:text-brand">
        <Heart className="size-5" />
        <Badge count={wishlist.length} />
      </Link>
      <Link href="/track-order" aria-label="অ্যাকাউন্ট" className="hover:text-brand">
        <User className="size-5" />
      </Link>
      <Link href="/cart" aria-label="কার্ট" className="relative hover:text-brand">
        <ShoppingCart className="size-5" />
        <Badge count={cartCount} />
      </Link>
    </div>
  );
}
