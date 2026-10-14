"use client";

// Pieces shared by the checkout page and the quick-order popup.
import { Banknote, CircleCheck, MapPin, Package, Phone, User, type LucideIcon } from "lucide-react";
import { taka } from "@/lib/format";
import type { Zone } from "@/lib/settings";
import type { DeliveryZoneId } from "@/lib/site";

export function Step({
  n,
  icon: Icon,
  title,
  children,
  compact = false,
}: {
  n: number;
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-line bg-white ${compact ? "p-4" : "p-5"}`}>
      <h2 className={`mb-4 flex items-center gap-3 font-bold ${compact ? "text-base" : "text-lg"}`}>
        <span className="grid size-7 place-items-center rounded-full bg-ink text-sm text-white">{n}</span>
        <Icon className="size-5" /> {title}
      </h2>
      {children}
    </section>
  );
}

export function Field(props: {
  icon: LucideIcon;
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: string;
  type?: string;
  inputMode?: "tel" | "text";
  autoComplete?: string;
}) {
  const Icon = props.icon;
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
        <Icon className="size-4 text-muted" /> {props.label} <span className="text-red-500">*</span>
      </span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        aria-invalid={!!props.error}
        className={`h-11 w-full rounded-lg border bg-slate-50 px-3 text-sm outline-none focus:border-brand focus:bg-white ${
          props.error ? "border-red-400" : "border-line"
        }`}
      />
      {props.error && <span className="mt-1 block text-xs text-red-600">{props.error}</span>}
    </label>
  );
}

export type CustomerInfo = { name: string; phone: string; address: string };

export function CustomerFields({
  value,
  onChange,
  errors,
}: {
  value: CustomerInfo;
  onChange: (v: CustomerInfo) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      <Field icon={User} label="নাম" name="name" autoComplete="name" value={value.name} onChange={(name) => onChange({ ...value, name })} placeholder="আপনার পুরো নাম লিখুন" error={errors.name} />
      <Field icon={Phone} label="মোবাইল নাম্বার" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={value.phone} onChange={(phone) => onChange({ ...value, phone })} placeholder="01XXXXXXXXX" error={errors.phone} />
      <Field icon={MapPin} label="সম্পূর্ণ ঠিকানা" name="address" autoComplete="street-address" value={value.address} onChange={(address) => onChange({ ...value, address })} placeholder="বাড়ি/রোড নং, এলাকা, থানা, জেলা" error={errors.address} />
    </div>
  );
}

export function ZonePicker({
  zones,
  zone,
  onChange,
  name = "zone",
}: {
  zones: Zone[];
  zone: DeliveryZoneId;
  onChange: (z: DeliveryZoneId) => void;
  name?: string;
}) {
  return (
    <div className="space-y-3">
      {zones.map((z) => (
        <label key={z.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 ${zone === z.id ? "border-ink bg-slate-50" : "border-line"}`}>
          <input type="radio" name={name} checked={zone === z.id} onChange={() => onChange(z.id)} className="size-4 accent-ink" />
          <Package className="size-4 text-muted" />
          <span className="flex-1 font-medium">{z.label}</span>
          <span className="font-semibold">{taka(z.fee)}</span>
        </label>
      ))}
    </div>
  );
}

export function CashOnDelivery() {
  return (
    <div className="flex items-center gap-3 rounded-lg border-2 border-ink bg-slate-50 p-4">
      <span className="grid size-10 place-items-center rounded-lg bg-slate-200">
        <Banknote className="size-5" />
      </span>
      <div className="flex-1">
        <p className="font-semibold">ক্যাশ অন ডেলিভারি</p>
        <p className="text-xs text-muted">পণ্য হাতে পেয়ে মূল্য পরিশোধ করুন</p>
      </div>
      <CircleCheck className="size-5 text-green-600" />
    </div>
  );
}
