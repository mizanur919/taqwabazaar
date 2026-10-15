"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Banknote, Loader2, ShieldCheck, ShoppingBag, Truck, User } from "lucide-react";
import { placeOrder } from "@/app/actions";
import { CartLine } from "@/components/cart-line";
import { CashOnDelivery, CustomerFields, Step, ZonePicker, type CustomerInfo } from "@/components/checkout-parts";
import { useStore } from "@/components/store-provider";
import { taka } from "@/lib/format";
import { contentsOf, track } from "@/lib/meta-pixel";
import type { DeliveryZoneId } from "@/lib/site";

export default function CheckoutPage() {
  const { ready, cart, subtotal, clearCart, zones } = useStore();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [customer, setCustomer] = useState<CustomerInfo>({ name: "", phone: "", address: "" });
  const [zone, setZone] = useState<DeliveryZoneId>("outside");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // set once the order is saved: the cart is already empty, but we are still on this page
  // until the thank-you page loads, so show progress instead of "your cart is empty"
  const [placedOrderNo, setPlacedOrderNo] = useState<string | null>(null);

  const fee = zones.find((z) => z.id === zone)!.fee;
  const total = subtotal + fee;

  // InitiateCheckout once, as soon as the saved cart is loaded
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (!ready || cart.length === 0 || checkoutTracked.current) return;
    checkoutTracked.current = true;
    track("InitiateCheckout", contentsOf(cart.map((i) => ({ id: i.id, qty: i.qty, price: i.price }))));
  }, [ready, cart]);

  const submit = () => {
    setFormError(null);
    startTransition(async () => {
      const result = await placeOrder({
        ...customer,
        zone,
        items: cart.map((i) => ({ id: i.id, variantId: i.variantId, qty: i.qty })),
      });
      if (result.ok) {
        track("Purchase", result.purchase, { eventId: `purchase_${result.orderNo}`, server: false });
        setPlacedOrderNo(result.orderNo);
        clearCart();
        router.replace(`/order-success/${result.orderNo}`);
      } else {
        setErrors(result.state?.fieldErrors ?? {});
        setFormError(result.state?.error ?? null);
      }
    });
  };

  if (!ready) return <div className="mx-auto min-h-[50vh] max-w-7xl px-4 py-8" />;

  if (placedOrderNo) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-7xl flex-col items-center justify-center gap-3 px-4 py-20 text-center" role="status">
        <Loader2 className="size-10 animate-spin text-brand" />
        <p className="text-lg font-semibold">অর্ডার সম্পন্ন হচ্ছে...</p>
        <p className="text-sm text-muted">অর্ডার নাম্বার: {placedOrderNo}</p>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">আপনার কার্ট খালি</h1>
        <Link href="/category/all" className="mt-6 inline-block rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white">
          কেনাকাটা শুরু করুন
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="border-b border-line bg-slate-50">
        <p className="mx-auto max-w-7xl px-4 py-3 text-xs text-muted">
          <Link href="/" className="hover:text-brand">হোম</Link> › <Link href="/cart" className="hover:text-brand">কার্ট</Link> ›{" "}
          <span className="font-semibold text-ink">চেকআউট</span>
        </p>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-6">
        <h1 className="text-3xl font-bold">চেকআউট</h1>
        <p className="mt-1 text-sm text-muted">আপনার অর্ডার সম্পন্ন করুন</p>

        <form
          className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-5">
            <Step n={1} icon={ShoppingBag} title={`কার্টের পণ্য (${cart.length}টি)`}>
              <div className="space-y-3">
                {cart.map((item) => (
                  <CartLine key={item.key} item={item} compact />
                ))}
              </div>
            </Step>

            <Step n={2} icon={User} title="আপনার তথ্য">
              <CustomerFields value={customer} onChange={setCustomer} errors={errors} />
            </Step>

            <Step n={3} icon={Truck} title="ডেলিভারি জোন">
              <ZonePicker zones={zones} zone={zone} onChange={setZone} />
            </Step>

            <Step n={4} icon={Banknote} title="পেমেন্ট পদ্ধতি">
              <CashOnDelivery />
            </Step>
          </div>

          <aside className="h-fit space-y-4 rounded-xl border border-line bg-white p-5 lg:sticky lg:top-36">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <ShoppingBag className="size-5" /> অর্ডার সামারি
            </h2>
            <ul className="space-y-2 border-b border-line pb-3 text-sm text-muted">
              {cart.map((i) => (
                <li key={i.key} className="flex justify-between gap-3">
                  <span className="line-clamp-1">{i.name}{i.variantName ? ` (${i.variantName})` : ""} × {i.qty}</span>
                  <span>{taka(i.price * i.qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-b border-line pb-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">সাবটোটাল</dt>
                <dd>{taka(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">ডেলিভারি চার্জ</dt>
                <dd>{taka(fee)}</dd>
              </div>
            </dl>
            <div className="flex justify-between text-xl font-bold">
              <span>সর্বমোট</span>
              <span>{taka(total)}</span>
            </div>
            <ul className="space-y-1.5 text-xs text-muted">
              <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-green-600" /> আপনার তথ্য সম্পূর্ণ নিরাপদ</li>
              <li className="flex items-center gap-2"><Truck className="size-4" /> দ্রুত ডেলিভারি নিশ্চিত</li>
            </ul>

            {formError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}

            <button
              type="submit"
              disabled={pending}
              className="hidden h-12 w-full rounded-lg bg-brand font-semibold text-white hover:bg-brand-dark disabled:opacity-60 lg:block"
            >
              {pending ? "অর্ডার হচ্ছে..." : "অর্ডার কনফার্ম করুন"}
            </button>
          </aside>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white lg:hidden">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="text-xs text-muted">সর্বমোট</p>
                <p className="text-lg font-bold">{taka(total)}</p>
              </div>
              <button
                type="submit"
                disabled={pending}
                className="h-11 flex-1 rounded-lg bg-brand text-sm font-semibold text-white disabled:opacity-60 sm:max-w-xs"
              >
                {pending ? "অর্ডার হচ্ছে..." : "অর্ডার কনফার্ম করুন"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
