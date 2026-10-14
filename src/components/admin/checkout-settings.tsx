"use client";

import { useState, useTransition } from "react";
import { Check, MousePointerClick, PanelTop, ShoppingCart } from "lucide-react";
import { saveCheckoutSettings } from "@/app/admin/(panel)/settings/actions";
import type { BuyNowMode } from "@/lib/settings";
import { Button } from "./form";
import { Card, CardHeader } from "./ui";

const options: { id: BuyNowMode; title: string; text: string; icon: typeof PanelTop }[] = [
  {
    id: "popup",
    title: "পপআপে দ্রুত অর্ডার",
    text: "একই পেজে একটি পপআপ খুলবে। কাস্টমার নাম, ফোন আর ঠিকানা দিয়ে সাথে সাথে অর্ডার করতে পারবেন। কার্টের অন্য পণ্যে হাত পড়বে না।",
    icon: PanelTop,
  },
  {
    id: "checkout",
    title: "চেকআউট পেজে নিয়ে যাবে",
    text: "পণ্যটি কার্টে যোগ হয়ে সরাসরি চেকআউট পেজ খুলবে। কার্টে আগে থেকে থাকা পণ্যও একসাথে অর্ডার হবে।",
    icon: ShoppingCart,
  },
];

export function CheckoutSettings({ initial }: { initial: { buyNowMode: BuyNowMode } }) {
  const [mode, setMode] = useState(initial.buyNowMode);
  const [saved, setSaved] = useState(initial.buyNowMode);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = mode !== saved;

  return (
    <Card>
      <CardHeader
        title="Buy Now বাটন"
        subtitle="প্রোডাক্ট কার্ড আর প্রোডাক্ট পেজের Buy Now বাটনে ক্লিক করলে কী হবে"
        action={<MousePointerClick className="size-5 text-adm-accent-strong" />}
      />
      <div className="grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Buy Now বাটনের আচরণ">
        {options.map((o) => {
          const active = mode === o.id;
          const Icon = o.icon;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(o.id)}
              className={`relative flex gap-3 rounded-xl border-2 p-4 text-left transition ${
                active ? "border-adm-ink bg-adm-accent-soft" : "border-adm-line bg-white hover:border-adm-accent-strong"
              }`}
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${active ? "bg-adm-ink text-white" : "bg-stone-100"}`}>
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">{o.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-adm-muted">{o.text}</span>
              </span>
              {active && <Check className="absolute right-3 top-3 size-4 text-adm-ink" />}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        {error && <span className="text-sm text-red-700">{error}</span>}
        {!dirty && !error && <span className="text-xs text-adm-muted">সেভ করা আছে</span>}
        <Button
          disabled={!dirty || pending}
          onClick={() =>
            startTransition(async () => {
              const res = await saveCheckoutSettings({ buyNowMode: mode });
              if (res.ok) {
                setSaved(mode);
                setError(null);
              } else setError(res.error ?? "সেভ করা যায়নি");
            })
          }
        >
          {pending ? "সেভ হচ্ছে..." : "সেভ করুন"}
        </Button>
      </div>
    </Card>
  );
}
