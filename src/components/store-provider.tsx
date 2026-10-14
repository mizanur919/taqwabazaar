"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ProductCard } from "@/lib/catalog";
import { contentsOf, track } from "@/lib/meta-pixel";
import type { BuyNowMode, Zone } from "@/lib/settings";
import { QuickOrderModal, type QuickOrderItem } from "./quick-order-modal";

export type CartVariant = { id: number; name: string; price: number | null };

export type CartItem = {
  key: string; // productId or productId:variantId
  id: number; // product id
  variantId?: number;
  variantName?: string;
  slug: string;
  name: string;
  image: string | null;
  price: number; // price actually charged (sale price if any)
  regularPrice: number;
  qty: number;
};

type StoreValue = {
  ready: boolean;
  cart: CartItem[];
  cartCount: number;
  subtotal: number;
  addToCart: (product: ProductCard, qty?: number, variant?: CartVariant) => void;
  setQty: (key: string, qty: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  wishlist: ProductCard[];
  isWished: (id: number) => boolean;
  toggleWish: (product: ProductCard) => void;
  /** Buy Now: opens the quick-order popup or goes to checkout, as set in Admin → Settings. */
  buyNow: (product: ProductCard, qty?: number, variant?: CartVariant, maxQty?: number) => void;
  /** Delivery zones with the fees set in Admin → Settings. */
  zones: Zone[];
  contact: StoreContact;
  toast: string | null;
};

export type StoreContact = { phone: string; whatsapp: string };

const StoreContext = createContext<StoreValue | null>(null);

const CART_KEY = "tb_cart";
const WISH_KEY = "tb_wishlist";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode) — cart just won't persist
  }
}

export function StoreProvider({
  children,
  buyNowMode,
  zones,
  contact,
}: {
  children: React.ReactNode;
  buyNowMode: BuyNowMode;
  zones: Zone[];
  contact: StoreContact;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [quickOrder, setQuickOrder] = useState<QuickOrderItem | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<ProductCard[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    // Hydrate from localStorage once on mount. Carts saved before variants existed have no key,
    // so derive it from the product id.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setCart(load<CartItem[]>(CART_KEY, []).map((i) => ({ ...i, key: i.key ?? String(i.id) })));
    setWishlist(load(WISH_KEY, []));
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) save(CART_KEY, cart);
  }, [cart, ready]);

  useEffect(() => {
    if (ready) save(WISH_KEY, wishlist);
  }, [wishlist, ready]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const addToCart = (p: ProductCard, qty = 1, variant?: CartVariant) => {
    const key = variant ? `${p.id}:${variant.id}` : String(p.id);
    setCart((items) => {
      const existing = items.find((i) => i.key === key);
      if (existing) return items.map((i) => (i.key === key ? { ...i, qty: Math.min(20, i.qty + qty) } : i));
      return [
        ...items,
        {
          key,
          id: p.id,
          variantId: variant?.id,
          variantName: variant?.name,
          slug: p.slug,
          name: p.name,
          image: p.image,
          price: variant?.price ?? p.salePrice ?? p.price,
          regularPrice: variant?.price ?? p.price,
          qty,
        },
      ];
    });
    setToast("কার্টে যোগ করা হয়েছে");
    const price = variant?.price ?? p.salePrice ?? p.price;
    track("AddToCart", { ...contentsOf([{ id: p.id, qty, price }]), content_name: p.name });
  };

  const setQty = (key: string, qty: number) =>
    setCart((items) => items.map((i) => (i.key === key ? { ...i, qty: Math.max(1, qty) } : i)));

  const removeFromCart = (key: string) => setCart((items) => items.filter((i) => i.key !== key));

  const toggleWish = (p: ProductCard) => {
    if (!wishlist.some((i) => i.id === p.id)) {
      track("AddToWishlist", { ...contentsOf([{ id: p.id, qty: 1, price: p.salePrice ?? p.price }]), content_name: p.name });
    }
    setWishlist((items) =>
      items.some((i) => i.id === p.id) ? items.filter((i) => i.id !== p.id) : [...items, p],
    );
  };

  const closeQuickOrder = useCallback(() => setQuickOrder(null), []);

  const buyNow = (p: ProductCard, qty = 1, variant?: CartVariant, maxQty?: number) => {
    if (buyNowMode === "popup") {
      setQuickOrder({ product: p, variant, qty, maxQty });
      return;
    }
    addToCart(p, qty, variant);
    router.push("/checkout");
  };

  const value: StoreValue = {
    ready,
    cart,
    cartCount: cart.reduce((n, i) => n + i.qty, 0),
    subtotal: cart.reduce((n, i) => n + i.price * i.qty, 0),
    addToCart,
    setQty,
    removeFromCart,
    clearCart: () => setCart([]),
    wishlist,
    isWished: (id) => wishlist.some((i) => i.id === id),
    toggleWish,
    buyNow,
    zones,
    contact,
    toast,
  };

  return (
    <StoreContext value={value}>
      {children}
      {quickOrder && <QuickOrderModal item={quickOrder} onClose={closeQuickOrder} />}
      {toast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </StoreContext>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
