"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Info, Minus, Package, Plus, Trash2 } from "lucide-react";
import { saveOrderEdit, type PickerProduct } from "@/app/admin/(panel)/orders/actions";
import type { OrderDetail } from "@/lib/admin/orders";
import { taka } from "@/lib/format";
import { statusLabels } from "@/lib/order-status";
import type { Zone } from "@/lib/settings";
import type { DeliveryZoneId } from "@/lib/site";
import { Button, Field, TextArea, TextInput } from "./form";
import { ProductPicker, type PickedVariant } from "./product-picker";
import { Card, CardHeader } from "./ui";

type Line = {
  key: string;
  itemId: number | null; // null = added in this edit
  productId: number | null;
  variantId: number | null;
  name: string;
  image: string | null;
  price: string; // editable unit price
  originalPrice: number | null;
  originalQty: number | null;
  stock: number | null; // known only for newly added products
  qty: number;
};

const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

export function OrderEditForm({ order, zones }: { order: OrderDetail; zones: Zone[] }) {
  const router = useRouter();
  const back = `/admin/orders?order=${order.orderNo}`;
  const [lines, setLines] = useState<Line[]>(() =>
    order.items.map((i) => ({
      key: `item-${i.id}`,
      itemId: i.id,
      productId: i.productId,
      variantId: i.variantId,
      name: i.variantName ? `${i.name} (${i.variantName})` : i.name,
      image: i.image,
      price: String(i.unitPrice),
      originalPrice: i.unitPrice,
      originalQty: i.quantity,
      stock: null,
      qty: i.quantity,
    })),
  );
  const [name, setName] = useState(order.customerName);
  const [phone, setPhone] = useState(order.phone);
  const [address, setAddress] = useState(order.address);
  const [zone, setZone] = useState<DeliveryZoneId>(order.zone === "inside" ? "inside" : "outside");
  const [fee, setFee] = useState(String(order.shippingFee));
  const [note, setNote] = useState(order.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = (p: PickerProduct, v?: PickedVariant) => {
    // an existing line for the same product/variant just gets one more
    const existing = lines.find((l) => l.productId === p.id && l.variantId === (v?.id ?? null));
    if (existing) {
      setLines((ls) => ls.map((l) => (l.key === existing.key ? { ...l, qty: Math.min(50, l.qty + 1) } : l)));
      return;
    }
    setLines((ls) => [
      ...ls,
      {
        key: `new-${p.id}-${v?.id ?? 0}`,
        itemId: null,
        productId: p.id,
        variantId: v?.id ?? null,
        name: v ? `${p.name} (${v.name})` : p.name,
        image: p.image,
        price: String(v?.price ?? p.price),
        originalPrice: null,
        originalQty: null,
        stock: v?.stock ?? p.stock,
        qty: 1,
      },
    ]);
  };
  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const shipping = num(fee);
  const subtotal = lines.reduce((n, l) => n + (num(l.price) || 0) * l.qty, 0);
  const total = subtotal + (Number.isFinite(shipping) ? shipping : 0);
  const badPrice = lines.some((l) => !Number.isFinite(num(l.price)) || num(l.price) < 0);
  const removed = order.items.filter((i) => !lines.some((l) => l.itemId === i.id));

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await saveOrderEdit(order.id, {
        name,
        phone,
        address,
        zone,
        note,
        shippingFee: shipping,
        version: order.version,
        items: lines.map((l) => ({ itemId: l.itemId, productId: l.productId ?? undefined, variantId: l.variantId, qty: l.qty, unitPrice: num(l.price) })),
      });
      if (res.ok) {
        router.replace(back);
        router.refresh();
      } else {
        setErrors(("fieldErrors" in res && res.fieldErrors) || {});
        setError(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={back} aria-label="অর্ডারে ফিরে যান" className="rounded-lg border border-adm-line bg-white p-2 hover:bg-stone-50">
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">অর্ডার এডিট: {order.orderNo}</h1>
            <p className="text-sm text-adm-muted">
              স্ট্যাটাস: {statusLabels[order.status]} · {order.source === "PHONE" ? "ফোন অর্ডার" : "ওয়েবসাইট অর্ডার"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={back} className="inline-flex h-10 items-center rounded-lg border border-adm-line bg-white px-4 text-sm font-semibold hover:bg-stone-50">
            বাতিল
          </Link>
          <Button type="submit" disabled={pending || lines.length === 0 || badPrice}>
            {pending ? "সেভ হচ্ছে..." : "পরিবর্তন সেভ করুন"}
          </Button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <p className="flex gap-2 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <Info className="mt-0.5 size-4 shrink-0" />
        {order.isDemo
          ? "এটি ডেমো অর্ডার, তাই স্টকে কোনো পরিবর্তন হবে না।"
          : "পণ্য বা পরিমাণ বদলালে স্টক নিজে থেকে মিলিয়ে নেওয়া হবে। কী কী বদলালেন তা অর্ডারের হিস্ট্রিতে লেখা থাকবে।"}
      </p>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="পণ্য" subtitle="দাম বদলাতে দামের ঘরে নতুন দাম লিখুন (যেমন ছাড় দিলে)" />
            <div className="space-y-2">
              {lines.length === 0 && <p className="text-sm text-red-700">অর্ডারে অন্তত একটি পণ্য রাখতে হবে</p>}
              {lines.map((l) => {
                const price = num(l.price);
                const priceChanged = l.originalPrice !== null && price !== l.originalPrice;
                const qtyChanged = l.originalQty !== null && l.qty !== l.originalQty;
                return (
                  <div key={l.key} className={`flex flex-wrap items-center gap-3 rounded-lg p-2.5 ${l.itemId ? "bg-stone-50" : "bg-green-50 ring-1 ring-green-200"}`}>
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-md border border-adm-line bg-white">
                      {l.image ? <Image src={l.image} alt="" fill sizes="40px" className="object-contain p-0.5" /> : <Package className="m-auto mt-2.5 size-4 text-adm-muted" />}
                    </span>
                    <div className="min-w-40 flex-1">
                      <p className="truncate text-sm font-medium">{l.name}</p>
                      <p className="text-xs text-adm-muted">
                        {l.itemId ? (
                          <>
                            আগে: {taka(l.originalPrice!)} × {l.originalQty}
                            {(priceChanged || qtyChanged) && <span className="font-semibold text-sky-700"> · বদলানো হয়েছে</span>}
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-green-700">নতুন যোগ</span> · স্টক {l.stock}
                            {l.stock !== null && l.qty > l.stock && <span className="font-semibold text-red-700"> · স্টকের চেয়ে বেশি</span>}
                          </>
                        )}
                        {!l.productId && <span> · প্রোডাক্টটি ডিলিট হয়ে গেছে</span>}
                      </p>
                    </div>
                    <label className="flex h-8 w-28 items-center gap-1 rounded-md border border-adm-line bg-white px-2 focus-within:border-adm-accent-strong" title="প্রতি পিসের দাম">
                      <span className="text-xs text-adm-muted">৳</span>
                      <input
                        inputMode="decimal"
                        aria-label={`${l.name} এর দাম`}
                        value={l.price}
                        onChange={(e) => update(l.key, { price: e.target.value.replace(/[^\d.]/g, "") })}
                        className={`w-full bg-transparent text-right text-sm tabular-nums outline-none ${!Number.isFinite(price) ? "text-red-700" : ""}`}
                      />
                    </label>
                    <div className="flex h-8 items-center rounded-md border border-adm-line bg-white">
                      <button type="button" aria-label="কমান" className="grid h-full w-8 place-items-center" onClick={() => update(l.key, { qty: Math.max(1, l.qty - 1) })}>
                        <Minus className="size-3" />
                      </button>
                      <span className="w-7 text-center text-sm tabular-nums">{l.qty}</span>
                      <button type="button" aria-label="বাড়ান" className="grid h-full w-8 place-items-center" onClick={() => update(l.key, { qty: Math.min(50, l.qty + 1) })}>
                        <Plus className="size-3" />
                      </button>
                    </div>
                    <span className="w-20 text-right text-sm font-semibold tabular-nums">{taka((price || 0) * l.qty)}</span>
                    <button
                      type="button"
                      aria-label={`${l.name} বাদ দিন`}
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                );
              })}
              {removed.length > 0 && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                  বাদ দেওয়া হবে: {removed.map((i) => `${i.name}${i.variantName ? ` (${i.variantName})` : ""} ×${i.quantity}`).join(", ")}
                </p>
              )}
            </div>
            <div className="mt-4 border-t border-adm-line pt-4">
              <p className="mb-2 text-sm font-semibold">নতুন পণ্য যোগ করুন</p>
              <ProductPicker onAdd={add} />
            </div>
          </Card>

          <Card>
            <CardHeader title="কাস্টমারের তথ্য" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="নাম" required error={errors.name}>
                <TextInput value={name} error={!!errors.name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="মোবাইল নাম্বার" required error={errors.phone}>
                <TextInput value={phone} inputMode="tel" placeholder="01XXXXXXXXX" error={!!errors.phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field label="সম্পূর্ণ ঠিকানা" required error={errors.address} className="sm:col-span-2">
                <TextInput value={address} error={!!errors.address} onChange={(e) => setAddress(e.target.value)} />
              </Field>
              {!order.isDemo && (
                <Field label="কাস্টমারের নোট" className="sm:col-span-2">
                  <TextArea rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                </Field>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="ডেলিভারি" />
            <div className="space-y-2">
              {zones.map((z) => (
                <label key={z.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-sm ${zone === z.id ? "border-adm-ink" : "border-adm-line"}`}>
                  <input
                    type="radio"
                    checked={zone === z.id}
                    onChange={() => {
                      setZone(z.id);
                      setFee(String(z.fee)); // switching zone brings that zone's fee; it can still be changed below
                    }}
                    className="accent-stone-900"
                  />
                  <span className="flex-1">{z.label}</span>
                  <span className="font-semibold">{taka(z.fee)}</span>
                </label>
              ))}
            </div>
            <Field label="ডেলিভারি চার্জ (৳)" required error={errors.shippingFee} hint="জোন বদলালে সেই জোনের চার্জ বসে। ফ্রি ডেলিভারির জন্য 0" className="mt-4">
              <TextInput value={fee} inputMode="numeric" error={!!errors.shippingFee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))} />
            </Field>
          </Card>

          <Card>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-adm-muted">সাবটোটাল</dt>
                <dd className="tabular-nums">{taka(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-adm-muted">ডেলিভারি</dt>
                <dd className="tabular-nums">{taka(Number.isFinite(shipping) ? shipping : 0)}</dd>
              </div>
              <div className="flex justify-between border-t border-adm-line pt-2 text-lg font-bold">
                <dt>নতুন মোট</dt>
                <dd className="tabular-nums">{taka(total)}</dd>
              </div>
              {total !== order.total && (
                <div className="flex justify-between text-xs text-adm-muted">
                  <dt>আগের মোট</dt>
                  <dd className="tabular-nums line-through">{taka(order.total)}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </form>
  );
}
