"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import { createManualOrder, type PickerProduct } from "@/app/admin/(panel)/orders/actions";
import { taka } from "@/lib/format";
import type { Zone } from "@/lib/settings";
import type { DeliveryZoneId } from "@/lib/site";
import { Button, Field, TextArea, TextInput } from "./form";
import { ProductPicker, type PickedVariant } from "./product-picker";
import { Card, CardHeader } from "./ui";

type Line = { key: string; productId: number; variantId: number | null; name: string; image: string | null; price: number; stock: number; qty: number };

export function ManualOrderForm({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [zone, setZone] = useState<DeliveryZoneId>("inside");
  const [fee, setFee] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"CONFIRMED" | "PENDING">("CONFIRMED");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = (p: PickerProduct, v?: PickedVariant) => {
    const key = `${p.id}:${v?.id ?? 0}`;
    setLines((ls) =>
      ls.some((l) => l.key === key)
        ? ls.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l))
        : [
            ...ls,
            {
              key,
              productId: p.id,
              variantId: v?.id ?? null,
              name: v ? `${p.name} (${v.name})` : p.name,
              image: p.image,
              price: v?.price ?? p.price,
              stock: v?.stock ?? p.stock,
              qty: 1,
            },
          ],
    );
  };

  const zoneFee = zones.find((z) => z.id === zone)!.fee;
  const shipping = fee.trim() === "" ? zoneFee : Number(fee) || 0;
  const subtotal = lines.reduce((n, l) => n + l.price * l.qty, 0);

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await createManualOrder({
        name,
        phone,
        address,
        zone,
        note,
        shippingFee: fee,
        status,
        items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty })),
      });
      if (res.ok) router.replace(`/admin/orders?order=${res.orderNo}`);
      else {
        setErrors(res.fieldErrors ?? {});
        setError(res.error ?? "কিছু তথ্য ঠিক করতে হবে");
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
          <Link href="/admin/orders" aria-label="অর্ডার তালিকায় ফিরে যান" className="rounded-lg border border-adm-line bg-white p-2 hover:bg-stone-50">
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">ফোন অর্ডার</h1>
            <p className="text-sm text-adm-muted">ফোন বা মেসেঞ্জারে আসা অর্ডার এন্ট্রি করুন। স্টক থেকে পণ্য কাটা হবে।</p>
          </div>
        </div>
        <Button type="submit" disabled={pending || lines.length === 0}>
          {pending ? "সেভ হচ্ছে..." : "অর্ডার তৈরি করুন"}
        </Button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="পণ্য যোগ করুন" />
            <ProductPicker onAdd={add} />

            <div className="mt-4 space-y-2">
              {lines.length === 0 && <p className="text-sm text-adm-muted">এখনো কোনো পণ্য যোগ করা হয়নি</p>}
              {lines.map((l) => (
                <div key={l.key} className="flex items-center gap-3 rounded-lg bg-stone-50 p-2.5">
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-md border border-adm-line bg-white">
                    {l.image && <Image src={l.image} alt="" fill sizes="40px" className="object-contain p-0.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-adm-muted">
                      {taka(l.price)} · স্টক {l.stock}
                      {l.qty > l.stock && <span className="font-semibold text-red-700"> · স্টকের চেয়ে বেশি</span>}
                    </p>
                  </div>
                  <div className="flex h-8 items-center rounded-md border border-adm-line bg-white">
                    <button type="button" aria-label="কমান" className="grid h-full w-8 place-items-center" onClick={() => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}>
                      <Minus className="size-3" />
                    </button>
                    <span className="w-6 text-center text-sm">{l.qty}</span>
                    <button type="button" aria-label="বাড়ান" className="grid h-full w-8 place-items-center" onClick={() => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, qty: x.qty + 1 } : x)))}>
                      <Plus className="size-3" />
                    </button>
                  </div>
                  <span className="w-20 text-right text-sm font-semibold tabular-nums">{taka(l.price * l.qty)}</span>
                  <button type="button" aria-label="সরান" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="rounded-md p-1.5 text-red-600 hover:bg-red-50">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
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
                <TextInput value={address} error={!!errors.address} placeholder="বাড়ি/রোড নং, এলাকা, থানা, জেলা" onChange={(e) => setAddress(e.target.value)} />
              </Field>
              <Field label="কাস্টমারের নোট" className="sm:col-span-2">
                <TextArea rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="ডেলিভারি" />
            <div className="space-y-2">
              {zones.map((z) => (
                <label key={z.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-sm ${zone === z.id ? "border-adm-ink" : "border-adm-line"}`}>
                  <input type="radio" checked={zone === z.id} onChange={() => setZone(z.id)} className="accent-stone-900" />
                  <span className="flex-1">{z.label}</span>
                  <span className="font-semibold">{taka(z.fee)}</span>
                </label>
              ))}
            </div>
            <Field label="ডেলিভারি চার্জ (আলাদা হলে)" hint="খালি রাখলে জোনের চার্জ বসবে, ফ্রি ডেলিভারির জন্য 0" className="mt-4">
              <TextInput value={fee} inputMode="numeric" placeholder={String(zoneFee)} onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))} />
            </Field>
          </Card>

          <Card>
            <CardHeader title="স্ট্যাটাস" />
            <div className="flex rounded-lg bg-stone-900/5 p-0.5 text-sm">
              {(
                [
                  ["CONFIRMED", "Confirmed"],
                  ["PENDING", "New"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setStatus(id)} className={`flex-1 rounded-md px-3 py-1.5 ${status === id ? "bg-adm-ink font-semibold text-white" : "text-adm-ink-soft"}`}>
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-adm-muted">ফোনে কথা বলে নিশ্চিত হলে Confirmed রাখুন</p>
          </Card>

          <Card>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-adm-muted">সাবটোটাল</dt>
                <dd className="tabular-nums">{taka(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-adm-muted">ডেলিভারি</dt>
                <dd className="tabular-nums">{taka(shipping)}</dd>
              </div>
              <div className="flex justify-between border-t border-adm-line pt-2 text-lg font-bold">
                <dt>মোট</dt>
                <dd className="tabular-nums">{taka(subtotal + shipping)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </form>
  );
}
