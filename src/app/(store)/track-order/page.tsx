"use client";

import { useState, useTransition } from "react";
import { PackageSearch } from "lucide-react";
import { trackOrder, type TrackResult } from "@/app/actions";
import { taka } from "@/lib/format";

const steps = [
  { id: "PENDING", label: "অর্ডার গ্রহণ" },
  { id: "CONFIRMED", label: "কনফার্মড" },
  { id: "SHIPPED", label: "কুরিয়ারে পাঠানো হয়েছে" },
  { id: "DELIVERED", label: "ডেলিভারি সম্পন্ন" },
];

export default function TrackOrderPage() {
  const [orderNo, setOrderNo] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<TrackResult | null>(null);
  const [pending, startTransition] = useTransition();

  const current = result?.found ? steps.findIndex((s) => s.id === result.status) : -1;

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="text-center">
        <PackageSearch className="mx-auto size-12 text-brand" />
        <h1 className="mt-3 text-2xl font-bold">অর্ডার ট্র্যাকিং</h1>
        <p className="mt-1 text-sm text-muted">অর্ডার নাম্বার ও মোবাইল নাম্বার দিয়ে আপনার অর্ডারের অবস্থা দেখুন</p>
      </div>

      <form
        className="mt-6 space-y-3 rounded-xl border border-line bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => setResult(await trackOrder(orderNo, phone)));
        }}
      >
        <input
          value={orderNo}
          onChange={(e) => setOrderNo(e.target.value)}
          placeholder="অর্ডার নাম্বার (যেমন TB100001)"
          required
          className="h-11 w-full rounded-lg border border-line bg-slate-50 px-3 text-sm outline-none focus:border-brand"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="মোবাইল নাম্বার"
          inputMode="tel"
          required
          className="h-11 w-full rounded-lg border border-line bg-slate-50 px-3 text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-11 w-full rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "খোঁজা হচ্ছে..." : "ট্র্যাক করুন"}
        </button>
      </form>

      {result && !result.found && (
        <p className="mt-5 rounded-lg bg-red-50 p-4 text-center text-sm text-red-700">
          এই তথ্য দিয়ে কোনো অর্ডার পাওয়া যায়নি। অর্ডার নাম্বার ও মোবাইল নাম্বার আবার চেক করুন।
        </p>
      )}

      {result?.found && (
        <div className="mt-5 rounded-xl border border-line bg-white p-5">
          <div className="flex justify-between text-sm">
            <span>
              অর্ডার: <b className="text-brand">{result.orderNo}</b>
            </span>
            <span className="font-semibold">{taka(result.total)}</span>
          </div>

          {result.status === "CANCELLED" ? (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-center text-sm font-semibold text-red-700">অর্ডারটি বাতিল করা হয়েছে</p>
          ) : (
            <ol className="mt-5 space-y-3">
              {steps.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 text-sm">
                  <span
                    className={`grid size-6 place-items-center rounded-full text-xs font-bold ${
                      i <= current ? "bg-green-600 text-white" : "bg-slate-200 text-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={i <= current ? "font-semibold" : "text-muted"}>{s.label}</span>
                </li>
              ))}
            </ol>
          )}

          <ul className="mt-5 space-y-1 border-t border-line pt-3 text-sm text-muted">
            {result.items.map((i) => (
              <li key={i.name}>
                {i.name} × {i.quantity}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
