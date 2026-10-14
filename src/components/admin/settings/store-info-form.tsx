"use client";

import { useState, useTransition } from "react";
import { saveStoreInfo } from "@/app/admin/(panel)/settings/actions";
import { Button, Field, TextInput } from "../form";
import { Card, CardHeader } from "../ui";

type Values = { phone: string; whatsapp: string; email: string; address: string; insideFee: string; outsideFee: string };

export function StoreInfoForm({ initial }: { initial: Values }) {
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<Values>) => {
    setV((s) => ({ ...s, ...patch }));
    setMessage(null);
  };
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await saveStoreInfo(v);
          if (res.ok) {
            setSaved(v);
            setErrors({});
            setMessage({ ok: true, text: res.message ?? "সেভ হয়েছে" });
          } else {
            setErrors(res.fieldErrors ?? {});
            setMessage({ ok: false, text: res.error });
          }
        });
      }}
      className="space-y-5"
    >
      <Card>
        <CardHeader title="যোগাযোগ" subtitle="স্টোরের হেডার, ফুটার, প্রোডাক্ট পেজ, ইনভয়েস আর Contact পেজে দেখাবে" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="হটলাইন / ফোন" required error={errors.phone}>
            <TextInput inputMode="tel" value={v.phone} error={!!errors.phone} placeholder="01XXXXXXXXX" onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="WhatsApp নাম্বার" required error={errors.whatsapp} hint="WhatsApp বাটন এই নাম্বারে মেসেজ পাঠাবে">
            <TextInput inputMode="tel" value={v.whatsapp} error={!!errors.whatsapp} placeholder="01XXXXXXXXX" onChange={(e) => set({ whatsapp: e.target.value })} />
          </Field>
          <Field label="ইমেইল" error={errors.email}>
            <TextInput type="email" value={v.email} error={!!errors.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="ঠিকানা" required error={errors.address}>
            <TextInput value={v.address} error={!!errors.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="ডেলিভারি চার্জ" subtitle="চেকআউট, দ্রুত অর্ডার পপআপ আর ফোন অর্ডারে এই চার্জ বসবে। আগের অর্ডারের চার্জ বদলাবে না।" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ঢাকার ভিতরে (৳)" required error={errors.insideFee}>
            <TextInput inputMode="numeric" value={v.insideFee} error={!!errors.insideFee} onChange={(e) => set({ insideFee: e.target.value.replace(/\D/g, "") })} />
          </Field>
          <Field label="ঢাকার বাহিরে (৳)" required error={errors.outsideFee}>
            <TextInput inputMode="numeric" value={v.outsideFee} error={!!errors.outsideFee} onChange={(e) => set({ outsideFee: e.target.value.replace(/\D/g, "") })} />
          </Field>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {message && <span className={`text-sm ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</span>}
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "সেভ হচ্ছে..." : "সেভ করুন"}
        </Button>
      </div>
    </form>
  );
}
