"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Search, ShieldAlert } from "lucide-react";
import { blockPhone, unblockPhone } from "@/app/admin/(panel)/orders/actions";
import { saveFraud, testFraudLookup } from "@/app/admin/(panel)/settings/actions";
import { Button, Field, TextInput, Toggle } from "../form";
import { Card, CardHeader } from "../ui";

type Values = { enabled: boolean; safeAt: string; riskyBelow: string; minParcels: string };
type Blocked = { phone: string; reason: string; blockedBy: string | null; createdAt: string };

export function FraudForm({ initial, tokenEnd: initialTokenEnd, blocked }: { initial: Values; tokenEnd: string; blocked: Blocked[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [token, setToken] = useState("");
  const [removeToken, setRemoveToken] = useState(false);
  const [tokenEnd, setTokenEnd] = useState(initialTokenEnd);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [newReason, setNewReason] = useState("");
  const [blockError, setBlockError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<Values>) => {
    setV((s) => ({ ...s, ...patch }));
    setMessage(null);
  };
  const dirty = JSON.stringify(v) !== JSON.stringify(saved) || !!token || removeToken;

  return (
    <div className="space-y-5">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await saveFraud({ ...v, token, removeToken });
            if (res.ok) {
              setSaved(v);
              setToken("");
              setRemoveToken(false);
              setTokenEnd(res.tokenEnd ?? "");
              setErrors({});
              setMessage({ ok: true, text: res.message ?? "সেভ হয়েছে" });
            } else {
              setErrors(res.fieldErrors ?? {});
              setMessage({ ok: false, text: res.error });
            }
          });
        }}
      >
        <Card>
          <CardHeader
            title="সব কুরিয়ারের হিসাব (BD Courier)"
            subtitle="Steadfast, Pathao, RedX, Paperfly-সহ সব কুরিয়ারে এই নাম্বারে কতটা পার্সেল সফল আর কতটা ফেরত গেছে। চালু না থাকলে শুধু এই দোকানের হিসাব দিয়ে ঝুঁকি বোঝানো হয়।"
            action={<ShieldAlert className="size-5 text-adm-accent-strong" />}
          />
          <div className="space-y-4">
            <Toggle checked={v.enabled} onChange={(enabled) => set({ enabled })} label="BD Courier চেক চালু" description="নতুন অর্ডার এলে নিজে থেকে চেক হবে। একই নাম্বার দিনে একবারের বেশি চেক হয় না।" />
            <Field
              label="BD Courier API টোকেন"
              error={errors.token}
              hint={tokenEnd && !removeToken ? `সেভ করা আছে (শেষে …${tokenEnd})। বদলাতে চাইলে নতুনটা দিন।` : "bdcourier.com-এ রেজিস্টার করে অ্যাকাউন্ট সেটিংস থেকে টোকেন নিন"}
            >
              <TextInput
                type="password"
                autoComplete="off"
                value={token}
                error={!!errors.token}
                placeholder={tokenEnd && !removeToken ? "••••••••" : "টোকেন পেস্ট করুন"}
                onChange={(e) => {
                  setToken(e.target.value.trim());
                  setMessage(null);
                }}
              />
            </Field>
            {tokenEnd && (
              <label className="flex items-center gap-2 text-sm text-adm-muted">
                <input type="checkbox" checked={removeToken} onChange={(e) => setRemoveToken(e.target.checked)} />
                সেভ করা টোকেন মুছে দিন
              </label>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="ঝুঁকির সীমা" subtitle="সফল ডেলিভারির হার অনুযায়ী কোন কাস্টমার কোন রঙে দেখাবে" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="🟢 নিরাপদ, যদি সফল হার (%) এর বেশি বা সমান" error={errors.safeAt}>
              <TextInput inputMode="numeric" value={v.safeAt} error={!!errors.safeAt} onChange={(e) => set({ safeAt: e.target.value.replace(/\D/g, "") })} />
            </Field>
            <Field label="🔴 ঝুঁকিপূর্ণ, যদি সফল হার (%) এর কম" error={errors.riskyBelow} hint="মাঝের হার হলে 🟡 সতর্ক থাকুন">
              <TextInput inputMode="numeric" value={v.riskyBelow} error={!!errors.riskyBelow} onChange={(e) => set({ riskyBelow: e.target.value.replace(/\D/g, "") })} />
            </Field>
            <Field label="⚪ নতুন কাস্টমার, যদি পার্সেল এর কম" error={errors.minParcels} hint="এর কম হলে বিচার করার মতো হিসাব নেই">
              <TextInput inputMode="numeric" value={v.minParcels} error={!!errors.minParcels} onChange={(e) => set({ minParcels: e.target.value.replace(/\D/g, "") })} />
            </Field>
          </div>
          <p className="mt-3 text-xs text-adm-muted">অন্য ব্যবসায়ীরা নাম্বারটি নিয়ে রিপোর্ট করে থাকলে হার যা-ই হোক 🔴 দেখাবে। এটা শুধু সতর্কতা, কোনো অর্ডার নিজে থেকে আটকায় না।</p>
        </Card>

        <div className="flex items-center justify-end gap-3">
          {message && <span className={`text-sm ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</span>}
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </Button>
        </div>
      </form>

      <Card>
        <CardHeader title="টোকেন পরীক্ষা" subtitle="যেকোনো নাম্বার দিয়ে দেখুন BD Courier থেকে তথ্য আসছে কিনা" />
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              setTestMessage(null);
              const res = await testFraudLookup(testPhone);
              setTestMessage(res.ok ? { ok: true, text: res.message ?? "" } : { ok: false, text: res.error });
            });
          }}
        >
          <Field label="মোবাইল নাম্বার" className="w-56">
            <TextInput inputMode="tel" value={testPhone} placeholder="01XXXXXXXXX" onChange={(e) => setTestPhone(e.target.value)} />
          </Field>
          <Button type="submit" variant="secondary" disabled={pending || dirty || !tokenEnd || !saved.enabled} title={dirty ? "আগে সেভ করুন" : undefined}>
            <Search className="size-4" /> চেক করুন
          </Button>
        </form>
        {testMessage && <p className={`mt-3 text-sm ${testMessage.ok ? "text-green-700" : "text-red-700"}`}>{testMessage.text}</p>}
      </Card>

      <Card>
        <CardHeader title={`ব্লক করা নাম্বার (${blocked.length})`} subtitle="এই নাম্বার থেকে অর্ডার এলে নেওয়া হবে, তবে ⛔ লাল চিহ্ন দেখাবে" action={<Ban className="size-5 text-red-700" />} />
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              setBlockError(null);
              const res = await blockPhone(newPhone, newReason);
              if (!res.ok) setBlockError(res.error);
              else {
                setNewPhone("");
                setNewReason("");
                router.refresh();
              }
            });
          }}
        >
          <Field label="নাম্বার" className="w-48">
            <TextInput inputMode="tel" value={newPhone} placeholder="01XXXXXXXXX" onChange={(e) => setNewPhone(e.target.value)} />
          </Field>
          <Field label="কারণ" className="min-w-60 flex-1">
            <TextInput value={newReason} maxLength={255} placeholder="যেমন: ৩ বার পার্সেল ফেরত দিয়েছে" onChange={(e) => setNewReason(e.target.value)} />
          </Field>
          <Button type="submit" variant="danger" disabled={pending}>
            ব্লক করুন
          </Button>
        </form>
        {blockError && <p className="mt-2 text-sm text-red-700">{blockError}</p>}
        <ul className="mt-4 divide-y divide-adm-line rounded-xl border border-adm-line bg-white text-sm">
          {blocked.map((b) => (
            <li key={b.phone} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="w-28 font-semibold tabular-nums">{b.phone}</span>
              <span className="min-w-40 flex-1 text-adm-ink-soft">{b.reason}</span>
              <span className="text-xs text-adm-muted">
                {b.blockedBy ?? ""} · {new Date(b.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await unblockPhone(b.phone);
                    router.refresh();
                  })
                }
                className="text-xs font-semibold text-adm-accent-strong hover:underline"
              >
                ব্লক তুলুন
              </button>
            </li>
          ))}
          {blocked.length === 0 && <li className="px-3 py-6 text-center text-adm-muted">কোনো নাম্বার ব্লক করা নেই</li>}
        </ul>
      </Card>
    </div>
  );
}
