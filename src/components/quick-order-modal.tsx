"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Banknote, Minus, Plus, ShoppingBag, Truck, User, X } from "lucide-react";
import { placeOrder } from "@/app/actions";
import type { ProductCard } from "@/lib/catalog";
import { taka } from "@/lib/format";
import { contentsOf, track } from "@/lib/meta-pixel";
import type { DeliveryZoneId } from "@/lib/site";
import { CashOnDelivery, CustomerFields, Step, ZonePicker, type CustomerInfo } from "./checkout-parts";
import { useStore, type CartVariant } from "./store-provider";

export type QuickOrderItem = { product: ProductCard; variant?: CartVariant; qty: number; maxQty?: number };

/** "দ্রুত অর্ডার করুন" popup: order one product without touching the cart. */
export function QuickOrderModal({ item, onClose }: { item: QuickOrderItem; onClose: () => void }) {
  const router = useRouter();
  const { zones } = useStore();
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState(item.qty);
  const [customer, setCustomer] = useState<CustomerInfo>({ name: "", phone: "", address: "" });
  const [zone, setZone] = useState<DeliveryZoneId>("outside");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { product, variant } = item;
  const unit = variant?.price ?? product.salePrice ?? product.price;
  const regular = variant?.price ?? product.price;
  const max = Math.max(1, Math.min(item.maxQty ?? 20, 20));
  const fee = zones.find((z) => z.id === zone)!.fee;
  const subtotal = unit * qty;

  // InitiateCheckout when the popup opens
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current) return;
    checkoutTracked.current = true;
    track("InitiateCheckout", { ...contentsOf([{ id: product.id, qty: item.qty, price: unit }]), content_name: product.name });
  }, [product, item.qty, unit]);

  // close once the customer lands on another page (the thank-you page after ordering)
  const pathname = usePathname();
  const [openedAt] = useState(pathname);
  useEffect(() => {
    if (pathname !== openedAt) onClose();
  }, [pathname, openedAt, onClose]);

  // lock page scroll and close on Escape while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, pending]);

  const submit = () =>
    startTransition(async () => {
      setFormError(null);
      const result = await placeOrder({
        ...customer,
        zone,
        items: [{ id: product.id, variantId: variant?.id, qty }],
      });
      if (result.ok) {
        track("Purchase", result.purchase, { eventId: `purchase_${result.orderNo}`, server: false });
        // stays "pending" (button shows অর্ডার হচ্ছে...) until the thank-you page is ready; the effect below then closes it
        router.push(`/order-success/${result.orderNo}`);
      } else {
        setErrors(result.state?.fieldErrors ?? {});
        setFormError(result.state?.error ?? (result.state?.fieldErrors ? "লাল চিহ্নিত ঘরগুলো ঠিক করুন" : null));
      }
    });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={(e) => e.target === e.currentTarget && !pending && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-order-title"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="quick-order-title" className="flex items-center gap-2 text-lg font-bold">
              <ShoppingBag className="size-5" /> দ্রুত অর্ডার করুন
            </h2>
            <p className="text-xs text-muted">আপনার অর্ডার সম্পন্ন করুন</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex items-center gap-1 rounded-lg border border-line bg-slate-50 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
          >
            <X className="size-4" /> বন্ধ করুন
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-4 sm:p-5">
          <Step n={1} icon={ShoppingBag} title="পণ্যের বিবরণ" compact>
            <div className="flex gap-3 rounded-lg bg-slate-50 p-3">
              <span className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
                {product.image && <Image src={product.image} alt={product.name} fill sizes="64px" className="object-contain p-1" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold">{product.name}</p>
                {variant && <p className="text-xs text-muted">{variant.name}</p>}
                <p className="mt-0.5 text-sm">
                  <span className="font-bold">{taka(unit)}</span>
                  {regular > unit && <span className="ml-1.5 text-xs text-muted line-through">{taka(regular)}</span>}
                </p>
                <div className="mt-2 flex h-7 w-fit items-center rounded-md border border-line bg-white text-sm">
                  <button type="button" aria-label="কমান" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-full w-7 place-items-center hover:text-brand">
                    <Minus className="size-3" />
                  </button>
                  <span className="w-6 text-center">{qty}</span>
                  <button type="button" aria-label="বাড়ান" onClick={() => setQty((q) => Math.min(max, q + 1))} className="grid h-full w-7 place-items-center hover:text-brand">
                    <Plus className="size-3" />
                  </button>
                </div>
              </div>
              <p className="self-end font-bold">{taka(subtotal)}</p>
            </div>
          </Step>

          <Step n={2} icon={User} title="আপনার তথ্য" compact>
            <CustomerFields value={customer} onChange={setCustomer} errors={errors} />
          </Step>

          <Step n={3} icon={Truck} title="ডেলিভারি জোন" compact>
            <ZonePicker zones={zones} zone={zone} onChange={setZone} name="quick-zone" />
          </Step>

          <Step n={4} icon={Banknote} title="পেমেন্ট পদ্ধতি" compact>
            <CashOnDelivery />
          </Step>

          <dl className="space-y-2 rounded-xl bg-slate-100 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">সাবটোটাল</dt>
              <dd>{taka(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">ডেলিভারি চার্জ</dt>
              <dd>{taka(fee)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
              <dt>সর্বমোট</dt>
              <dd>{taka(subtotal + fee)}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-2 border-t border-line bg-white px-5 py-3">
          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">সর্বমোট</span>
            <span className="text-lg font-bold">{taka(subtotal + fee)}</span>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="h-12 w-full rounded-lg bg-brand text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {pending ? "অর্ডার হচ্ছে..." : "অর্ডার কনফার্ম করুন"}
          </button>
        </div>
      </form>
    </div>
  );
}
